import { GET } from '@/app/api/account/download/route';
import { getAuthenticatedUser } from '@/lib/supabaseServer';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

jest.mock('@/lib/supabaseServer', () => ({
  getAuthenticatedUser: jest.fn(),
}));

jest.mock('@/lib/supabaseAdmin', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

describe('GET /api/account/download', () => {
  let mockSupabaseAdmin: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabaseAdmin = {
      from: jest.fn(),
      storage: {
        from: jest.fn().mockReturnValue({
          createSignedUrl: jest.fn().mockResolvedValue({
            data: { signedUrl: 'https://storage.supabase.co/signed/product.pdf' },
            error: null,
          }),
        }),
      },
    };

    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockSupabaseAdmin);
  });

  const createRequest = (params: { orderId?: string; productId?: string }) => {
    const url = new URL('http://localhost/api/account/download');
    if (params.orderId) url.searchParams.set('orderId', params.orderId);
    if (params.productId) url.searchParams.set('productId', params.productId);
    return new Request(url.toString(), { method: 'GET' });
  };

  it('should reject unauthenticated download requests with 401', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(null);

    const req = createRequest({ orderId: 'order_1', productId: 'prod_1' });
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toContain('Please sign in');
  });

  it('should forbid downloading an order belonging to another customer with 403', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue({
      id: 'user_attacker',
      email: 'attacker@example.com',
    });

    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    id: 'order_victim',
                    status: 'paid',
                    customer_email: 'victim@example.com', // different email
                  },
                  error: null,
                }),
            }),
          }),
        };
      }
      return {};
    });

    const req = createRequest({ orderId: 'order_victim', productId: 'prod_1' });
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain('do not have permission');
  });

  it('should forbid downloading an order that is not paid with 403', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue({
      id: 'user_legit',
      email: 'legit@example.com',
    });

    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    id: 'order_pending',
                    status: 'pending', // Not paid!
                    customer_email: 'legit@example.com',
                  },
                  error: null,
                }),
            }),
          }),
        };
      }
      return {};
    });

    const req = createRequest({ orderId: 'order_pending', productId: 'prod_1' });
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain('confirmed, paid purchases');
  });

  it('should successfully issue a signed URL redirect for a verified paid order by customer', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue({
      id: 'user_legit',
      email: 'legit@example.com',
    });

    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    id: 'order_paid',
                    status: 'paid',
                    customer_email: 'legit@example.com',
                  },
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === 'order_items') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: { id: 'item_1', order_id: 'order_paid', product_id: 'prod_1' },
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      if (table === 'products') {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: 'prod_1', name: 'Product 1', pdf_url: 'private/template.pdf' },
                  error: null,
                }),
            }),
          }),
        };
      }
      return {};
    });

    const req = createRequest({ orderId: 'order_paid', productId: 'prod_1' });
    const res = await GET(req);

    // Secure redirect to authorized short-lived signed URL
    expect([302, 307]).toContain(res.status);
    expect(res.headers.get('location')).toBe('https://storage.supabase.co/signed/product.pdf');
  });
});
