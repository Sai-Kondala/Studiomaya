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
});
