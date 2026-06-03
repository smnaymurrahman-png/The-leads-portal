import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/api';
import { COOKIE_NAME } from '@/lib/auth';

type Ctx = { params: Promise<{ path: string[] }> };

/**
 * Generic authenticated proxy to the NestJS API. Reads the httpOnly
 * access-token cookie server-side and forwards it as a Bearer header, so
 * Client Components never see the token.
 *
 * Handles three body shapes:
 *   - JSON (the default) — forwarded as text with `application/json`.
 *   - multipart/form-data (file uploads, e.g. payment proof) — forwarded as
 *     raw bytes with the original `Content-Type` (which carries the boundary).
 * Responses are streamed back binary-safe (arrayBuffer), so images and PDFs
 * survive the round-trip while JSON responses parse exactly as before.
 */
async function forward(request: Request, ctx: Ctx): Promise<NextResponse> {
  const { path } = await ctx.params;
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const search = new URL(request.url).search;
  const incomingType = request.headers.get('content-type') ?? '';
  const isMultipart = incomingType.includes('multipart/form-data');

  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  let body: BodyInit | undefined;
  if (hasBody) {
    if (isMultipart) {
      // Preserve the exact multipart payload + boundary.
      body = await request.arrayBuffer();
      headers['Content-Type'] = incomingType;
    } else {
      body = await request.text();
      headers['Content-Type'] = 'application/json';
    }
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/${path.join('/')}${search}`, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ message: 'Cannot reach the API.' }, { status: 502 });
  }

  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer.byteLength ? buffer : null, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
}

export { forward as GET, forward as POST, forward as PATCH, forward as PUT };
