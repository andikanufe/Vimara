import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from './lib/auth';

const protectedRoutes = ['/admin', '/student'];

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route));
  
  if (!isProtectedRoute && path !== '/') {
    return NextResponse.next();
  }

  const session = await getSession();

  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL('/', request.nextUrl));
  }

  if (session && path === '/') {
    if (session.role === 'ADMIN') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.nextUrl));
    } else {
      return NextResponse.redirect(new URL('/student/dashboard', request.nextUrl));
    }
  }

  if (session) {
    if (path.startsWith('/admin') && session.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/student/dashboard', request.nextUrl));
    }
    if (path.startsWith('/student') && session.role !== 'STUDENT') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.nextUrl));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
