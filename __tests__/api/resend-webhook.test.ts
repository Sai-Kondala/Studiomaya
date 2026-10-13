import { POST } from '@/app/api/webhooks/resend/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

jest.mock('@/lib/supabaseAdmin', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

describe('POST /api/webhooks/resend', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.RESEND_WEBHOOK_SECRET;

    mockSupabase = {
      from: jest.fn(),
    };
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  const createWebhookRequest = (body: any) => {
    return new Request('http://localhost/api/webhooks/resend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  };

  it('should update order email_delivery_status to delivered on email.delivered event', async () => {
    let updatedPayload: any = null;
    let targetOrderId = '';

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          update: (payload: any) => {
            updatedPayload = payload;
            return {
              eq: (col: string, val: string) => {
                targetOrderId = val;
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }
      return {};
    });

    const event = {
      type: 'email.delivered',
      created_at: new Date().toISOString(),
      data: {
        email_id: 'resend_email_123',
        tags: [{ name: 'order_id', value: 'order_abc_456' }],
      },
    };

    const res = await POST(createWebhookRequest(event));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.received).toBe(true);
    expect(data.status).toBe('delivered');
    expect(targetOrderId).toBe('order_abc_456');
    expect(updatedPayload).toEqual({ email_delivery_status: 'delivered' });
  });

  it('should update order email_delivery_status to bounced on email.bounced event', async () => {
    let updatedPayload: any = null;
    let targetOrderId = '';

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          update: (payload: any) => {
            updatedPayload = payload;
            return {
              eq: (col: string, val: string) => {
                targetOrderId = val;
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }
      return {};
    });

    const event = {
      type: 'email.bounced',
      created_at: new Date().toISOString(),
      data: {
        email_id: 'resend_email_123',
        tags: [{ name: 'order_id', value: 'order_bounce_789' }],
      },
    };

    const res = await POST(createWebhookRequest(event));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe('bounced');
    expect(targetOrderId).toBe('order_bounce_789');
    expect(updatedPayload).toEqual({ email_delivery_status: 'bounced' });
  });

  it('should ignore events without order_id tag gracefully', async () => {
    const event = {
      type: 'email.delivered',
      created_at: new Date().toISOString(),
      data: {
        email_id: 'resend_email_123',
        tags: [],
      },
    };

    const res = await POST(createWebhookRequest(event));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ignored).toContain('No order_id tag found');
  });

  it('should reject malformed JSON with 400', async () => {
    const req = new Request('http://localhost/api/webhooks/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json{{{',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should reject request with 500 if RESEND_WEBHOOK_SECRET is missing in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as any).NODE_ENV = 'production';
      delete process.env.RESEND_WEBHOOK_SECRET;

      const event = {
        type: 'email.delivered',
        data: { tags: [{ name: 'order_id', value: 'order_123' }] },
      };

      const res = await POST(createWebhookRequest(event));
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toContain('Webhook secret is not configured in production');
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
    }
  });

  it('should reject request with 401 if RESEND_WEBHOOK_SECRET is set but signature is invalid', async () => {
    process.env.RESEND_WEBHOOK_SECRET = 'whsec_testsecret1234567890';

    const event = {
      type: 'email.delivered',
      data: { tags: [{ name: 'order_id', value: 'order_123' }] },
    };

    const req = new Request('http://localhost/api/webhooks/resend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'svix-id': 'msg_test123',
        'svix-timestamp': Math.floor(Date.now() / 1000).toString(),
        'svix-signature': 'v1,invalidsignaturehere==',
      },
      body: JSON.stringify(event),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe('Invalid webhook signature.');
  });

  it('should return 500 when Supabase update returns a database error so Resend can retry', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          update: () => ({
            eq: () => Promise.resolve({ error: { message: 'Connection failure to Postgres' } }),
          }),
        };
      }
      return {};
    });

    const event = {
      type: 'email.delivered',
      created_at: new Date().toISOString(),
      data: {
        email_id: 'resend_email_123',
        tags: [{ name: 'order_id', value: 'order_retry_me' }],
      },
    };

    const res = await POST(createWebhookRequest(event));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('Failed to update order email delivery status in database.');
  });
});
