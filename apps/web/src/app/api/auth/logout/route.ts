import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/lib/auth';

/** Clears the access-token cookie. */
export async function POST(): Promise<NextResponse> {
  (await cookies()).delete(COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
