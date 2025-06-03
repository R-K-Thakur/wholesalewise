
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
      "getOwnerEmailsFromFirestore: Firestore (db) instance is not initialized. Cannot fetch owner emails."
    );
    return null; // Indicate DB/config failure
  }
  try {
    const docRef = doc(db, APP_SETTINGS_COLLECTION, ROLE_MANAGEMENT_DOC);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      // Ensure ownerEmails is an array of strings, even if field is missing or wrong type in Firestore.
      if (data && Array.isArray(data.ownerEmails)) {
        return data.ownerEmails.map(email => String(email).toLowerCase()).filter(email => email.includes('@'));
      } else if (data && data.ownerEmails !== undefined) {
        console.warn(`Firestore: 'ownerEmails' field in '${APP_SETTINGS_COLLECTION}/${ROLE_MANAGEMENT_DOC}' is not a valid array. Found:`, data.ownerEmails);
        return []; // Return empty array if field exists but is not an array
      }
    }
    // Document or ownerEmails field doesn't exist, or is not an array.
    // This is not an error, just means no owners are defined in DB.
    console.warn(`Firestore: '${APP_SETTINGS_COLLECTION}/${ROLE_MANAGEMENT_DOC}' document not found, or 'ownerEmails' field is missing or not an array. Defaulting to no owners.`);
    return []; // Default to an empty array if doc/field doesn't exist
  } catch (error) {
    console.error("Error fetching owner emails from Firestore:", error);
    return null; // Indicate a Firestore operation failure
  }
}

export async function signInWithGoogleAction(userData: GoogleSignInData): Promise<{ error: string } | void> {
  if (!db) {
    console.error("signInWithGoogleAction: Firestore (db) not available. Check Firebase configuration.");
    return { error: "Authentication service is temporarily unavailable due to a configuration issue." };
  }

  if (!userData.email) {
    console.error("Email not provided by Google Sign-In for session creation.");
    return { error: "Email not provided. Cannot create session." };
  }

  const ownerEmailsResult = await getOwnerEmailsFromFirestore();

  if (ownerEmailsResult === null) {
    // This means getOwnerEmailsFromFirestore encountered a DB error (e.g., db was null or a Firestore operation failed)
    return { error: "Could not determine user role due to a database issue. Please try again later." };
  }

  // ownerEmailsResult is now guaranteed to be string[]
  const userEmailLower = userData.email.toLowerCase();
  const userRole = ownerEmailsResult.includes(userEmailLower) ? "owner" : "staff";

  const sessionData: SessionData = {
    username: userData.email,
    email: userData.email,
    role: userRole,
    name: userData.name || userData.email,
    uid: userData.uid,
  };

  try {
    cookies().set(SESSION_COOKIE_NAME, JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
      sameSite: "lax",
    });
  } catch (e) {
    console.error("Failed to set session cookie:", e);
    // This catch might not be hit if cookies().set itself doesn't throw but fails silently,
    // but it's good practice.
    return { error: "Failed to create your session. Please try again." };
  }
  
  // If all successful, redirect. This must be the last step for the success path.
  redirect('/dashboard');
  // Note: redirect() throws a special error, so code after it won't run.
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
      cookies().delete(SESSION_COOKIE_NAME); // Clear invalid cookie
      return null;
    }
  }
  return null;
}
