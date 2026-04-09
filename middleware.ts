import { auth } from '@/app/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow NextAuth internal routes
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // If authenticated and visiting login, redirect to home
  if (req.auth && pathname === '/login') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // If not authenticated, redirect to login
  if (!req.auth && pathname !== '/login') {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
