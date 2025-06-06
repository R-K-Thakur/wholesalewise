
import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = "auth-session";

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  const { pathname } = request.nextUrl;

  console.log(`[Middleware] Request to path: ${pathname}. Session cookie present: ${!!sessionCookie}.`);
  if (sessionCookie && sessionCookie.value) {
    console.log(`[Middleware] Session cookie value (first 50 chars): ${sessionCookie.value.substring(0, 50)}...`);
  } else if (sessionCookie && !sessionCookie.value) {
    console.log(`[Middleware] Session cookie found but has NO VALUE.`);
  }


  // Allow access to /login and API routes (if any) without a session
  if (pathname.startsWith('/login') || pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // If there's no session cookie, redirect to login page for all other routes
  if (!sessionCookie || !sessionCookie.value) { // Added check for !sessionCookie.value
    console.log(`[Middleware] No session cookie or empty cookie value, redirecting to /login from ${pathname}`);
    const loginUrl = new URL('/login', request.url);
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


    

    