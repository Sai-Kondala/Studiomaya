import crypto from 'crypto';
import { POST } from '@/app/api/webhooks/razorpay/route';
import { verifyRazorpayWebhookSignature } from '@/lib/razorpayWebhook';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { linkOrCreateCustomer } from '@/lib/customer';
import { clearUserCart } from '@/lib/cartService';
import { sendOrderReceiptEmail } from '@/lib/orderEmailDelivery';

jest.mock('@/lib/supabaseAdmin');
jest.mock('@/lib/customer');
jest.mock('@/lib/cartService');
jest.mock('@/lib/orderEmailDelivery');

describe('Razorpay Webhook Handler', () => {
  const originalEnv = process.env;
  const mockWebhookSecret = 'test_whsec_1234567890abcdef1234567890abcdef';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      RAZORPAY_WEBHOOK_SECRET: mockWebhookSecret,
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function createSignedHeaders(payload: string, secret: string = mockWebhookSecret): Headers {
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return new Headers({
      'content-type': 'application/json',
      'x-razorpay-signature': signature,
    });
  }

  describe('verifyRazorpayWebhookSignature', () => {
    it('returns true when valid HMAC signature is provided', () => {
      const body = JSON.stringify({ event: 'payment.captured' });
      const signature = crypto.createHmac('sha256', mockWebhookSecret).update(body).digest('hex');
      expect(verifyRazorpayWebhookSignature(body, signature, mockWebhookSecret)).toBe(true);
    });

    it('returns false for tampered signature or payload', () => {
      const body = JSON.stringify({ event: 'payment.captured' });
      const signature = crypto.createHmac('sha256', mockWebhookSecret).update(body).digest('hex');
      expect(verifyRazorpayWebhookSignature(body + 'tampered', signature, mockWebhookSecret)).toBe(false);
    });

    it('returns false for invalid hex signature format', () => {
      const body = JSON.stringify({ event: 'payment.captured' });
      expect(verifyRazorpayWebhookSignature(body, 'not-a-valid-hex-signature', mockWebhookSecret)).toBe(false);
    });
  });

  describe('POST /api/webhooks/razorpay', () => {
    it('rejects invalid signature with 401', async () => {
      const payload = JSON.stringify({ event: 'payment.captured' });
      const req = new Request('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: new Headers({
          'content-type': 'application/json',
          'x-razorpay-signature': '0000000000000000000000000000000000000000000000000000000000000000',
        }),
        body: payload,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe('Invalid webhook signature.');
    });

    it('ignores non-payment/order events gracefully with 200', async () => {
      const payload = JSON.stringify({ event: 'subscription.activated' });
      const req = new Request('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: createSignedHeaders(payload),
        body: payload,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ignored).toContain('subscription.activated');
    });

    it('returns 404 if order does not exist in database', async () => {
      const payload = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_999',
              order_id: 'order_nonexistent',
              amount: 50000,
            },
          },
        },
      });

      const mockSingle = jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

      (createSupabaseAdminClient as jest.Mock).mockReturnValue({
        from: mockFrom,
      });

      const req = new Request('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: createSignedHeaders(payload),
        body: payload,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toContain('Order not found');
    });

    it('is idempotent: returns 200 already_paid when order is already paid', async () => {
      const payload = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_123',
              order_id: 'order_already_paid',
              amount: 50000,
            },
          },
        },
      });

      const existingOrder = {
        id: 'ord_uuid_1',
        status: 'paid',
        customer_email: 'buyer@example.com',
        email_delivery_status: 'delivered',
      };

      const mockSingle = jest.fn().mockResolvedValue({ data: existingOrder, error: null });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

      (createSupabaseAdminClient as jest.Mock).mockReturnValue({
        from: mockFrom,
      });

      const req = new Request('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: createSignedHeaders(payload),
        body: payload,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.status).toBe('already_paid');
      expect(sendOrderReceiptEmail).not.toHaveBeenCalled();
    });

    it('fulfills pending order on payment.captured event: updates status, links customer, clears cart, and sends receipt', async () => {
      const payload = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_capture_success',
              order_id: 'order_pending_1',
              amount: 49900,
            },
          },
        },
      });

      const existingPendingOrder = {
        id: 'ord_uuid_pending',
        status: 'pending',
        amount: 499,
        customer_email: 'user@studiomaya.com',
        customer_name: 'Studio Maya Buyer',
        customer_phone: '+919876543210',
        user_id: 'user_123',
        email_delivery_status: 'pending',
      };

      const updatedOrder = {
        id: 'ord_uuid_pending',
        amount: 499,
        customer_email: 'user@studiomaya.com',
        customer_name: 'Studio Maya Buyer',
        customer_phone: '+919876543210',
        user_id: 'user_123',
      };

      const mockFrom = jest.fn((table: string) => {
        if (table === 'orders') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: existingPendingOrder, error: null }),
              }),
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                neq: jest.fn().mockReturnValue({
                  select: jest.fn().mockReturnValue({
                    maybeSingle: jest.fn().mockResolvedValue({ data: updatedOrder, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      (createSupabaseAdminClient as jest.Mock).mockReturnValue({
        from: mockFrom,
      });

      (linkOrCreateCustomer as jest.Mock).mockResolvedValue({ id: 'cust_abc', user_id: 'user_123' });
      (clearUserCart as jest.Mock).mockResolvedValue(true);
      (sendOrderReceiptEmail as jest.Mock).mockResolvedValue({ success: true });

      const req = new Request('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: createSignedHeaders(payload),
        body: payload,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.status).toBe('fulfilled');
      expect(linkOrCreateCustomer).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'user@studiomaya.com' }),
        '+919876543210'
      );
      expect(clearUserCart).toHaveBeenCalledWith('user_123');
      expect(sendOrderReceiptEmail).toHaveBeenCalledWith('ord_uuid_pending', expect.anything());
    });

    it('fulfills pending order on order.paid event properly', async () => {
      const payload = JSON.stringify({
        event: 'order.paid',
        payload: {
          order: {
            entity: {
              id: 'order_paid_event_1',
              amount_paid: 29900,
              status: 'paid',
            },
          },
          payment: {
            entity: {
              id: 'pay_event_123',
            },
          },
        },
      });

      const existingPendingOrder = {
        id: 'ord_uuid_event',
        status: 'pending',
        amount: 299,
        customer_email: 'buyer2@studiomaya.com',
        customer_name: 'Buyer Two',
        user_id: 'user_456',
      };

      const updatedOrder = {
        id: 'ord_uuid_event',
        amount: 299,
        customer_email: 'buyer2@studiomaya.com',
        customer_name: 'Buyer Two',
        user_id: 'user_456',
      };

      const mockFrom = jest.fn((table: string) => {
        if (table === 'orders') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: existingPendingOrder, error: null }),
              }),
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                neq: jest.fn().mockReturnValue({
                  select: jest.fn().mockReturnValue({
                    maybeSingle: jest.fn().mockResolvedValue({ data: updatedOrder, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      (createSupabaseAdminClient as jest.Mock).mockReturnValue({
        from: mockFrom,
      });

      (linkOrCreateCustomer as jest.Mock).mockResolvedValue({ id: 'cust_xyz', user_id: 'user_456' });
      (clearUserCart as jest.Mock).mockResolvedValue(true);
      (sendOrderReceiptEmail as jest.Mock).mockResolvedValue({ success: true });

      const req = new Request('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: createSignedHeaders(payload),
        body: payload,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.status).toBe('fulfilled');
      expect(sendOrderReceiptEmail).toHaveBeenCalledWith('ord_uuid_event', expect.anything());
    });
  });
});
