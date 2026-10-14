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
              currency: 'INR',
              status: 'captured',
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

    it('rejects with 400 if payment amount does not match stored order total', async () => {
      const payload = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_mismatch',
              order_id: 'order_amount_mismatch',
              amount: 10000, // 100 INR
              currency: 'INR',
              status: 'captured',
            },
          },
        },
      });

      const existingOrder = {
        id: 'ord_uuid_expensive',
        status: 'pending',
        amount: 499, // Expecting 49900 paise
        customer_email: 'buyer@studiomaya.com',
      };

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: existingOrder, error: null }),
          }),
        }),
      });

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

      expect(res.status).toBe(400);
      expect(data.error).toContain('Payment amount does not match');
      expect(sendOrderReceiptEmail).not.toHaveBeenCalled();
    });

    it('rejects with 400 if payment currency is not INR', async () => {
      const payload = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_usd',
              order_id: 'order_usd',
              amount: 49900,
              currency: 'USD',
              status: 'captured',
            },
          },
        },
      });

      const req = new Request('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: createSignedHeaders(payload),
        body: payload,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('Payment currency does not match INR');
    });

    it('rejects with 400 if payment entity order_id does not match event order', async () => {
      const payload = JSON.stringify({
        event: 'order.paid',
        payload: {
          order: {
            entity: {
              id: 'order_expected_123',
              amount_paid: 49900,
              currency: 'INR',
              status: 'paid',
            },
          },
          payment: {
            entity: {
              id: 'pay_foreign_123',
              order_id: 'order_completely_different',
            },
          },
        },
      });

      const req = new Request('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: createSignedHeaders(payload),
        body: payload,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('Payment entity order_id does not match');
    });

    it('ignores payment if status is not captured', async () => {
      const payload = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_pending_status',
              order_id: 'order_test_pending',
              amount: 49900,
              currency: 'INR',
              status: 'authorized', // Not captured
            },
          },
        },
      });

      const req = new Request('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: createSignedHeaders(payload),
        body: payload,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.ignored).toContain('not captured');
      expect(sendOrderReceiptEmail).not.toHaveBeenCalled();
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
              currency: 'INR',
              status: 'captured',
            },
          },
        },
      });

      const existingOrder = {
        id: 'ord_uuid_1',
        status: 'paid',
        amount: 500,
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

    it('deduplicates duplicate event IDs reliably', async () => {
      const uniqueEventId = `event_unique_${Date.now()}`;
      const payload = JSON.stringify({
        id: uniqueEventId,
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_capture_dedup',
              order_id: 'order_dedup_1',
              amount: 49900,
              currency: 'INR',
              status: 'captured',
            },
          },
        },
      });

      const existingPendingOrder = {
        id: 'ord_uuid_dedup',
        status: 'pending',
        amount: 499,
        customer_email: 'user@studiomaya.com',
        customer_name: 'Studio Maya Buyer',
      };

      const updatedOrder = {
        id: 'ord_uuid_dedup',
        amount: 499,
        customer_email: 'user@studiomaya.com',
      };

      const mockFrom = jest.fn((table: string) => {
        if (table === 'processed_webhook_events') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
            insert: jest.fn().mockResolvedValue({ error: null }),
          };
        }
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
      (sendOrderReceiptEmail as jest.Mock).mockResolvedValue({ success: true });

      // First delivery: processes successfully
      const req1 = new Request('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: createSignedHeaders(payload),
        body: payload,
      });
      const res1 = await POST(req1);
      const data1 = await res1.json();
      expect(res1.status).toBe(200);
      expect(data1.status).toBe('fulfilled');

      // Second delivery with same event ID: returns event_already_processed without reprocessing
      const req2 = new Request('http://localhost:3000/api/webhooks/razorpay', {
        method: 'POST',
        headers: createSignedHeaders(payload),
        body: payload,
      });
      const res2 = await POST(req2);
      const data2 = await res2.json();
      expect(res2.status).toBe(200);
      expect(data2.status).toBe('event_already_processed');
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
              currency: 'INR',
              status: 'captured',
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
        if (table === 'processed_webhook_events') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
            insert: jest.fn().mockResolvedValue({ error: null }),
          };
        }
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
              currency: 'INR',
              status: 'paid',
            },
          },
          payment: {
            entity: {
              id: 'pay_event_123',
              order_id: 'order_paid_event_1',
              currency: 'INR',
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
        if (table === 'processed_webhook_events') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
            insert: jest.fn().mockResolvedValue({ error: null }),
          };
        }
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
