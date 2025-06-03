
import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = "auth-session";

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  const { pathname } = request.nextUrl;

  // Allow access to /login and API routes (if any) without a session
  if (pathname.startsWith('/login') || pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // If there's no session cookie, redirect to login page for all other routes
  if (!sessionCookie) {
    const loginUrl = new URL('/login', request.url);
    // You can add a 'from' query parameter to redirect back after login
    // loginUrl.searchParams.set('from', pathname); 
    return NextResponse.redirect(loginUrl);
  }
  
  // If there is a session cookie, proceed
  return NextResponse.next();
}

// Define paths for which the middleware should run
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - healthz (health check endpoint)
     * - files (static files in public/files folder)
     * - assets (static files in public/assets folder)
     * - images (static files in public/images folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|healthz|files/.*|assets/.*|images/.*).*)',
  ],
};
