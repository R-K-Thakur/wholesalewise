
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase"; // db can be null if config fails

const SESSION_COOKIE_NAME = "auth-session";
const APP_SETTINGS_COLLECTION = "app_settings";
const ROLE_MANAGEMENT_DOC = "role_management";

export interface SessionData {
  username: string; // Will be the email
  email: string;
  role: "owner" | "staff";
  name: string; // Will be the email or a derived part
}

async function getOwnerEmailsFromFirestore(): Promise<string[] | null> {
  if (!db) {
    console.error(
      "getOwnerEmailsFromFirestore: Firestore (db) instance is not initialized. Cannot fetch owner emails. Returning empty list."
    );
    return [];
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
    return null;
  }
}

export async function signInWithEmailAction(email: string): Promise<{ error: string } | void> {
  if (!email || !email.includes('@')) {
    const errorMessage = "Invalid email format provided.";
    console.error("signInWithEmailAction:", errorMessage);
    return { error: errorMessage };
  }

  if (!db) {
    const errorMessage = "Authentication service is temporarily unavailable due to a database configuration issue. Cannot determine user role.";
    console.error("signInWithEmailAction: Firestore (db) not available.", errorMessage);
    return { error: errorMessage };
  }

  const ownerEmailsResult = await getOwnerEmailsFromFirestore();

  if (ownerEmailsResult === null) {
    const errorMessage = "Could not determine user role due to a database access issue. Please try again later.";
    console.error("signInWithEmailAction: ownerEmailsResult is null, indicating a DB error.", errorMessage);
    return { error: errorMessage };
  }
  
  const normalizedOwnerEmails = Array.isArray(ownerEmailsResult) ? ownerEmailsResult : [];
  const userEmailLower = email.toLowerCase();
  const userRole = normalizedOwnerEmails.includes(userEmailLower) ? "owner" : "staff";

  const sessionData: SessionData = {
    username: email,
    email: email,
    role: userRole,
    name: email, // Using email as name for simplicity
  };

  const isProduction = process.env.NODE_ENV === 'production';

  try {
    console.log(`[signInWithEmailAction] Attempting to set session cookie. Production: ${isProduction}, Email: ${email}`);
    cookies().set(SESSION_COOKIE_NAME, JSON.stringify(sessionData), {
      httpOnly: true,
      secure: isProduction, 
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
      sameSite: isProduction ? "none" : "lax",
    });
    console.log(`[signInWithEmailAction] Session cookie set attempt for ${sessionData.email}. Secure: ${isProduction}, SameSite: ${isProduction ? "none" : "lax"}`);

    const justSetCookie = cookies().get(SESSION_COOKIE_NAME);
    if (justSetCookie) {
      console.log(`[signInWithEmailAction] Cookie read back by server immediately after setting (value starts with): ${justSetCookie.value.substring(0,30)}...`);
    } else {
      console.log(`[signInWithEmailAction] Cookie was NOT readable by server immediately after setting via cookies().get().`);
    }
    
    console.log("[signInWithEmailAction] Attempting redirect to /dashboard.");
    redirect('/dashboard');
  } catch (e: any) {
    if (typeof e.message === 'string' && e.message.includes('NEXT_REDIRECT')) {
      // This error is part of Next.js's redirect mechanism.
      // It's thrown to signal the redirect, so we re-throw it.
      throw e;
    }
    console.error("[signInWithEmailAction] Failed to set session cookie or redirect:", e);
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
