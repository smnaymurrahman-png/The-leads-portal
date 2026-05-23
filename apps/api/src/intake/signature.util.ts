import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Hex-encoded HMAC-SHA256 of `payload` keyed by `secret`. The WordPress side
 * computes the same value over the exact request body it sends.
 */
export function signPayload(payload: string | Buffer, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Constant-time check of an inbound signature header against the expected
 * HMAC. Accepts an optional `sha256=` prefix. Returns false on any mismatch
 * or when the header is missing.
 */
export function verifySignature(
  payload: Buffer,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature) {
    return false;
  }
  const provided = signature.startsWith('sha256=') ? signature.slice(7) : signature;
  const expectedBuf = Buffer.from(signPayload(payload, secret), 'utf8');
  const providedBuf = Buffer.from(provided, 'utf8');
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return timingSafeEqual(expectedBuf, providedBuf);
}
