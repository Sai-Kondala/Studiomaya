import { POST } from '@/app/api/verify-payment/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import crypto from 'crypto';
import { Resend } from 'resend';
import Razorpay from 'razorpay';

jest.mock('@/lib/supabaseAdmin', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

let mockResendSend: jest.Mock;
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: (...args: any[]) => mockResendSend(...args),
    },
  })),
}));

const mockPaymentsFetch = jest.fn();
jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    payments: {
      fetch: mockPaymentsFetch,
    },
  }));
});

describe('POST /api/verify-payment', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockResendSend = jest.fn().mockResolvedValue({ id: 'email_123' });

    process.env.RAZORPAY_KEY_ID = 'test_key';
    process.env.RAZORPAY_KEY_SECRET = 'test_secret';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_role_key';

    mockPaymentsFetch.mockResolvedValue({
      id: 'pay_123',
      order_id: 'order_rzp_123',
      amount: 50000,
      currency: 'INR',
      status: 'captured',
    });

    mockSupabase = {
      from: jest.fn(),
      storage: {
        from: jest.fn().mockReturnValue({
          createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: 'http://signed.url' }, error: null }),
        }),
      },
    };

    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  const createRequest = (body: any) => {
    return new Request('http://localhost/api/verify-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  };

  const generateSignature = (orderId: string, paymentId: string) => {
    return crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
  };

  it('should verify payment successfully when signature and Razorpay status are valid', async () => {
    const validSignature = generateSignature('order_rzp_123', 'pay_123');

    const mockFrom = mockSupabase.from as jest.Mock;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { id: 'order_123', status: 'pending', amount: 500, customer_email: 'test@example.com' },
                error: null
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              neq: () => ({
                select: () => ({
                  maybeSingle: () => Promise.resolve({
                    data: { id: 'order_123', status: 'paid', amount: 500, customer_email: 'test@example.com' },
                    error: null
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'order_items') {
        return {
          select: () => ({
            eq: () => Promise.resolve({
              data: [{ product_id: 'prod_1' }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'products') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { name: 'Test Product', pdf_url: 'test.pdf' },
                error: null,
              })
            })
          }),
        };
      }
      return {};
    });

    const req = createRequest({
      razorpay_order_id: 'order_rzp_123',
      razorpay_payment_id: 'pay_123',
      razorpay_signature: validSignature,
      productId: 'prod_1',
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPaymentsFetch).toHaveBeenCalledWith('pay_123');
  });

  it('should reject payment if Razorpay payment amount does not match order amount', async () => {
    const validSignature = generateSignature('order_rzp_123', 'pay_123');

    mockPaymentsFetch.mockResolvedValue({
      id: 'pay_123',
      order_id: 'order_rzp_123',
      amount: 10000, // 100 instead of 500
      currency: 'INR',
      status: 'captured',
    });

    const mockFrom = mockSupabase.from as jest.Mock;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { id: 'order_123', status: 'pending', amount: 500, customer_email: 'test@example.com' },
                error: null
              }),
            }),
          }),
        };
      }
      return {};
    });

    const req = createRequest({
      razorpay_order_id: 'order_rzp_123',
      razorpay_payment_id: 'pay_123',
      razorpay_signature: validSignature,
      productId: 'prod_1',
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('amount does not match');
  });

  it('should reject payment if currency does not match INR', async () => {
    const validSignature = generateSignature('order_rzp_123', 'pay_123');

    mockPaymentsFetch.mockResolvedValue({
      id: 'pay_123',
      order_id: 'order_rzp_123',
      amount: 50000,
      currency: 'USD', // Invalid currency
      status: 'captured',
    });

    const mockFrom = mockSupabase.from as jest.Mock;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { id: 'order_123', status: 'pending', amount: 500, customer_email: 'test@example.com' },
                error: null
              }),
            }),
          }),
        };
      }
      return {};
    });

    const req = createRequest({
      razorpay_order_id: 'order_rzp_123',
      razorpay_payment_id: 'pay_123',
      razorpay_signature: validSignature,
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('currency does not match');
  });

  it('should handle concurrent verification requests gracefully without duplicate delivery', async () => {
    const validSignature = generateSignature('order_rzp_123', 'pay_123');

    const mockFrom = mockSupabase.from as jest.Mock;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                // Status is already paid by concurrent competitor
                data: { id: 'order_123', status: 'paid', amount: 500, customer_email: 'test@example.com' },
                error: null
              }),
            }),
          }),
        };
      }
      return {};
    });

    const req = createRequest({
      razorpay_order_id: 'order_rzp_123',
      razorpay_payment_id: 'pay_123',
      razorpay_signature: validSignature,
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Payment already verified');
    // Ensure email send was not called again
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it('should keep order paid even if receipt email delivery fails', async () => {
    const validSignature = generateSignature('order_rzp_123', 'pay_123');
    mockResendSend.mockRejectedValue(new Error('Resend rate limit exceeded'));

    const mockFrom = mockSupabase.from as jest.Mock;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { id: 'order_123', status: 'pending', amount: 500, customer_email: 'test@example.com' },
                error: null
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              neq: () => ({
                select: () => ({
                  maybeSingle: () => Promise.resolve({
                    data: { id: 'order_123', status: 'paid', amount: 500, customer_email: 'test@example.com' },
                    error: null
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'order_items') {
        return {
          select: () => ({
            eq: () => Promise.resolve({
              data: [{ product_id: 'prod_1' }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'products') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { name: 'Test Product', pdf_url: 'test.pdf' },
                error: null,
              })
            })
          }),
        };
      }
      return {};
    });

    const req = createRequest({
      razorpay_order_id: 'order_rzp_123',
      razorpay_payment_id: 'pay_123',
      razorpay_signature: validSignature,
      productId: 'prod_1',
    });

    const res = await POST(req);
    const data = await res.json();

    // Order remains paid and verification returns 200
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should fail with invalid signature', async () => {
    const req = createRequest({
      razorpay_order_id: 'order_rzp_123',
      razorpay_payment_id: 'pay_123',
      razorpay_signature: 'a'.repeat(64),
      productId: 'prod_1',
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Razorpay signature did not match. Check that the server secret belongs to the same Razorpay key used at checkout.');
  });
});
