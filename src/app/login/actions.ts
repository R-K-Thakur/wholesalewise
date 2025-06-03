
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase"; // db can be null if config fails

const SESSION_COOKIE_NAME = "auth-session";
const APP_SETTINGS_COLLECTION = "app_settings";
const ROLE_MANAGEMENT_DOC = "role_management";

export interface SessionData {
  username: string;
  email: string;
  role: "owner" | "staff";
  name: string;
  uid?: string;
}

export interface GoogleSignInData {
  email: string | null;
  name: string | null;
  uid: string;
}

async function getOwnerEmailsFromFirestore(): Promise<string[] | null> {
  if (!db) {
    console.error(
      "getOwnerEmailsFromFirestore: Firestore (db) instance is not initialized. Cannot fetch owner emails. Returning empty list."
    );
    return []; // Return empty array instead of null to prevent errors downstream
  }
  try {
    const docRef = doc(db, APP_SETTINGS_COLLECTION, ROLE_MANAGEMENT_DOC);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && Array.isArray(data.ownerEmails)) {
        return data.ownerEmails.map(email => String(email).toLowerCase()).filter(email => email.includes('@'));
      } else if (data && data.ownerEmails !== undefined) {
        console.warn(`Firestore: 'ownerEmails' field in '${APP_SETTINGS_COLLECTION}/${ROLE_MANAGEMENT_DOC}' is not a valid array. Found:`, data.ownerEmails);
        return []; 
      }
    }
    console.warn(`Firestore: '${APP_SETTINGS_COLLECTION}/${ROLE_MANAGEMENT_DOC}' document not found, or 'ownerEmails' field is missing or not an array. Defaulting to no owners.`);
    return []; 
  } catch (error) {
    console.error("Error fetching owner emails from Firestore:", error);
    return null; // Indicate failure to fetch, will be handled by caller
  }
}

export async function signInWithGoogleAction(userData: GoogleSignInData): Promise<{ error: string } | void> {
  if (!userData.email) {
    const errorMessage = "Email not provided. Cannot create session.";
    console.error("signInWithGoogleAction:", errorMessage);
    return { error: errorMessage };
  }
  
  if (!db) {
    const errorMessage = "Authentication service is temporarily unavailable due to a database configuration issue. Cannot determine user role.";
    console.error("signInWithGoogleAction: Firestore (db) not available.", errorMessage);
    return { error: errorMessage };
  }

  const ownerEmailsResult = await getOwnerEmailsFromFirestore();

  if (ownerEmailsResult === null) {
    // This means getOwnerEmailsFromFirestore encountered a critical error trying to fetch roles.
    const errorMessage = "Could not determine user role due to a database access issue. Please try again later.";
    console.error("signInWithGoogleAction: ownerEmailsResult is null, indicating a DB error.", errorMessage);
    return { error: errorMessage };
  }
  
  // Ensure ownerEmailsResult is an array before using .includes()
  const normalizedOwnerEmails = Array.isArray(ownerEmailsResult) ? ownerEmailsResult : [];
  const userEmailLower = userData.email.toLowerCase();
  const userRole = normalizedOwnerEmails.includes(userEmailLower) ? "owner" : "staff";

  const sessionData: SessionData = {
    username: userData.email,
    email: userData.email,
    role: userRole,
    name: userData.name || userData.email,
    uid: userData.uid,
  };

  try {
    console.log("[signInWithGoogleAction] Attempting to set session cookie with data (first 50 chars):", JSON.stringify(sessionData).substring(0, 50) + "...");
    cookies().set(SESSION_COOKIE_NAME, JSON.stringify(sessionData), {
      httpOnly: true,
      secure: true, // Explicitly true as your environment is HTTPS
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
      sameSite: "none", // Changed from "lax" to "none"
    });
    console.log(`[signInWithGoogleAction] Session cookie set attempt for ${sessionData.email}.`);

    const justSetCookie = cookies().get(SESSION_COOKIE_NAME);
    if (justSetCookie) {
      console.log(`[signInWithGoogleAction] Cookie read back by server immediately after setting (value starts with): ${justSetCookie.value.substring(0,30)}...`);
    } else {
      console.log(`[signInWithGoogleAction] Cookie was NOT readable by server immediately after setting via cookies().get(). This can sometimes be normal due to cookie propagation, but ensure browser is sending it on next request.`);
    }
    
    console.log("[signInWithGoogleAction] Attempting redirect to /dashboard.");
    redirect('/dashboard');
    // Note: redirect() throws a special error, so code after it won't run.
  } catch (e: any) {
    // Check if the error is the special redirect error from Next.js
    if (typeof e.message === 'string' && e.message.includes('NEXT_REDIRECT')) {
      // This is an expected error when redirect() is called. Re-throw it so Next.js handles the redirect.
      throw e;
    }
    // Log other types of errors
    console.error("[signInWithGoogleAction] Failed to set session cookie or redirect:", e);
    return { error: "Failed to create your session or redirect. Please try again." };
  }
}


export async function logoutAction() {
  cookies().delete(SESSION_COOKIE_NAME);
  redirect("/login");
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (sessionCookie?.value) {
    try {
      const sessionData = JSON.parse(sessionCookie.value) as SessionData;
      return sessionData;
    } catch (error) {
      console.error("Failed to parse session cookie:", error);
      cookies().delete(SESSION_COOKIE_NAME); 
      return null;
    }
  }
  return null;
}
