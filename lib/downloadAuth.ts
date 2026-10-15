import crypto from 'crypto';

/**
 * Generates a cryptographic HMAC-SHA256 token for authorizing guest product downloads.
 * Binds specifically to orderId, productId, and customerEmail.
 */
export function generateGuestDownloadToken(
  orderId: string,
  productId: string,
  customerEmail: string,
  secret?: string
): string {
  const signingKey =
    secret ||
    process.env.RAZORPAY_KEY_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'studiomaya_secure_download_salt';
  const data = `guest_download:${orderId}:${productId}:${customerEmail.trim().toLowerCase()}`;
  return crypto.createHmac('sha256', signingKey).update(data).digest('hex');
}

/**
 * Verifies a guest download token using constant-time comparison to prevent timing attacks.
 */
export function verifyGuestDownloadToken(
  providedToken: string | null | undefined,
  orderId: string,
  productId: string,
  customerEmail: string,
  secret?: string
): boolean {
  if (!providedToken || typeof providedToken !== 'string') return false;
  if (!/^[a-f\d]{64}$/i.test(providedToken)) return false;

  const expectedToken = generateGuestDownloadToken(orderId, productId, customerEmail, secret);
  const expectedBuf = Buffer.from(expectedToken, 'hex');
  const providedBuf = Buffer.from(providedToken, 'hex');

  return (
    expectedBuf.length === providedBuf.length &&
    crypto.timingSafeEqual(expectedBuf, providedBuf)
  );
}
