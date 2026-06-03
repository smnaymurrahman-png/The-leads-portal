import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Short-lived URL-signing tokens.
 *
 * Returned by upload endpoints, consumed by download endpoints. The token
 * binds the caller's principal, the resource id, an "intent" (e.g.
 * `payment_proof` / `invoice_pdf`), and an expiry — verified server-side
 * before any file bytes leave the server.
 *
 *   token = base64url(payload) + "." + hex(HMAC-SHA256(secret, payload))
 *   payload = `${intent}|${resourceId}|${principalId}|${expSeconds}`
 *
 * The token is sized for query-string transport (< 200 chars) so the web
 * app can embed it in `<img src>` without indirection.
 */

const SEP = '|';

export interface SignedUrlClaims {
  intent: string;
  resourceId: string;
  principalId: string;
  expSeconds: number;
}

export function signResource(claims: SignedUrlClaims, secret: string): string {
  const payload = [claims.intent, claims.resourceId, claims.principalId, String(claims.expSeconds)].join(SEP);
  const encoded = Buffer.from(payload, 'utf8').toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return `${encoded}.${sig}`;
}

/**
 * Returns the claims when `token` is well-formed, signed by `secret`, has not
 * expired, and matches the expected `intent` and `resourceId`. Returns null
 * otherwise — callers should treat null as 403.
 */
export function verifyResource(
  token: string | undefined,
  expectedIntent: string,
  expectedResourceId: string,
  secret: string,
  now: number = Math.floor(Date.now() / 1000),
): SignedUrlClaims | null {
  if (!token || typeof token !== 'string') {
    return null;
  }
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) {
    return null;
  }
  const encoded = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);

  let payload: string;
  try {
    payload = Buffer.from(encoded, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const parts = payload.split(SEP);
  if (parts.length !== 4) {
    return null;
  }
  const [intent, resourceId, principalId, expSecondsStr] = parts;
  const expSeconds = Number.parseInt(expSecondsStr, 10);
  if (!Number.isFinite(expSeconds) || expSeconds <= now) {
    return null;
  }
  if (intent !== expectedIntent || resourceId !== expectedResourceId) {
    return null;
  }

  const expectedSig = createHmac('sha256', secret).update(payload).digest('hex');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  const providedBuf = Buffer.from(providedSig, 'utf8');
  if (expectedBuf.length !== providedBuf.length) {
    return null;
  }
  if (!timingSafeEqual(expectedBuf, providedBuf)) {
    return null;
  }

  return { intent, resourceId, principalId, expSeconds };
}
