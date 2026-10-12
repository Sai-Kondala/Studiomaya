import { POST } from '@/app/api/cart-checkout/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/supabaseServer';
import Razorpay from 'razorpay';

jest.mock('@/lib/supabaseAdmin', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

jest.mock('@/lib/supabaseServer', () => ({
  getAuthenticatedUser: jest.fn(),
}));

jest.mock('razorpay');

describe('POST /api/cart-checkout', () => {
  let mockSupabase: any;
  let mockRazorpayOrdersCreate: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(null);

    process.env.RAZORPAY_KEY_ID = 'test_key';
    process.env.RAZORPAY_KEY_SECRET = 'test_secret';

    mockSupabase = {
      from: jest.fn(),
    };

    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockSupabase);

    mockRazorpayOrdersCreate = jest.fn().mockResolvedValue({ id: 'order_rzp_123' });
    (Razorpay as unknown as jest.Mock).mockImplementation(() => ({
      orders: {
        create: mockRazorpayOrdersCreate,
      },
    }));
  });

  const createRequest = (body: any) => {
    return new Request('http://localhost/api/cart-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  };

  it('should return 400 if cart is empty', async () => {
    const req = createRequest({
      productIds: [],
      customerName: 'Test',
      customerEmail: 'test@test.com',
    });

    const res = await POST(req);
    const data = await res.json();
    
    expect(res.status).toBe(400);
    expect(data.error).toBe('Cart is empty.');
  });

  it('should reject cart checkout if item count exceeds 50 limit', async () => {
    const excessiveIds = Array.from({ length: 51 }, (_, i) => `prod_${i}`);
    const req = createRequest({
      productIds: excessiveIds,
      customerName: 'Test User',
      customerEmail: 'test@example.com',
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('limit of 50');
  });

  it('should deduplicate repeated product IDs and calculate total without double charging', async () => {
    let createdPayload: any = null;
    const mockFrom = mockSupabase.from as jest.Mock;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'products') {
        return {
          select: () => ({
            in: () => Promise.resolve({
              data: [
                { id: 'prod_1', price: 100, name: 'P1', status: 'Published' },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'orders') {
        return {
          insert: (payload: any) => {
            createdPayload = payload;
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { id: 'order_123' }, error: null }),
              }),
            };
          },
        };
      }
      if (table === 'order_items') {
        return {
          insert: () => Promise.resolve({ error: null }),
        };
      }
      return {};
    });

    // Pass duplicate 'prod_1' twice
    const req = createRequest({
      productIds: ['prod_1', 'prod_1'],
      customerName: 'Test User',
      customerEmail: 'test@example.com',
      userId: 'forged_user_id',
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.amount).toBe(10000); // 100 * 100 paise, NOT 200
    expect(createdPayload.amount).toBe(100);
    expect(createdPayload.user_id).toBeUndefined(); // Forged ID rejected
  });

  it('should reject cart checkout if any requested product is unpublished or unavailable', async () => {
    const mockFrom = mockSupabase.from as jest.Mock;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'products') {
        return {
          select: () => ({
            in: () => Promise.resolve({
              data: [
                { id: 'prod_1', price: 100, name: 'P1', status: 'Published' },
                { id: 'prod_2', price: 200, name: 'P2', status: 'Draft' }, // Draft!
              ],
              error: null,
            }),
          }),
        };
      }
      return {};
    });

    const req = createRequest({
      productIds: ['prod_1', 'prod_2'],
      customerName: 'Test User',
      customerEmail: 'test@example.com',
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('no longer available');
  });

  it('should process cart checkout successfully and link verified session user', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue({ id: 'verified_user_abc' });

    let createdPayload: any = null;
    const mockFrom = mockSupabase.from as jest.Mock;
    
    mockFrom.mockImplementation((table: string) => {
      if (table === 'products') {
        return {
          select: () => ({
            in: () => Promise.resolve({ 
              data: [
                { id: 'prod_1', price: 100, name: 'P1', status: 'Published' },
                { id: 'prod_2', price: 200, name: 'P2', status: 'Published' }
              ], 
              error: null 
            }),
          }),
        };
      }
      if (table === 'orders') {
        return {
          insert: (payload: any) => {
            createdPayload = payload;
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { id: 'order_123' }, error: null }),
              }),
            };
          },
        };
      }
      if (table === 'order_items') {
        return {
          insert: () => Promise.resolve({ error: null }),
        };
      }
      return {};
    });

    const req = createRequest({
      productIds: ['prod_1', 'prod_2'],
      customerName: 'Test User',
      customerEmail: 'test@example.com',
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.orderId).toBe('order_rzp_123');
    expect(data.amount).toBe(30000); 
    expect(createdPayload.user_id).toBe('verified_user_abc');
  });
});
