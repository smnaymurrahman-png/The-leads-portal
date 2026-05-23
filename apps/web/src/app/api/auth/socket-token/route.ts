import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/lib/auth';

/**
 * Hands the access token to the browser so it can authenticate the Socket.IO
 * connection (the httpOnly cookie itself cannot be read by client JS).
 */
export async function GET(): Promise<NextResponse> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json({ token });
}
