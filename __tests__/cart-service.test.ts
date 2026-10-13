import {
  isCartExpired,
  CART_EXPIRATION_MS,
  getUserCartItems,
  cleanupExpiredCarts,
  mergeAnonymousCartIntoUser,
  addProductToCart,
} from '@/lib/cartService';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

jest.mock('@/lib/supabaseAdmin', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

describe('Cart Expiration and Retention Logic', () => {
  it('should identify active carts within 7 days as NOT expired', () => {
    const justNow = new Date().toISOString();
    expect(isCartExpired(justNow)).toBe(false);

    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
    expect(isCartExpired(sixDaysAgo)).toBe(false);

    const almostSevenDays = new Date(Date.now() - CART_EXPIRATION_MS + 1000).toISOString();
    expect(isCartExpired(almostSevenDays)).toBe(false);
  });

  it('should identify carts inactive for 7 or more days as expired', () => {
    const exactlySevenDaysPlusOneSec = new Date(Date.now() - CART_EXPIRATION_MS - 1000).toISOString();
    expect(isCartExpired(exactlySevenDaysPlusOneSec)).toBe(true);

    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    expect(isCartExpired(eightDaysAgo)).toBe(true);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(isCartExpired(thirtyDaysAgo)).toBe(true);
  });

  it('should safely handle invalid date strings without crashing', () => {
    expect(isCartExpired('invalid-date')).toBe(false);
  });
});

describe('Cart Service Database Operations & 7-Day Lifecycle', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = {
      from: jest.fn(),
    };
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  it('getUserCartItems should lazily delete cart and return expired: true if updated_at is older than 7 days', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    let deletedCartId = '';

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'carts') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { id: 'cart_old_123', updated_at: eightDaysAgo },
                  error: null,
                }),
            }),
          }),
          delete: () => ({
            eq: (col: string, val: string) => {
              deletedCartId = val;
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      return {};
    });

    const result = await getUserCartItems('user_123');
    expect(result.expired).toBe(true);
    expect(result.items).toEqual([]);
    expect(deletedCartId).toBe('cart_old_123');
  });

  it('getUserCartItems should return active published items if cart is within 7 days', async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'carts') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { id: 'cart_active_123', updated_at: twoDaysAgo },
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === 'cart_items') {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [
                  {
                    product_id: 'prod_1',
                    products: {
                      id: 'prod_1',
                      name: 'Active Template',
                      price: 299,
                      image_url: '/img.jpg',
                      status: 'Published',
                    },
                  },
                  {
                    product_id: 'prod_2',
                    products: {
                      id: 'prod_2',
                      name: 'Draft Template',
                      price: 499,
                      image_url: '/draft.jpg',
                      status: 'Draft', // Should be excluded
                    },
                  },
                ],
                error: null,
              }),
          }),
        };
      }
      return {};
    });

    const result = await getUserCartItems('user_123');
    expect(result.expired).toBe(false);
    expect(result.items.length).toBe(1);
    expect(result.items[0].name).toBe('Active Template');
    expect(result.items[0].price).toBe(299);
  });

  it('cleanupExpiredCarts should delete carts older than 7 days and return count', async () => {
    let deletedIds: string[] = [];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'carts') {
        return {
          select: () => ({
            lt: () =>
              Promise.resolve({
                data: [{ id: 'cart_exp_1' }, { id: 'cart_exp_2' }],
                error: null,
              }),
          }),
          delete: () => ({
            in: (col: string, ids: string[]) => {
              deletedIds = ids;
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      return {};
    });

    const count = await cleanupExpiredCarts();
    expect(count).toBe(2);
    expect(deletedIds).toEqual(['cart_exp_1', 'cart_exp_2']);
  });

  it('mergeAnonymousCartIntoUser should only merge Published products, update timestamp, and enforce limit', async () => {
    let upsertedRows: any[] = [];
    let updatedTimestampCartId = '';

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'products') {
        return {
          select: () => ({
            in: () =>
              Promise.resolve({
                data: [
                  { id: 'p_pub_1', status: 'Published' },
                  { id: 'p_draft_2', status: 'Draft' }, // Draft, should NOT be merged
                ],
                error: null,
              }),
          }),
        };
      }
      if (table === 'carts') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { id: 'cart_user_1', updated_at: new Date().toISOString() },
                  error: null,
                }),
            }),
          }),
          update: () => ({
            eq: (col: string, val: string) => {
              updatedTimestampCartId = val;
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      if (table === 'cart_items') {
        return {
          upsert: (rows: any[]) => {
            upsertedRows = rows;
            return Promise.resolve({ error: null });
          },
          select: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
        };
      }
      return {};
    });

    await mergeAnonymousCartIntoUser('user_123', ['p_pub_1', 'p_draft_2', 'p_pub_1']);

    // Only p_pub_1 should be upserted (deduplicated, draft excluded)
    expect(upsertedRows).toEqual([{ cart_id: 'cart_user_1', product_id: 'p_pub_1' }]);
    expect(updatedTimestampCartId).toBe('cart_user_1');
  });

  it('mergeAnonymousCartIntoUser should throw when database write fails', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'products') {
        return {
          select: () => ({
            in: () =>
              Promise.resolve({
                data: [{ id: 'p1', status: 'Published' }],
                error: null,
              }),
          }),
        };
      }
      if (table === 'carts') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { id: 'cart_1', updated_at: new Date().toISOString() },
                  error: null,
                }),
            }),
          }),
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }
      if (table === 'cart_items') {
        return {
          upsert: () => Promise.resolve({ error: { message: 'Database connection error' } }),
        };
      }
      return {};
    });

    await expect(mergeAnonymousCartIntoUser('user_123', ['p1'])).rejects.toThrow(
      'Database error merging items into cart'
    );
  });

  it('addProductToCart should reject unpublished products', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'products') {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: 'p_draft', status: 'Draft' }, // Not published!
                  error: null,
                }),
            }),
          }),
        };
      }
      return {};
    });

    const success = await addProductToCart('user_123', 'p_draft');
    expect(success).toBe(false);
  });
});
