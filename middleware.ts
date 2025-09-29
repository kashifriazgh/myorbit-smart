// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const uid = request.cookies.get('uid')?.value;
  const role = request.cookies.get('role')?.value;
  const guestUID = request.cookies.get('guest_uid')?.value;
  const pathname = request.nextUrl.pathname;

  const isAuthPage = pathname === '/user/login' || pathname === '/user/signup';
  const isManagePage = pathname.startsWith('/user/manage');
  const isDashboardPage = pathname === '/user/dashboard';

  // Check if user has any form of authentication (Firebase or Guest)
  const hasAuth = uid || guestUID;

  // 🚫 No authentication at all (neither Firebase nor Guest)
  if (!hasAuth) {
    if (isAuthPage) return NextResponse.next();
    // Allow access to all pages - guest user will be created on client side
    return NextResponse.next();
  }

  // 🔁 Authenticated user (Firebase) trying to visit login/signup
  if (uid && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 🔁 Guest user trying to visit login/signup - allow it
  if (guestUID && isAuthPage) {
    return NextResponse.next();
  }

  // 🔐 Restrict /user/manage to only master users (not guests)
  if (isManagePage && (role !== 'master' || !uid)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 🔐 Restrict /user/dashboard to only master users (not guests)
  if (isDashboardPage && (role !== 'master' || !uid)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next(); // ✅ Allow other requests
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|.*\\..*).*)'], // match all
};
