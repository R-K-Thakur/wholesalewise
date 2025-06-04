
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase"; 

const SESSION_COOKIE_NAME = "auth-session";
const APP_SETTINGS_COLLECTION = "app_settings";
const ROLE_MANAGEMENT_DOC = "role_management";
const USERS_COLLECTION = "users"; // New collection for user profiles

export interface SessionData {
  username: string; 
  email: string;
  role: "owner" | "staff";
  name: string; // This will serve as the display name
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

  // Fetch or create user profile from Firestore
  const userDocRef = doc(db, USERS_COLLECTION, userEmailLower);
  let userDisplayName = userEmailLower; // Default display name

  try {
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      if (userData.displayName && typeof userData.displayName === 'string' && userData.displayName.trim() !== "") {
        userDisplayName = userData.displayName;
      } else {
        // Document exists but no valid displayName, update it with email
        await updateDoc(userDocRef, { displayName: userEmailLower, email: userEmailLower }); // ensure email is also there
      }
    } else {
      // User document doesn't exist, create it with email as displayName
      await setDoc(userDocRef, { email: userEmailLower, displayName: userEmailLower });
    }
  } catch (dbError) {
    console.error("Error accessing/creating user document in Firestore:", dbError);
    // Proceed with email as display name, but log the error. Don't fail login.
  }

  const sessionData: SessionData = {
    username: email, 
    email: email,
    role: userRole,
    name: userDisplayName, // Use fetched/default display name
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
    // Update Firestore document
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      await updateDoc(userDocRef, { displayName: newTrimmedName });
    } else {
      // This case should ideally not happen if sign-in creates the doc, but handle defensively
      await setDoc(userDocRef, { email: userEmailLower, displayName: newTrimmedName });
      console.warn(`User document for ${userEmailLower} was created during display name update. This might indicate an issue with the sign-in flow not creating the user document initially.`);
    }
  } catch (dbError) {
    console.error("Error updating user displayName in Firestore:", dbError);
    return { success: false, message: "Failed to save display name to the database. Please try again." };
  }

  // Update session cookie
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
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
      sameSite: cookieSameSite,
    });
    return { success: true, message: "Display name updated successfully." };
  } catch (error) {
    console.error("Failed to update session cookie for display name:", error);
    // Note: Firestore update succeeded, but cookie update failed. This could lead to inconsistency until next login.
    return { success: false, message: "Display name was saved to the database, but failed to update your current session. Changes will reflect on next login." };
  }
}

