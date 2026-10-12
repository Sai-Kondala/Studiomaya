import { GET, POST, DELETE } from '@/app/api/cart/route';
import { POST as cleanupPOST } from '@/app/api/cart/cleanup/route';
import { getAuthenticatedUser } from '@/lib/supabaseServer';
import { cleanupExpiredCarts } from '@/lib/cartService';

jest.mock('@/lib/supabaseServer', () => ({
  getAuthenticatedUser: jest.fn(),
}));

jest.mock('@/lib/cartService', () => ({
  ...jest.requireActual('@/lib/cartService'),
  cleanupExpiredCarts: jest.fn(),
  getUserCartItems: jest.fn().mockResolvedValue({ items: [], expired: false }),
  addProductToCart: jest.fn().mockResolvedValue(true),
  removeProductFromCart: jest.fn().mockResolvedValue(true),
  clearUserCart: jest.fn().mockResolvedValue(true),
}));

describe('Cart API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/cart should return authenticated: false for guest visitors', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(null);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.authenticated).toBe(false);
    expect(data.items).toEqual([]);
  });

  it('POST /api/cart should reject unauthenticated requests with 401', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(null);

    const req = new Request('http://localhost/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', productId: 'p1' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('DELETE /api/cart should reject unauthenticated requests with 401', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(null);

    const res = await DELETE();
    expect(res.status).toBe(401);
  });

  it('POST /api/cart/cleanup should execute cleanup and return count', async () => {
    (cleanupExpiredCarts as jest.Mock).mockResolvedValue(3);

    const res = await cleanupPOST();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.cleanedCount).toBe(3);
  });
});
