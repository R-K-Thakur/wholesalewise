
import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = "auth-session";

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  const { pathname } = request.nextUrl;

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Middleware] Request to path: ${pathname}`);
    if (sessionCookie) {
      console.log(`[Middleware] Session cookie found. Value (first few chars): ${sessionCookie.value.substring(0, 20)}...`);
      try {
        // Optionally log parts of the parsed cookie for deeper debugging,
        // but be careful with sensitive info.
        // const parsedSession = JSON.parse(sessionCookie.value);
        // console.log(`[Middleware] Parsed session email: ${parsedSession.email}`);
      } catch (e) {
        console.error("[Middleware] Error parsing session cookie:", e);
      }
    } else {
      console.log("[Middleware] No session cookie found.");
    }
  }

  // Allow access to /login and API routes (if any) without a session
  if (pathname.startsWith('/login') || pathname.startsWith('/api')) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Middleware] Allowing public path: ${pathname}`);
    }
    return NextResponse.next();
  }

  // If there's no session cookie, redirect to login page for all other routes
  if (!sessionCookie) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Middleware] No session cookie, redirecting to /login from ${pathname}`);
    }
    const loginUrl = new URL('/login', request.url);
    // You can add a 'from' query parameter to redirect back after login
    // loginUrl.searchParams.set('from', pathname); 
    return NextResponse.redirect(loginUrl);
  }
  
  // If there is a session cookie, proceed
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Middleware] Session cookie found, allowing access to protected path: ${pathname}`);
  }
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
