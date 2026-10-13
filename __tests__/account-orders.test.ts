import CustomerOrdersPage from '@/app/account/orders/page';
import { getAuthenticatedUser } from '@/lib/supabaseServer';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { redirect } from 'next/navigation';

jest.mock('@/lib/supabaseServer', () => ({
  getAuthenticatedUser: jest.fn(),
}));

jest.mock('@/lib/supabaseAdmin', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

describe('CustomerOrdersPage Ownership & Pagination', () => {
  let mockSupabase: any;
  let countQuerySpy: any;
  let selectQuerySpy: any;

  beforeEach(() => {
    jest.clearAllMocks();

    countQuerySpy = {
      select: jest.fn().mockReturnThis(),
      or: jest.fn().mockResolvedValue({ count: 25, error: null }),
    };

    selectQuerySpy = {
      select: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue({
        data: Array.from({ length: 10 }, (_, i) => ({
          id: `order_${i + 1}`,
          amount: 599,
          status: 'paid',
          created_at: new Date().toISOString(),
          razorpay_order_id: `rzp_${i + 1}`,
          razorpay_payment_id: `pay_${i + 1}`,
          user_id: 'user_123',
          customer_email: 'buyer@example.com',
        })),
        error: null,
      }),
    };

    mockSupabase = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'orders') {
          return {
            select: jest.fn().mockImplementation((fields: string, opts?: any) => {
              if (opts?.count === 'exact') {
                return countQuerySpy;
              }
              return selectQuerySpy;
            }),
          };
        }
        if (table === 'order_items') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return {};
      }),
    };

    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  it('redirects to login if user is unauthenticated', async () => {
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(null);

    await CustomerOrdersPage({ searchParams: Promise.resolve({}) });

    expect(redirect).toHaveBeenCalledWith('/login?next=/account/orders');
  });

  it('enforces ownership filtering before pagination and calculates total count accurately', async () => {
    const user = { id: 'user_123', email: 'BUYER@Example.com ' };
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(user);

    await CustomerOrdersPage({ searchParams: Promise.resolve({ page: '1' }) });

    const expectedOwnershipFilter =
      'user_id.eq.user_123,and(user_id.is.null,customer_email.ilike.buyer@example.com)';

    // Verify count query strictly applies ownership filter
    expect(countQuerySpy.or).toHaveBeenCalledWith(expectedOwnershipFilter);

    // Verify paginated query strictly applies ownership filter before range
    expect(selectQuerySpy.or).toHaveBeenCalledWith(expectedOwnershipFilter);
    expect(selectQuerySpy.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(selectQuerySpy.range).toHaveBeenCalledWith(0, 9);
  });

  it('calculates second page pagination offset accurately', async () => {
    const user = { id: 'user_123', email: 'buyer@example.com' };
    (getAuthenticatedUser as jest.Mock).mockResolvedValue(user);

    await CustomerOrdersPage({ searchParams: Promise.resolve({ page: '2' }) });

    expect(selectQuerySpy.range).toHaveBeenCalledWith(10, 19);
  });
});
