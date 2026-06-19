import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

<<<<<<< ours
export function middleware(request: NextRequest) {
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/api/auth/login');
  const token = request.cookies.get('sb-access-token')?.value;
  if (!token && !isAuthRoute) return NextResponse.redirect(new URL('/login', request.url));
  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*', '/principal/:path*', '/teacher/:path*', '/student/:path*', '/parent/:path*'] };
=======
const protectedRoutes = ['/dashboard'];

export function middleware(req: NextRequest) {
  const token = req.cookies.get('session')?.value;
  if (protectedRoutes.some((route) => req.nextUrl.pathname.startsWith(route)) && !token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*'] };
>>>>>>> theirs
