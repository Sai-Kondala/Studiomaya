import { POST } from '@/app/api/create-order/route';
import { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import Razorpay from 'razorpay';

// Mock dependencies
jest.mock('@/lib/supabaseAdmin', () => ({
  createSupabaseAdminClient: jest.fn(),
}));
jest.mock('razorpay');

describe('POST /api/create-order', () => {
  let mockSupabase: any;
  let mockRazorpayOrdersCreate: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set required environment variables
    process.env.RAZORPAY_KEY_ID = 'test_key';
    process.env.RAZORPAY_KEY_SECRET = 'test_secret';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_role_key';

    // Mock Supabase chain
    const mockSingle = jest.fn();
    const mockMaybeSingle = jest.fn();
    const mockEq = jest.fn().mockReturnValue({ single: mockSingle, maybeSingle: mockMaybeSingle });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq, single: mockSingle });
    const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
    
    mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: mockSelect,
        insert: mockInsert,
        update: mockUpdate,
      }),
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
    return new Request('http://localhost/api/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  };

  it('should return 400 if required fields are missing', async () => {
    const req = createRequest({
      customerName: '',
      customerEmail: 'test@example.com',
      productId: 'prod_123',
    });

    const res = await POST(req);
    const data = await res.json();
    
    expect(res.status).toBe(400);
    expect(data.error).toBe('Product and customer details are required.');
  });

  it('should create an order successfully', async () => {
    // Setup specific mock returns for this test case
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
            eq: () => ({
              single: () => Promise.resolve({ data: { price: 500, name: 'Test Product' }, error: null }),
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
      customerName: 'Test User',
      customerEmail: 'test@example.com',
      customerPhone: '9876543210',
      productId: 'prod_123',
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.orderId).toBe('order_rzp_123');
    expect(mockRazorpayOrdersCreate).toHaveBeenCalledWith(expect.objectContaining({
      amount: 50000, // 500 * 100
      currency: 'INR',
    }));
  });
});
