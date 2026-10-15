import crypto from 'crypto';

function getSigningKey(secret?: string): string {
  const signingKey =
    secret ||
    process.env.DOWNLOAD_TOKEN_SECRET ||
    process.env.RAZORPAY_KEY_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    (process.env.NODE_ENV === 'test' ? 'test_download_token_secret' : undefined);

  if (!signingKey) {
    throw new Error('DOWNLOAD_TOKEN_SECRET must be configured on the server.');
  }
  return signingKey;
}

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
  const signingKey = getSigningKey(secret);
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
