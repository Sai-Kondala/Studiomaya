import { isCartExpired, CART_EXPIRATION_MS } from '@/lib/cartService';

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
