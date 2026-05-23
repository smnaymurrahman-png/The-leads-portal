import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/api';
import { COOKIE_NAME } from '@/lib/auth';

type Ctx = { params: Promise<{ path: string[] }> };

/**
 * Generic authenticated proxy to the NestJS API. Reads the httpOnly
 * access-token cookie server-side and forwards it as a Bearer header, so
 * Client Components never see the token. Used by the management screens.
 */
async function forward(request: Request, ctx: Ctx): Promise<NextResponse> {
  const { path } = await ctx.params;
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const search = new URL(request.url).search;

  let res: Response;
  try {
    res = await fetch(`${API_URL}/${path.join('/')}${search}`, {
      method: request.method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      },
      body: hasBody ? await request.text() : undefined,
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ message: 'Cannot reach the API.' }, { status: 502 });
  }

  const text = await res.text();
  return new NextResponse(text || null, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
}

export { forward as GET, forward as POST, forward as PATCH, forward as PUT };
