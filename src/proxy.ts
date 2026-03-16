import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from './lib/auth';

const protectedRoutes = ['/admin', '/student'];

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  console.log('[Middleware] Intercepting path:', path);
  
  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route));
  
  if (!isProtectedRoute && path !== '/') {
    return NextResponse.next();
  }

  try {
    const session = await getSession();
    console.log('[Middleware] Session:', session);

    if (isProtectedRoute && !session) {
      console.log('[Middleware] No session on protected route, redirecting to /');
      return NextResponse.redirect(new URL('/', request.nextUrl));
    }

    if (session && path === '/') {
      console.log('[Middleware] Session exists on /, redirecting to dashboard');
      if (session.role === 'ADMIN') {
        return NextResponse.redirect(new URL('/admin/dashboard', request.nextUrl));
      } else {
        return NextResponse.redirect(new URL('/student/dashboard', request.nextUrl));
      }
    }

    if (session) {
      if (path.startsWith('/admin') && session.role !== 'ADMIN') {
        console.log('[Middleware] Non-admin accessing /admin, redirecting to student dashboard');
        return NextResponse.redirect(new URL('/student/dashboard', request.nextUrl));
      }
      if (path.startsWith('/student') && session.role !== 'STUDENT') {
        console.log('[Middleware] Non-student accessing /student, redirecting to admin dashboard');
        return NextResponse.redirect(new URL('/admin/dashboard', request.nextUrl));
      }
    }

    console.log('[Middleware] Access granted to', path);
    return NextResponse.next();
  } catch (error) {
    console.error('[Middleware] Error:', error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
