import { linkGuestOrdersForUser, linkOrCreateCustomer } from '@/lib/customer';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

jest.mock('@/lib/supabaseAdmin', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

describe('Customer & Guest Orders Linking (lib/customer.ts)', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('linkGuestOrdersForUser', () => {
    it('links unassigned guest orders (user_id IS NULL) to verified customer', async () => {
      const updateFilterSpy: any = {
        is: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: [{ id: 'order_guest_1' }, { id: 'order_guest_2' }],
          error: null,
        }),
      };

      const ordersTableSpy: any = {
        update: jest.fn().mockReturnValue(updateFilterSpy),
      };

      const customersTableSpy: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: 'cust_abc' },
          error: null,
        }),
      };

      mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'orders') return ordersTableSpy;
          if (table === 'customers') return customersTableSpy;
          return {};
        }),
      };

      (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockSupabase);

      const count = await linkGuestOrdersForUser('user_123', 'Customer@Example.COM');

      expect(count).toBe(2);
      expect(ordersTableSpy.update).toHaveBeenCalledWith({
        user_id: 'user_123',
        customer_id: 'cust_abc',
      });
      expect(updateFilterSpy.is).toHaveBeenCalledWith('user_id', null);
      expect(updateFilterSpy.eq).toHaveBeenCalledWith('customer_email', 'customer@example.com');
    });

    it('strictly restricts linking to orders where user_id IS NULL (never reassigns existing user orders)', async () => {
      const updateFilterSpy: any = {
        is: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      const ordersTableSpy: any = {
        update: jest.fn().mockReturnValue(updateFilterSpy),
      };

      mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'orders') return ordersTableSpy;
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          };
        }),
      };

      (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockSupabase);

      await linkGuestOrdersForUser('user_new', 'test@example.com');

      // Crucial security requirement: MUST filter by .is('user_id', null)
      expect(updateFilterSpy.is).toHaveBeenCalledWith('user_id', null);
    });

    it('does not fail if user or email is empty or invalid', async () => {
      const countEmptyId = await linkGuestOrdersForUser('', 'test@example.com');
      const countEmptyEmail = await linkGuestOrdersForUser('user_123', '');

      expect(countEmptyId).toBe(0);
      expect(countEmptyEmail).toBe(0);
      expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    });

    it('links orders even if the customer name differs from previous guest order name', async () => {
      // The function operates solely on verified email matching, not customer name
      const updateFilterSpy: any = {
        is: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: [{ id: 'order_different_name' }],
          error: null,
        }),
      };

      const ordersTableSpy: any = {
        update: jest.fn().mockReturnValue(updateFilterSpy),
      };

      mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'orders') return ordersTableSpy;
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          };
        }),
      };

      (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockSupabase);

      const count = await linkGuestOrdersForUser('user_123', 'guest.buyer@domain.com');
      expect(count).toBe(1);
      // Query filter is by normalized email only, not customer_name
      expect(updateFilterSpy.eq).toHaveBeenCalledWith('customer_email', 'guest.buyer@domain.com');
    });
  });

  describe('linkOrCreateCustomer', () => {
    it('returns existing customer profile if already linked to user_id', async () => {
      const customersTableSpy: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: 'cust_1', user_id: 'user_1', email: 'user@example.com', full_name: 'Existing User' },
          error: null,
        }),
      };

      mockSupabase = {
        from: jest.fn(() => customersTableSpy),
      };
      (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockSupabase);

      const result = await linkOrCreateCustomer({
        id: 'user_1',
        email: 'user@example.com',
        user_metadata: { full_name: 'New Name' },
      });

      expect(result).toEqual({
        id: 'cust_1',
        user_id: 'user_1',
        email: 'user@example.com',
        full_name: 'Existing User',
      });
      // Should not update or insert because it was already linked
      expect(customersTableSpy.update).toBeUndefined();
    });

    it('links existing email record to user_id without duplicating', async () => {
      const selectByUserSpy: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null, // not found by user_id
          error: null,
        }),
      };

      const selectByEmailSpy: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: 'cust_guest', user_id: null, email: 'guest@example.com', full_name: 'Guest Buyer' },
          error: null,
        }),
      };

      const updateSpy: any = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'cust_guest', user_id: 'user_new', email: 'guest@example.com', full_name: 'Guest Buyer' },
          error: null,
        }),
      };

      let callCount = 0;
      mockSupabase = {
        from: jest.fn(() => {
          callCount++;
          if (callCount === 1) return selectByUserSpy;
          if (callCount === 2) return selectByEmailSpy;
          return updateSpy;
        }),
      };
      (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockSupabase);

      const result = await linkOrCreateCustomer({
        id: 'user_new',
        email: 'guest@example.com',
        user_metadata: { full_name: 'Registered Name' },
      });

      expect(result).toBeDefined();
      expect(result?.user_id).toBe('user_new');
      expect(result?.id).toBe('cust_guest');
    });
  });
});
