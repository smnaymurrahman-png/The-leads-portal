import { type NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, ROLE_HOME, verifyToken } from '@/lib/auth';

/**
 * Routing proxy (Next.js 16 — the renamed `middleware` convention).
 *
 * Routes each request by role:
 *  - unauthenticated  → role areas bounce to /login
 *  - authenticated    → /login bounces to the role's dashboard
 *  - authenticated    → another role's area bounces to the role's dashboard
 *
 * This is UX-level gating. The API independently enforces RBAC on every call.
 */

/** All role-area path roots: ['/super-admin', '/admin', '/agent', '/client']. */
const ROLE_AREAS = Object.values(ROLE_HOME);

/** True when `pathname` is exactly `area` or a sub-path of it. */
function inArea(pathname: string, area: string): boolean {
  return pathname === area || pathname.startsWith(`${area}/`);
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const claims = token ? await verifyToken(token) : null;

  const isRoleArea = ROLE_AREAS.some((area) => inArea(pathname, area));

  if (!claims) {
    if (isRoleArea) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  const home = ROLE_HOME[claims.role];

  if (pathname === '/login' || pathname === '/') {
    return NextResponse.redirect(new URL(home, request.url));
  }

  if (isRoleArea && !inArea(pathname, home)) {
    return NextResponse.redirect(new URL(home, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/super-admin/:path*', '/admin/:path*', '/agent/:path*', '/client/:path*'],
};
