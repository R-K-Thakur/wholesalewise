
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase"; 

const SESSION_COOKIE_NAME = "auth-session";
const APP_SETTINGS_COLLECTION = "app_settings";
const ROLE_MANAGEMENT_DOC = "role_management";
const USERS_COLLECTION = "users";

export interface SessionData {
  username: string; 
  email: string;
  role: "owner" | "staff";
  name: string; 
  invoicePrimaryColor?: string; // Added for invoice customization
}

interface RoleEmails {
  ownerEmails: string[];
  staffEmails: string[];
}

async function getRoleEmailsFromFirestore(): Promise<RoleEmails | null> {
  if (!db) {
    console.error(
      "getRoleEmailsFromFirestore: Firestore (db) instance is not initialized. Cannot fetch roles. Returning empty lists."
    );
    return { ownerEmails: [], staffEmails: [] };
  }
  try {
    const docRef = doc(db, APP_SETTINGS_COLLECTION, ROLE_MANAGEMENT_DOC);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const ownerEmails = (data?.ownerEmails && Array.isArray(data.ownerEmails)) 
        ? data.ownerEmails.map(email => String(email).toLowerCase()).filter(email => email.includes('@')) 
        : [];
      const staffEmails = (data?.staffEmails && Array.isArray(data.staffEmails)) 
        ? data.staffEmails.map(email => String(email).toLowerCase()).filter(email => email.includes('@')) 
        : [];
      return { ownerEmails, staffEmails };
    }
    console.warn(`Firestore: '${APP_SETTINGS_COLLECTION}/${ROLE_MANAGEMENT_DOC}' document not found or fields missing. Defaulting to no authorized users.`);
    return { ownerEmails: [], staffEmails: [] }; 
  } catch (error) {
    console.error("Error fetching role emails from Firestore:", error);
    return null;
  }
}

