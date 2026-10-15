import { reconcilePendingOrders } from '@/lib/orderReconciliation';
import { POST as reconcileRoute } from '@/app/api/admin/reconcile-orders/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { verifyAdminSession } from '@/lib/adminAuth';
import { sendOrderReceiptEmail } from '@/lib/orderEmailDelivery';
import Razorpay from 'razorpay';

jest.mock('@/lib/supabaseAdmin');
jest.mock('@/lib/adminAuth');
jest.mock('@/lib/orderEmailDelivery');
jest.mock('@/lib/customer', () => ({
  linkOrCreateCustomer: jest.fn().mockResolvedValue({ id: 'cust_123', user_id: 'user_123' }),
}));
jest.mock('@/lib/cartService', () => ({
  clearUserCart: jest.fn().mockResolvedValue(true),
}));
jest.mock('razorpay');

describe('Order Reconciliation Engine', () => {
  const originalEnv = process.env;
  let mockSupabase: any;
  let mockRazorpayOrdersFetch: any;
  let mockRazorpayOrdersFetchPayments: any;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      RAZORPAY_KEY_ID: 'test_key',
      RAZORPAY_KEY_SECRET: 'test_secret',
    };

    mockRazorpayOrdersFetch = jest.fn();
    mockRazorpayOrdersFetchPayments = jest.fn();
    (Razorpay as unknown as jest.Mock).mockImplementation(() => ({
      orders: {
        fetch: mockRazorpayOrdersFetch,
        fetchPayments: mockRazorpayOrdersFetchPayments,
      },
    }));

    (sendOrderReceiptEmail as jest.Mock).mockResolvedValue({ success: true });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('reconciles paid order captured in Razorpay and triggers fulfillment', async () => {
    const pendingOrder = {
      id: 'ord_stuck_1',
      amount: 499,
      status: 'pending',
      razorpay_order_id: 'order_rzp_stuck',
      customer_email: 'buyer@example.com',
      customer_name: 'Buyer Name',
      customer_phone: '+919876543210',
      user_id: 'user_123',
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 mins ago
    };

    const allUpdates: any[] = [];

    mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'orders') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                lt: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                      data: [pendingOrder],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
            update: jest.fn((payload: any) => {
              allUpdates.push(payload);
              return {
                eq: jest.fn().mockReturnValue({
                  neq: jest.fn().mockReturnValue({
                    select: jest.fn().mockReturnValue({
                      maybeSingle: jest.fn().mockResolvedValue({
                        data: { ...pendingOrder, ...payload },
                        error: null,
                      }),
                    }),
                  }),
                }),
              };
            }),
          };
        }
        return {};
      }),
    };

    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockSupabase);

    mockRazorpayOrdersFetch.mockResolvedValue({
      id: 'order_rzp_stuck',
      status: 'paid',
      amount_paid: 49900,
    });

    mockRazorpayOrdersFetchPayments.mockResolvedValue({
      items: [
        {
          id: 'pay_rzp_captured_99',
          order_id: 'order_rzp_stuck',
          currency: 'INR',
          status: 'captured',
          amount: 49900,
        },
      ],
    });

    const report = await reconcilePendingOrders({ maxAgeMinutes: 15 });

    expect(report.checked).toBe(1);
    expect(report.reconciled).toBe(1);
    expect(report.errors).toHaveLength(0);
    const paidUpdate = allUpdates.find((u) => u.status === 'paid');
    expect(paidUpdate).toBeDefined();
    expect(paidUpdate.status).toBe('paid');
    expect(paidUpdate.razorpay_payment_id).toBe('pay_rzp_captured_99');
    expect(sendOrderReceiptEmail).toHaveBeenCalledWith('ord_stuck_1', mockSupabase);
  });

  it('rejects reconciliation if payment currency is not INR', async () => {
    const pendingOrder = {
      id: 'ord_stuck_currency',
      amount: 499,
      status: 'pending',
      razorpay_order_id: 'order_rzp_usd',
      customer_email: 'buyer@example.com',
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    };

    mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lt: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [pendingOrder],
                  error: null,
                }),
              }),
            }),
          }),
        }),
        update: jest.fn(),
      }),
    };

    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockSupabase);

    mockRazorpayOrdersFetch.mockResolvedValue({ id: 'order_rzp_usd', status: 'paid' });
    mockRazorpayOrdersFetchPayments.mockResolvedValue({
      items: [
        {
          id: 'pay_rzp_usd_1',
          order_id: 'order_rzp_usd',
          currency: 'USD',
          status: 'captured',
          amount: 49900,
        },
      ],
    });

    const report = await reconcilePendingOrders({ maxAgeMinutes: 15 });

    expect(report.checked).toBe(1);
    expect(report.reconciled).toBe(0);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].error).toContain('Currency mismatch');
  });

  it('rejects reconciliation if captured payment amount does not match order amount', async () => {
    const pendingOrder = {
      id: 'ord_stuck_mismatch',
      amount: 499,
      status: 'pending',
      razorpay_order_id: 'order_rzp_mismatch',
      customer_email: 'buyer@example.com',
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    };

    mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'orders') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                lt: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                      data: [pendingOrder],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
            update: jest.fn(),
          };
        }
        return {};
      }),
    };

    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockSupabase);

    mockRazorpayOrdersFetch.mockResolvedValue({
      id: 'order_rzp_mismatch',
      status: 'paid',
    });

    mockRazorpayOrdersFetchPayments.mockResolvedValue({
      items: [
        {
          id: 'pay_rzp_short',
          order_id: 'order_rzp_mismatch',
          currency: 'INR',
          status: 'captured',
          amount: 10000, // ₹100 instead of ₹499
        },
      ],
    });

    const report = await reconcilePendingOrders({ maxAgeMinutes: 15 });

    expect(report.checked).toBe(1);
    expect(report.reconciled).toBe(0);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].error).toContain('Amount mismatch');
    expect(sendOrderReceiptEmail).not.toHaveBeenCalled();
  });

  describe('POST /api/admin/reconcile-orders', () => {
    it('blocks unauthorized access with 401', async () => {
      (verifyAdminSession as jest.Mock).mockRejectedValue(new Error('Unauthorized: Admin privileges required.'));

      const req = new Request('http://localhost:3000/api/admin/reconcile-orders', {
        method: 'POST',
      });

      const res = await reconcileRoute(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
    });

    it('allows authorized admin to trigger reconciliation and receive report', async () => {
      (verifyAdminSession as jest.Mock).mockResolvedValue({
        user: { id: 'admin_1', email: 'admin@studiomaya.com' },
      });

      mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              lt: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }),
      };

      (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockSupabase);

      const req = new Request('http://localhost:3000/api/admin/reconcile-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxAgeMinutes: 20 }),
      });

      const res = await reconcileRoute(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.report).toBeDefined();
    });

    it('allows cron job with valid Authorization: Bearer CRON_SECRET without admin session', async () => {
      process.env.CRON_SECRET = 'super_secret_cron_token_123';
      (verifyAdminSession as jest.Mock).mockRejectedValue(new Error('No admin session'));

      mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              lt: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }),
      };
      (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockSupabase);

      const req = new Request('http://localhost:3000/api/admin/reconcile-orders', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer super_secret_cron_token_123',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ limit: 150, maxAgeMinutes: 3 }), // should be clamped
      });

      const res = await reconcileRoute(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('rejects invalid Authorization: Bearer token when admin session is absent', async () => {
      process.env.CRON_SECRET = 'super_secret_cron_token_123';
      (verifyAdminSession as jest.Mock).mockRejectedValue(new Error('Unauthorized: Admin privileges required.'));

      const req = new Request('http://localhost:3000/api/admin/reconcile-orders', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer wrong_token_forgery',
        },
      });

      const res = await reconcileRoute(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
    });
  });
});
