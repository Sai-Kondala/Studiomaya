import { POST } from '@/app/api/verify-cart-payment/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import crypto from 'crypto';
import Razorpay from 'razorpay';

jest.mock('@/lib/supabaseAdmin', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ id: 'email_123' }),
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

describe('POST /api/verify-cart-payment', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RAZORPAY_KEY_ID = 'test_key';
    process.env.RAZORPAY_KEY_SECRET = 'test_secret';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_role_key';

    mockPaymentsFetch.mockResolvedValue({
      id: 'pay_123',
      order_id: 'order_rzp_123',
      amount: 30000,
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
    return new Request('http://localhost/api/verify-cart-payment', {
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

  it('should verify cart payment successfully', async () => {
    const validSignature = generateSignature('order_rzp_123', 'pay_123');

    const mockFrom = mockSupabase.from as jest.Mock;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { id: 'order_123', status: 'pending', amount: 300, customer_email: 'test@example.com' },
                error: null
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              neq: () => ({
                select: () => ({
                  maybeSingle: () => Promise.resolve({
                    data: { id: 'order_123', status: 'paid', amount: 300, customer_email: 'test@example.com' },
                    error: null
                  }),
                  single: () => Promise.resolve({
                    data: { id: 'order_123', status: 'paid', amount: 300, customer_email: 'test@example.com' },
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
              data: [{ product_id: 'prod_1' }, { product_id: 'prod_2' }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'products') {
        return {
          select: () => ({
            in: () => Promise.resolve({
              data: [
                { id: 'prod_1', name: 'Product 1', price: 100, pdf_url: 'test1.pdf' },
                { id: 'prod_2', name: 'Product 2', price: 200, pdf_url: 'test2.pdf' }
              ],
              error: null,
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
    expect(mockPaymentsFetch).toHaveBeenCalledWith('pay_123');
  });

  it('should prevent duplicate email processing when order is already paid', async () => {
    const validSignature = generateSignature('order_rzp_123', 'pay_123');

    const mockFrom = mockSupabase.from as jest.Mock;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          select: () => ({
            eq: () => ({
              // Order already marked as 'paid'
              single: () => Promise.resolve({
                data: { id: 'order_123', status: 'paid', amount: 300, customer_email: 'test@example.com' },
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

    // The API should still return success so frontend moves to thank-you, but it won't send emails again.
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Payment already verified');
  });
});
