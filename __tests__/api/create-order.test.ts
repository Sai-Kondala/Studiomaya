import { POST } from '@/app/api/create-order/route';
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

describe('POST /api/create-order', () => {
  let mockSupabase: any;
  let mockRazorpayOrdersCreate: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(null);

    process.env.RAZORPAY_KEY_ID = 'test_key';
    process.env.RAZORPAY_KEY_SECRET = 'test_secret';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_role_key';

    const mockSingle = jest.fn();
    const mockMaybeSingle = jest.fn();
    const mockEq = jest.fn().mockReturnValue({ single: mockSingle, maybeSingle: mockMaybeSingle });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq, single: mockSingle });
    const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
    const mockDelete = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
    
    mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: mockSelect,
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
      }),
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

  it('should reject ordering an unpublished/draft product with 404', async () => {
    const mockFrom = mockSupabase.from as jest.Mock;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'products') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { price: 500, name: 'Draft Product', status: 'Draft' },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    const req = createRequest({
      customerName: 'Test User',
      customerEmail: 'test@example.com',
      productId: 'prod_draft',
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain('unavailable for purchase');
  });

  it('should create an order successfully and ignore forged client userId', async () => {
    let insertedOrderPayload: any = null;
    const mockFrom = mockSupabase.from as jest.Mock;
    
    mockFrom.mockImplementation((table: string) => {
      if (table === 'products') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { price: 500, name: 'Test Product', status: 'Published' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'orders') {
        return {
          insert: (payload: any) => {
            insertedOrderPayload = payload;
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
      customerName: 'Test User',
      customerEmail: 'test@example.com',
      customerPhone: '9876543210',
      productId: 'prod_123',
      userId: 'forged_attacker_user_id', // Client attempting to forge user ID
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.orderId).toBe('order_rzp_123');
    // Ensure forged user_id was NOT accepted because getAuthenticatedUser returned null
    expect(insertedOrderPayload?.user_id).toBeUndefined();
  });

  it('should rollback pending order if order_items insertion fails', async () => {
    let deletedOrderId: string | null = null;
    const mockFrom = mockSupabase.from as jest.Mock;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'products') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { price: 500, name: 'Test Product', status: 'Published' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'orders') {
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'order_rollback_123' }, error: null }),
            }),
          }),
          delete: () => ({
            eq: (col: string, val: string) => {
              deletedOrderId = val;
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      if (table === 'order_items') {
        return {
          insert: () => Promise.resolve({ error: { message: 'DB connection failure' } }),
        };
      }
      return {};
    });

    const req = createRequest({
      customerName: 'Test User',
      customerEmail: 'test@example.com',
      productId: 'prod_123',
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toContain('order items could not be saved');
    // Order compensation was triggered
    expect(deletedOrderId).toBe('order_rollback_123');
  });
});
