
import { NextResponse, type NextRequest } from 'next/server';
import type { SessionData } from '@/app/login/actions'; 

const SESSION_COOKIE_NAME = "auth-session";
const PIN_PENDING_COOKIE_NAME = "auth-session-pin-pending";
const PIN_SETUP_PENDING_COOKIE_NAME = "auth-session-pin-setup-pending"; // New cookie

interface TempSessionInfo { // Used for both PIN pending types
  email: string;
  name: string;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  const pinPendingCookie = request.cookies.get(PIN_PENDING_COOKIE_NAME);
  const pinSetupPendingCookie = request.cookies.get(PIN_SETUP_PENDING_COOKIE_NAME);


  // Allow access to /login, /login/** sub-paths and API routes without full session
  if (pathname.startsWith('/login') || pathname.startsWith('/api')) {
    return NextResponse.next();
  }
  
  // Check for full session first
  let session: SessionData | null = null;
  if (sessionCookie && sessionCookie.value) {
    try {
      const parsedData = JSON.parse(sessionCookie.value);
      if (parsedData && parsedData.email && parsedData.role) {
        session = parsedData as SessionData;
      }
    } catch (error) {
      console.error("[Middleware] Failed to parse main session cookie:", error);
    }
  }

  if (session) {
    return NextResponse.next();
  }

  // If no full session, check for PIN setup pending state
  if (pinSetupPendingCookie && pinSetupPendingCookie.value) {
    try {
      const parsedPinSetupData = JSON.parse(pinSetupPendingCookie.value) as TempSessionInfo;
      if (parsedPinSetupData && parsedPinSetupData.email) {
        if (pathname === '/login/setup-pin') {
          console.log(`[Middleware] PIN setup pending state detected. Allowing access to /login/setup-pin for ${parsedPinSetupData.email}.`);
          return NextResponse.next();
        } else {
          console.log(`[Middleware] PIN setup pending state detected for ${parsedPinSetupData.email}. Path is ${pathname}. Redirecting to /login/setup-pin.`);
          const setupPinUrl = new URL('/login/setup-pin', request.url);
          setupPinUrl.searchParams.set('email', parsedPinSetupData.email); 
          return NextResponse.redirect(setupPinUrl);
        }
      }
    } catch (error) {
      console.error("[Middleware] Failed to parse PIN setup pending cookie:", error);
      // Fall through to login if cookie is malformed
    }
  }
  
  // If no full session and no PIN setup pending, check for PIN verification pending state
  if (pinPendingCookie && pinPendingCookie.value) {
    try {
      const parsedPinPendingData = JSON.parse(pinPendingCookie.value) as TempSessionInfo;
      if (parsedPinPendingData && parsedPinPendingData.email) {
        if (pathname === '/login/verify-pin') {
          console.log(`[Middleware] PIN verification pending state detected. Allowing access to /login/verify-pin for ${parsedPinPendingData.email}.`);
          return NextResponse.next();
        } else {
          console.log(`[Middleware] PIN verification pending state detected for ${parsedPinPendingData.email}. Path is ${pathname}. Redirecting to /login/verify-pin.`);
          const verifyPinUrl = new URL('/login/verify-pin', request.url);
          verifyPinUrl.searchParams.set('email', parsedPinPendingData.email); 
          return NextResponse.redirect(verifyPinUrl);
        }
      }
    } catch (error) {
      console.error("[Middleware] Failed to parse PIN verification pending cookie:", error);
      // Fall through to login if cookie is malformed
    }
  }
  
  // If no relevant session or pending state cookies, redirect to login
  console.log(`[Middleware] No valid session or pending state found for path: ${pathname}. Redirecting to /login.`);
  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
};
