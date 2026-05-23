import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/api';
import { COOKIE_NAME } from '@/lib/auth';

/**
 * Proxies a login to the API, then stores the returned JWT in an httpOnly
 * cookie on the web app's own origin so middleware can read it.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: body.email, password: body.password }),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'Cannot reach the API.' }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  const data = (await res.json()) as {
    accessToken: string;
    principal: { role: string };
  };

  (await cookies()).set(COOKIE_NAME, data.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24, // 1 day — keep in step with the API's JWT_EXPIRES_IN
  });

  return NextResponse.json({ role: data.principal.role });
}
