// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const uid = request.cookies.get('uid')?.value;
  const role = request.cookies.get('role')?.value;
  const pathname = request.nextUrl.pathname;

  const isAuthPage = pathname === '/user/login' || pathname === '/user/signup';
  const isManagePage = pathname.startsWith('/user/manage');

  // 🚫 Not logged in
  if (!uid) {
    if (isAuthPage) return NextResponse.next();
    return NextResponse.redirect(new URL('/user/login', request.url));
  }

  // 🔁 Logged in and trying to visit login/signup
  if (uid && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 🔐 Restrict /user/manage to only master
  if (isManagePage && role !== 'master') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next(); // ✅ Allow other requests
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|.*\\..*).*)'], // match all
};
