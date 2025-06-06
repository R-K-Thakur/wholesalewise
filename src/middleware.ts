
import { NextResponse, type NextRequest } from 'next/server';
// Removed: import { getSession } from '@/app/login/actions';
import type { SessionData } from '@/app/login/actions'; // Import the type

const SESSION_COOKIE_NAME = "auth-session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);

  console.log(`[Middleware] Request to path: ${pathname}. Raw session cookie value (first 50 chars): ${sessionCookie?.value?.substring(0,50) ?? 'N/A'}`);

  // Allow access to /login and API routes (if any) without a session
  if (pathname.startsWith('/login') || pathname.startsWith('/api')) {
    console.log(`[Middleware] Allowing access to public path: ${pathname}`);
    return NextResponse.next();
  }

  let session: SessionData | null = null;

  if (sessionCookie && sessionCookie.value) {
    try {
      const parsedData = JSON.parse(sessionCookie.value);
      
      // Direct validation logic (similar to getSession, but inline)
      if (parsedData && typeof parsedData === 'object' &&
          parsedData.email && typeof parsedData.email === 'string' &&
          parsedData.username && typeof parsedData.username === 'string' &&
          parsedData.role && (parsedData.role === 'owner' || parsedData.role === 'staff') &&
          parsedData.name && typeof parsedData.name === 'string'
      ) {
        // Validate optional fields if they exist
        const optionalStringFields: (keyof SessionData)[] = ['invoicePrimaryColor', 'shopName', 'shopAddress', 'shopContact'];
        let optionalFieldsValid = true;
        for (const field of optionalStringFields) {
          if (parsedData[field] !== undefined && typeof parsedData[field] !== 'string') {
            console.warn(`[Middleware] Invalid session: Optional field '${String(field)}' is not a string (value: ${parsedData[field]}, type: ${typeof parsedData[field]}).`);
            optionalFieldsValid = false;
            break;
          }
        }
        if (optionalFieldsValid) {
          session = parsedData as SessionData;
        } else {
           console.warn(`[Middleware] Session cookie parsed, but an optional field was invalid. Treating as no session.`);
        }
      } else {
        console.warn(`[Middleware] Session cookie parsed, but required fields are missing or invalid. Required fields: email, username, role, name. Parsed data: ${JSON.stringify(parsedData).substring(0,100)}...`);
      }
    } catch (error) {
      console.error("[Middleware] Failed to parse session cookie:", error);
      // If parsing fails, treat as no session, but don't delete the cookie from here.
      // Let getSession in actions.ts handle potential deletion if it's truly malformed beyond repair.
    }
  }

  if (!session) {
    console.log(`[Middleware] No valid session found (after inline check) for path: ${pathname}. Redirecting to /login.`);
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

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
