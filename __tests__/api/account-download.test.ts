import { GET } from '@/app/api/account/download/route';
import { getAuthenticatedUser } from '@/lib/supabaseServer';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { generateGuestDownloadToken } from '@/lib/downloadAuth';

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

  const createRequest = (params: { orderId?: string; productId?: string; token?: string }) => {
    const url = new URL('http://localhost/api/account/download');
    if (params.orderId) url.searchParams.set('orderId', params.orderId);
    if (params.productId) url.searchParams.set('productId', params.productId);
    if (params.token) url.searchParams.set('token', params.token);
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

  it('should allow download when ownership matches verified user_id even if email differs', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue({
      id: 'user_matching_id',
      email: 'current_email@example.com',
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
                    user_id: 'user_matching_id', // Matches session ID
                    customer_email: 'old_purchase_email@example.com',
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

    expect([302, 307]).toContain(res.status);
    expect(res.headers.get('location')).toBe('https://storage.supabase.co/signed/product.pdf');
  });

  it('should reject untrusted or malicious template_url with 400', async () => {
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
                  data: {
                    id: 'prod_1',
                    name: 'Product 1',
                    pdf_url: null,
                    template_url: 'http://malicious-phishing-site.com/steal-creds', // untrusted
                  },
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
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('untrusted or invalid');
  });

  it('should allow download when order.user_id matches authenticated user.id', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue({
      id: 'user_owner',
      email: 'owner@example.com',
    });

    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    id: 'order_owned',
                    status: 'paid',
                    customer_email: 'different_email@example.com',
                    user_id: 'user_owner',
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
                maybeSingle: () => Promise.resolve({ data: { id: 'item_1' }, error: null }),
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
                  data: { id: 'prod_1', name: 'Product 1', pdf_url: 'file.pdf' },
                  error: null,
                }),
            }),
          }),
        };
      }
      return {};
    });

    const req = createRequest({ orderId: 'order_owned', productId: 'prod_1' });
    const res = await GET(req);

    expect([302, 307]).toContain(res.status);
    expect(res.headers.get('location')).toBe('https://storage.supabase.co/signed/product.pdf');
  });

  it('should forbid download when order.user_id belongs to another user even if email matches', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue({
      id: 'user_other',
      email: 'shared@example.com',
    });

    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    id: 'order_other_owner',
                    status: 'paid',
                    customer_email: 'shared@example.com',
                    user_id: 'user_original_owner', // assigned to another user!
                  },
                  error: null,
                }),
            }),
          }),
        };
      }
      return {};
    });

    const req = createRequest({ orderId: 'order_other_owner', productId: 'prod_1' });
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain('do not have permission');
  });

  describe('Guest download cryptographic token authorization', () => {
    const guestOrder = {
      id: 'order_guest_123',
      status: 'paid',
      customer_email: 'guest@example.com',
      user_id: null,
    };

    beforeEach(() => {
      (getAuthenticatedUser as jest.Mock).mockResolvedValue(null);
    });

    it('allows unauthenticated guest to download with a valid cryptographic token', async () => {
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'orders') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: guestOrder, error: null }),
              }),
            }),
          };
        }
        if (table === 'order_items') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: { id: 'item_1' }, error: null }),
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
                    data: { id: 'prod_1', name: 'Product 1', pdf_url: 'file.pdf' },
                    error: null,
                  }),
              }),
            }),
          };
        }
        return {};
      });

      const validToken = generateGuestDownloadToken('order_guest_123', 'prod_1', 'guest@example.com');
      const req = createRequest({
        orderId: 'order_guest_123',
        productId: 'prod_1',
        token: validToken,
      });

      const res = await GET(req);
      expect([302, 307]).toContain(res.status);
      expect(res.headers.get('location')).toBe('https://storage.supabase.co/signed/product.pdf');
    });

    it('rejects unauthenticated guest download with an invalid or forged token', async () => {
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'orders') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: guestOrder, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const forgedToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const req = createRequest({
        orderId: 'order_guest_123',
        productId: 'prod_1',
        token: forgedToken,
      });

      const res = await GET(req);
      const data = await res.json();
      expect(res.status).toBe(403);
      expect(data.error).toContain('You do not have permission to access this order');
    });

    it('rejects guest token when attempting to access an account-owned order', async () => {
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'orders') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: {
                      id: 'order_acc_999',
                      status: 'paid',
                      customer_email: 'customer@example.com',
                      user_id: 'user_registered_abc', // order is owned by an account
                    },
                    error: null,
                  }),
              }),
            }),
          };
        }
        return {};
      });

      const token = generateGuestDownloadToken('order_acc_999', 'prod_1', 'customer@example.com');
      const req = createRequest({
        orderId: 'order_acc_999',
        productId: 'prod_1',
        token,
      });

      const res = await GET(req);
      const data = await res.json();
      expect(res.status).toBe(401);
      expect(data.error).toContain('Please sign in to access purchases linked to your account');
    });

    it('rejects guest token if requesting a different product than token authorized', async () => {
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'orders') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: guestOrder, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      // Token generated for prod_1, but request attempts to download prod_2
      const token = generateGuestDownloadToken('order_guest_123', 'prod_1', 'guest@example.com');
      const req = createRequest({
        orderId: 'order_guest_123',
        productId: 'prod_2',
        token,
      });

      const res = await GET(req);
      const data = await res.json();
      expect(res.status).toBe(403);
      expect(data.error).toContain('You do not have permission to access this order');
    });
  });
});
