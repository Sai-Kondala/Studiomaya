import { POST } from '@/app/api/cart-checkout/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import Razorpay from 'razorpay';

// Mock dependencies
jest.mock('@/lib/supabaseAdmin', () => ({
  createSupabaseAdminClient: jest.fn(),
}));
jest.mock('razorpay');

describe('POST /api/cart-checkout', () => {
  let mockSupabase: any;
  let mockRazorpayOrdersCreate: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set required environment variables
    process.env.RAZORPAY_KEY_ID = 'test_key';
    process.env.RAZORPAY_KEY_SECRET = 'test_secret';

    mockSupabase = {
      from: jest.fn(),
    };

    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockSupabase);

    // Mock Razorpay
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

  it('should process cart checkout successfully', async () => {
    const mockFrom = mockSupabase.from as jest.Mock;
    
    mockFrom.mockImplementation((table: string) => {
      if (table === 'customers') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: 'cust_123' } }),
            }),
          }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      if (table === 'products') {
        return {
          select: () => ({
            in: () => Promise.resolve({ 
              data: [
                { id: 'prod_1', price: 100, name: 'P1' },
                { id: 'prod_2', price: 200, name: 'P2' }
              ], 
              error: null 
            }),
          }),
        };
      }
      if (table === 'orders') {
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'order_123' }, error: null }),
            }),
          }),
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
    // Total should be 300
    expect(data.amount).toBe(30000); 
    expect(mockRazorpayOrdersCreate).toHaveBeenCalledWith(expect.objectContaining({
      amount: 30000,
    }));
  });
});
