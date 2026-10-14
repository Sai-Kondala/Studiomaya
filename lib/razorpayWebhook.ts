import crypto from 'crypto';

/**
 * Verifies the cryptographic HMAC-SHA256 signature sent by Razorpay in the x-razorpay-signature header.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  receivedSignature: string | null,
  secret?: string
): boolean {
  if (!secret) return true; // Allowed in dev / test when secret is not configured
  if (!receivedSignature || !/^[a-f\d]{64}$/i.test(receivedSignature)) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'hex');
    const receivedBuf = Buffer.from(receivedSignature, 'hex');

    return expectedBuf.length === receivedBuf.length && crypto.timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}