export async function signInWithEmailAction(email: string): Promise<{ error: string } | void> {
  if (!email || !email.includes('@')) {
    return { error: "Invalid email format provided." };
  }

  if (!db) {
    return { error: "Authentication service is temporarily unavailable due to a database configuration issue." };
  }

  const roleEmailsResult = await getRoleEmailsFromFirestore();

  if (roleEmailsResult === null) {
    return { error: "Could not verify user authorization due to a database access issue. Please try again later." };
  }
  
  const { ownerEmails, staffEmails } = roleEmailsResult;
  const userEmailLower = email.toLowerCase();
  let userRole: SessionData['role'] | null = null;

  if (ownerEmails.includes(userEmailLower)) {
    userRole = "owner";
  } else if (staffEmails.includes(userEmailLower)) {
    userRole = "staff";
  }

  if (!userRole) {
    if (ownerEmails.length === 0 && staffEmails.length === 0) {
      return { error: "Login failed: No authorized users (owners or staff) are configured in the system. Please contact an administrator." };
    }
    return { error: "Login failed: This email address is not authorized to access the application." };
  }

  const userDocRef = doc(db, USERS_COLLECTION, userEmailLower);
  let userDisplayName = userEmailLower;
  let userInvoicePrimaryColor: string | undefined = undefined;

  try {
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      if (userData.displayName && typeof userData.displayName === 'string' && userData.displayName.trim() !== "") {
        userDisplayName = userData.displayName;
      } else {
        await updateDoc(userDocRef, { displayName: userEmailLower, email: userEmailLower });
      }
      if (userData.invoicePrimaryColor && typeof userData.invoicePrimaryColor === 'string') {
        userInvoicePrimaryColor = userData.invoicePrimaryColor;
      }
    } else {
      await setDoc(userDocRef, { email: userEmailLower, displayName: userEmailLower, invoicePrimaryColor: undefined });
    }
  } catch (dbError) {
    console.error("Error accessing/creating user document in Firestore:", dbError);
  }

  const sessionData: SessionData = {
    username: email, 
    email: email,
    role: userRole,
    name: userDisplayName,
    invoicePrimaryColor: userInvoicePrimaryColor,
  };

  const cookieSecure = true; 
  const cookieSameSite = "none" as "none" | "lax" | "strict" | undefined;
  
  try {
    cookies().set(SESSION_COOKIE_NAME, JSON.stringify(sessionData), {
      httpOnly: true,
      secure: cookieSecure, 
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
      sameSite: cookieSameSite,
    });
    
    redirect('/dashboard');
  } catch (e: any) {
    if (typeof e.message === 'string' && e.message.includes('NEXT_REDIRECT')) {
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

export async function updateUserDisplayNameAction(newName: string): Promise<{ success: boolean; message?: string }> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: "No active session found. Please log in again." };
  }

  if (!newName || newName.trim().length === 0) {
    return { success: false, message: "Display name cannot be empty." };
  }
  const newTrimmedName = newName.trim();
  if (newTrimmedName.length > 50) {
    return { success: false, message: "Display name cannot exceed 50 characters." };
  }

  const userEmailLower = session.email.toLowerCase();
  const userDocRef = doc(db, USERS_COLLECTION, userEmailLower);

  try {
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      await updateDoc(userDocRef, { displayName: newTrimmedName });
    } else {
      await setDoc(userDocRef, { email: userEmailLower, displayName: newTrimmedName });
      console.warn(`User document for ${userEmailLower} was created during display name update.`);
    }
  } catch (dbError) {
    console.error("Error updating user displayName in Firestore:", dbError);
    return { success: false, message: "Failed to save display name to the database. Please try again." };
  }

  const updatedSessionData: SessionData = {
    ...session,
    name: newTrimmedName, 
  };
  
  const cookieSecure = true;
  const cookieSameSite = "none" as "none" | "lax" | "strict" | undefined;

  try {
    cookies().set(SESSION_COOKIE_NAME, JSON.stringify(updatedSessionData), {
      httpOnly: true,
      secure: cookieSecure,
      maxAge: 60 * 60 * 24 * 7, 
      path: "/",
      sameSite: cookieSameSite,
    });
    return { success: true, message: "Display name updated successfully." };
  } catch (error) {
    console.error("Failed to update session cookie for display name:", error);
    return { success: false, message: "Display name was saved to the database, but failed to update your current session. Changes will reflect on next login." };
  }
}

export async function updateUserInvoiceColorAction(color: string): Promise<{ success: boolean; message?: string }> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: "No active session found. Please log in again." };
  }

  // Basic hex color validation (e.g., #RRGGBB)
  if (!/^#[0-9A-F]{6}$/i.test(color)) {
    return { success: false, message: "Invalid color format. Please use a valid hex color code (e.g., #RRGGBB)." };
  }

  const userEmailLower = session.email.toLowerCase();
  const userDocRef = doc(db, USERS_COLLECTION, userEmailLower);

  try {
    await updateDoc(userDocRef, { invoicePrimaryColor: color });
  } catch (dbError) {
    console.error("Error updating user invoicePrimaryColor in Firestore:", dbError);
    return { success: false, message: "Failed to save invoice color to the database. Please try again." };
  }

  const updatedSessionData: SessionData = {
    ...session,
    invoicePrimaryColor: color,
  };

  const cookieSecure = true;
  const cookieSameSite = "none" as "none" | "lax" | "strict" | undefined;

  try {
    cookies().set(SESSION_COOKIE_NAME, JSON.stringify(updatedSessionData), {
      httpOnly: true,
      secure: cookieSecure,
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
      sameSite: cookieSameSite,
    });
    return { success: true, message: "Invoice color updated successfully." };
  } catch (error) {
    console.error("Failed to update session cookie for invoice color:", error);
    return { success: false, message: "Invoice color was saved to the database, but failed to update your current session. Changes will reflect on next login." };
  }
}
