
import { NextResponse, type NextRequest } from 'next/server';
import type { SessionData } from '@/app/login/actions'; 

const SESSION_COOKIE_NAME = "auth-session";
const PIN_PENDING_COOKIE_NAME = "auth-session-pin-pending";

interface PinPendingSession {
  email: string;
  name: string;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  const pinPendingCookie = request.cookies.get(PIN_PENDING_COOKIE_NAME);

  console.log(`[Middleware] Request to path: ${pathname}.`);
  if (sessionCookie) console.log(`[Middleware] Main session cookie (first 50 chars): ${sessionCookie.value?.substring(0,50) ?? 'N/A'}`);
  if (pinPendingCookie) console.log(`[Middleware] PIN pending cookie (first 50 chars): ${pinPendingCookie.value?.substring(0,50) ?? 'N/A'}`);


  // Allow access to /login, /login/verify-pin and API routes without full session
  if (pathname.startsWith('/login') || pathname.startsWith('/api')) {
    console.log(`[Middleware] Allowing access to public/auth path: ${pathname}`);
    return NextResponse.next();
  }

  // Check for PIN pending state first
  if (pinPendingCookie && pinPendingCookie.value) {
    try {
      const parsedPinPendingData = JSON.parse(pinPendingCookie.value) as PinPendingSession;
      if (parsedPinPendingData && parsedPinPendingData.email) {
        if (pathname === '/login/verify-pin') {
          console.log(`[Middleware] PIN pending state detected. Allowing access to /login/verify-pin for ${parsedPinPendingData.email}.`);
          return NextResponse.next();
        } else {
          console.log(`[Middleware] PIN pending state detected for ${parsedPinPendingData.email}. Path is ${pathname}. Redirecting to /login/verify-pin.`);
          const verifyPinUrl = new URL('/login/verify-pin', request.url);
          // Pass email as query param for the verify-pin page to use, ensuring it's available even if cookie is read server-side on page load
          verifyPinUrl.searchParams.set('email', parsedPinPendingData.email); 
          return NextResponse.redirect(verifyPinUrl);
        }
      }
    } catch (error) {
      console.error("[Middleware] Failed to parse PIN pending cookie:", error);
      // Invalid PIN pending cookie, treat as no session and redirect to login
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }
  
  // If no PIN pending, check for full session
  let session: SessionData | null = null;
  if (sessionCookie && sessionCookie.value) {
    try {
      const parsedData = JSON.parse(sessionCookie.value);
      if (parsedData && typeof parsedData === 'object' &&
          parsedData.email && typeof parsedData.email === 'string' &&
          parsedData.username && typeof parsedData.username === 'string' &&
          parsedData.role && (parsedData.role === 'owner' || parsedData.role === 'staff') &&
          parsedData.name && typeof parsedData.name === 'string'
      ) {
        const optionalStringFields: (keyof SessionData)[] = ['invoicePrimaryColor', 'shopName', 'shopAddress', 'shopContact'];
        let optionalFieldsValid = true;
        for (const field of optionalStringFields) {
          if (parsedData[field] !== undefined && typeof parsedData[field] !== 'string') {
            optionalFieldsValid = false;
            break;
          }
        }
        if (optionalFieldsValid) {
          session = parsedData as SessionData;
        }
      }
    } catch (error) {
      console.error("[Middleware] Failed to parse main session cookie:", error);
    }
  }

  if (!session) {
    console.log(`[Middleware] No valid session found for path: ${pathname}. Redirecting to /login.`);
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  console.log(`[Middleware] Valid session found for ${session.email}, role ${session.role}. Allowing access to: ${pathname}`);
  // Add role-based access control here if needed in the future, e.g.,
  // if (pathname.startsWith('/admin') && session.role !== 'owner') {
  //   return NextResponse.redirect(new URL('/dashboard', request.url)); // Or an unauthorized page
  // }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|healthz|files/.*|assets/.*|images/.*).*)',
  ],
};
