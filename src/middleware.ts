
import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/login/actions'; // Import getSession to use it

const SESSION_COOKIE_NAME = "auth-session"; // Keep this if getSession internally uses it

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow access to /login and API routes (if any) without a session
  if (pathname.startsWith('/login') || pathname.startsWith('/api')) {
    console.log(`[Middleware] Allowing access to public path: ${pathname}`);
    return NextResponse.next();
  }

  // For all other routes, check the session
  const session = await getSession(); // Use the server-side getSession

  if (!session) {
    console.log(`[Middleware] No valid session found for path: ${pathname}, redirecting to /login`);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectedFrom', pathname); // Optional: pass redirect info
    return NextResponse.redirect(loginUrl);
  }
  
  // If there is a valid session, proceed
  console.log(`[Middleware] Valid session found for ${session.email}, allowing access to: ${pathname}`);
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
    
    

    
