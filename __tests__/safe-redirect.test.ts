import { getSafeRedirectUrl } from '@/lib/safeRedirect';

describe('Safe Redirect Utility (getSafeRedirectUrl)', () => {
  it('allows safe relative paths starting with /', () => {
    expect(getSafeRedirectUrl('/account')).toBe('/account');
    expect(getSafeRedirectUrl('/account/orders')).toBe('/account/orders');
    expect(getSafeRedirectUrl('/cart-checkout?step=2')).toBe('/cart-checkout?step=2');
    expect(getSafeRedirectUrl('/products/template-123#reviews')).toBe('/products/template-123#reviews');
  });

  it('falls back to default /account for missing, empty, or whitespace inputs', () => {
    expect(getSafeRedirectUrl(null)).toBe('/account');
    expect(getSafeRedirectUrl(undefined)).toBe('/account');
    expect(getSafeRedirectUrl('')).toBe('/account');
    expect(getSafeRedirectUrl('   ')).toBe('/account');
  });

  it('respects a custom fallback if provided', () => {
    expect(getSafeRedirectUrl(null, '/custom')).toBe('/custom');
    expect(getSafeRedirectUrl('', '/custom')).toBe('/custom');
  });

  it('blocks absolute URLs and external origins (open redirect prevention)', () => {
    expect(getSafeRedirectUrl('https://evil.com')).toBe('/account');
    expect(getSafeRedirectUrl('http://attacker.com/steal')).toBe('/account');
    expect(getSafeRedirectUrl('//evil.com')).toBe('/account');
    expect(getSafeRedirectUrl('//attacker.com/malicious')).toBe('/account');
    expect(getSafeRedirectUrl('https://studiomaya.org.evil.com')).toBe('/account');
  });

  it('blocks backslash evasion techniques', () => {
    expect(getSafeRedirectUrl('/\\evil.com')).toBe('/account');
    expect(getSafeRedirectUrl('\\evil.com')).toBe('/account');
    expect(getSafeRedirectUrl('/account\\evil')).toBe('/account');
  });

  it('blocks dangerous protocol schemes (javascript, data, vbscript)', () => {
    expect(getSafeRedirectUrl('javascript:alert(1)')).toBe('/account');
    expect(getSafeRedirectUrl('data:text/html,<script>alert(1)</script>')).toBe('/account');
    expect(getSafeRedirectUrl('vbscript:msgbox(1)')).toBe('/account');
  });
});
