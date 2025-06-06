
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { doc, getDoc, setDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
// Removed getLoginTimeSettingsAction as time window is hardcoded again.

const SESSION_COOKIE_NAME = "auth-session";
const APP_SETTINGS_COLLECTION = "app_settings";
const ROLE_MANAGEMENT_DOC = "role_management";
const USERS_COLLECTION = "users";

const DEFAULT_STAFF_LOGIN_START_TIME = { H: 9, M: 0 };
const DEFAULT_STAFF_LOGIN_END_TIME = { H: 23, M: 0 }; // Exclusive: up to 22:59

export interface SessionData {
  username: string;
  email: string;
  role: "owner" | "staff";
  name: string;
  invoicePrimaryColor?: string;
  shopName?: string;
  shopAddress?: string;
  shopContact?: string;
}

interface UserDocumentData {
  email: string;
  displayName: string;
  invoicePrimaryColor?: string;
  shopName?: string;
  shopAddress?: string;
  shopContact?: string;
  // loginManuallyDisabled is removed from here
}

interface RoleEmails {
  ownerEmails: string[];
  staffEmails: string[];
}

async function getRoleEmailsFromFirestore(): Promise<RoleEmails> {
  if (!db) {
    console.error("Firestore (db) instance is not initialized. Returning empty lists.");
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
    console.warn(`Firestore: '${APP_SETTINGS_COLLECTION}/${ROLE_MANAGEMENT_DOC}' document not found. Defaulting to no authorized users.`);
    return { ownerEmails: [], staffEmails: [] };
  } catch (error) {
    console.error("Error fetching role emails from Firestore:", error);
    return { ownerEmails: [], staffEmails: [] };
  }
}

export async function signInWithEmailAction(email: string): Promise<{ error: string } | void> {
  if (!db) {
    return { error: "Authentication service is critically misconfigured. Database unavailable." };
  }
  if (!email || !email.includes('@')) {
    return { error: "Invalid email format provided." };
  }

  const userEmailLower = email.toLowerCase();

  try {
    const roleEmailsResult = await getRoleEmailsFromFirestore();
    const { ownerEmails, staffEmails } = roleEmailsResult;

    let userRole: SessionData['role'] | null = null;

    if (ownerEmails.includes(userEmailLower)) {
      userRole = "owner";
    } else if (staffEmails.includes(userEmailLower)) {
      userRole = "staff";
    }

    if (!userRole) {
      if (ownerEmails.length === 0 && staffEmails.length === 0) {
        return { error: "Login failed: No authorized users are configured in the system. Please contact an administrator." };
      }
      return { error: "Login failed: This email address is not authorized for access." };
    }

    const userDocRef = doc(db, USERS_COLLECTION, userEmailLower);
    let userDocSnap = await getDoc(userDocRef);
    let userDocDataFromDb: UserDocumentData | null = userDocSnap.exists() ? userDocSnap.data() as UserDocumentData : null;

    // Prepare the data to set, ensuring displayName is always populated.
    const userDataToSet: Partial<UserDocumentData> & { email: string; displayName: string } = {
      email: userEmailLower,
      displayName: userDocDataFromDb?.displayName?.trim() || userEmailLower, // Default to email if displayName is empty or not present
    };
    
    // Conditionally add optional fields only if they exist in userDocDataFromDb
    if (userDocDataFromDb?.invoicePrimaryColor) userDataToSet.invoicePrimaryColor = userDocDataFromDb.invoicePrimaryColor;
    if (userDocDataFromDb?.shopName) userDataToSet.shopName = userDocDataFromDb.shopName;
    if (userDocDataFromDb?.shopAddress) userDataToSet.shopAddress = userDocDataFromDb.shopAddress;
    if (userDocDataFromDb?.shopContact) userDataToSet.shopContact = userDocDataFromDb.shopContact;


    if (userRole === "staff") {
      // Time-based restriction for staff (hardcoded 9 AM to 11 PM exclusive)
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      const isAfterStartTime = currentHour > DEFAULT_STAFF_LOGIN_START_TIME.H || (currentHour === DEFAULT_STAFF_LOGIN_START_TIME.H && currentMinute >= DEFAULT_STAFF_LOGIN_START_TIME.M);
      const isBeforeEndTime = currentHour < DEFAULT_STAFF_LOGIN_END_TIME.H; // Exclusive end time

      if (!(isAfterStartTime && isBeforeEndTime)) {
        return { error: `Access denied. Staff login is only permitted between ${DEFAULT_STAFF_LOGIN_START_TIME.H.toString().padStart(2,'0')}:${DEFAULT_STAFF_LOGIN_START_TIME.M.toString().padStart(2,'0')} and ${DEFAULT_STAFF_LOGIN_END_TIME.H.toString().padStart(2,'0')}:00 (exclusive).` };
      }
    }
    
    await setDoc(userDocRef, userDataToSet, { merge: true });
    // console.log(`[signInWithEmailAction] User document for ${userEmailLower} ensured/updated.`);

    const sessionData: SessionData = {
      username: userEmailLower, // Ensure username is always set
      email: userEmailLower,
      role: userRole!,
      name: userDataToSet.displayName, // This is now guaranteed to be non-empty
    };
    if (userDataToSet.invoicePrimaryColor) sessionData.invoicePrimaryColor = userDataToSet.invoicePrimaryColor;
    if (userDataToSet.shopName) sessionData.shopName = userDataToSet.shopName;
    if (userDataToSet.shopAddress) sessionData.shopAddress = userDataToSet.shopAddress;
    if (userDataToSet.shopContact) sessionData.shopContact = userDataToSet.shopContact;

    // console.log('[signInWithEmailAction] Creating session with data:', sessionData);

    const cookieSecure = process.env.NODE_ENV === 'production';
    const cookieSameSite = cookieSecure ? "none" as const : "lax" as const;

    cookies().set(SESSION_COOKIE_NAME, JSON.stringify(sessionData), {
      httpOnly: true,
      secure: cookieSecure,
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
      sameSite: cookieSameSite,
    });

    redirect('/dashboard');

  } catch (e: any) {
    if (typeof e.message === 'string' && e.message.includes('NEXT_REDIRECT')) {
      throw e; // Re-throw NEXT_REDIRECT to allow Next.js to handle it
    }
    console.error("[signInWithEmailAction] Caught an unhandled server error during login:", e);
    let safeErrorMessage = "An unexpected server error occurred during login.";
    if (e instanceof Error && typeof e.message === 'string' && e.message.trim() !== "") {
      safeErrorMessage = `Login failed: ${e.message}`;
    } else if (typeof e === 'string' && e.trim() !== "") {
      safeErrorMessage = `Login failed: ${e}`;
    }
    return { error: safeErrorMessage };
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
      const parsedData = JSON.parse(sessionCookie.value);
      let reason = "";

      if (!parsedData) reason = "Parsed data is null or undefined.";
      else if (typeof parsedData !== 'object') reason = "Parsed data is not an object.";
      else if (typeof parsedData.email !== 'string' || parsedData.email.trim() === '') reason = "Email missing or invalid.";
      else if (typeof parsedData.username !== 'string' || parsedData.username.trim() === '') reason = "Username missing or invalid.";
      else if (typeof parsedData.role !== 'string' || (parsedData.role !== 'owner' && parsedData.role !== 'staff')) reason = "Role missing or invalid.";
      else if (typeof parsedData.name !== 'string' || parsedData.name.trim() === '') reason = "Name missing or invalid.";
      else {
        const optionalStringFields: (keyof SessionData)[] = ['invoicePrimaryColor', 'shopName', 'shopAddress', 'shopContact'];
        for (const field of optionalStringFields) {
          if (parsedData[field] !== undefined && typeof parsedData[field] !== 'string') {
            reason = `Optional field ${String(field)} is present but not a string.`;
            break;
          }
        }
      }

      if (reason) {
        console.warn(`[getSession] Session cookie parsed, but data is invalid or incomplete. Reason: ${reason}. Deleting cookie.`);
        cookies().delete(SESSION_COOKIE_NAME);
        return null;
      }
      return parsedData as SessionData;
    } catch (error) {
      console.error("[getSession] Failed to parse session cookie:", error);
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
    await updateDoc(userDocRef, { displayName: newTrimmedName });
  } catch (dbError) {
    console.error("Error updating user displayName in Firestore:", dbError);
    return { success: false, message: "Failed to save display name to the database." };
  }

  const updatedSessionData: SessionData = { ...session, name: newTrimmedName };
  const cookieSecure = process.env.NODE_ENV === 'production';
  const cookieSameSite = cookieSecure ? "none" as const : "lax" as const;

  try {
    cookies().set(SESSION_COOKIE_NAME, JSON.stringify(updatedSessionData), {
      httpOnly: true, secure: cookieSecure, maxAge: 60 * 60 * 24 * 7, path: "/", sameSite: cookieSameSite,
    });
    return { success: true, message: "Display name updated successfully." };
  } catch (error) {
    console.error("Failed to update session cookie for display name:", error);
    return { success: false, message: "Display name saved, but session update failed. Changes reflect on next login." };
  }
}

export async function updateUserInvoiceColorAction(color: string): Promise<{ success: boolean; message?: string }> {
  const session = await getSession();
  if (!session) return { success: false, message: "No active session. Please log in." };
  if (!/^#[0-9A-F]{6}$/i.test(color)) return { success: false, message: "Invalid hex color format." };

  const userEmailLower = session.email.toLowerCase();
  const userDocRef = doc(db, USERS_COLLECTION, userEmailLower);
  try {
    await setDoc(userDocRef, { invoicePrimaryColor: color }, { merge: true });
  } catch (dbError) {
    console.error("Error updating invoicePrimaryColor in Firestore:", dbError);
    return { success: false, message: "Failed to save invoice color to database." };
  }

  const updatedSessionData: SessionData = { ...session, invoicePrimaryColor: color };
  const cookieSecure = process.env.NODE_ENV === 'production';
  const cookieSameSite = cookieSecure ? "none" as const : "lax" as const;
  try {
    cookies().set(SESSION_COOKIE_NAME, JSON.stringify(updatedSessionData), {
      httpOnly: true, secure: cookieSecure, maxAge: 60 * 60 * 24 * 7, path: "/", sameSite: cookieSameSite,
    });
    return { success: true, message: "Invoice color updated." };
  } catch (error) {
    console.error("Failed to update session cookie for invoice color:", error);
    return { success: false, message: "Invoice color saved, but session update failed. Changes reflect on next login." };
  }
}

export interface ShopDetailsPayload {
  shopName?: string;
  shopAddress?: string;
  shopContact?: string;
}

export async function updateShopDetailsAction(details: ShopDetailsPayload): Promise<{ success: boolean; message?: string }> {
  const session = await getSession();
  if (!session) return { success: false, message: "No active session. Please log in." };

  const userEmailLower = session.email.toLowerCase();
  const userDocRef = doc(db, USERS_COLLECTION, userEmailLower);

  const dataToUpdate: Partial<UserDocumentData> = {};
  if (details.shopName !== undefined) dataToUpdate.shopName = details.shopName.trim();
  if (details.shopAddress !== undefined) dataToUpdate.shopAddress = details.shopAddress.trim();
  if (details.shopContact !== undefined) dataToUpdate.shopContact = details.shopContact.trim();
  
  let hasChanges = false;
  if (details.shopName !== undefined && details.shopName.trim() !== (session.shopName || "")) hasChanges = true;
  if (details.shopAddress !== undefined && details.shopAddress.trim() !== (session.shopAddress || "")) hasChanges = true;
  if (details.shopContact !== undefined && details.shopContact.trim() !== (session.shopContact || "")) hasChanges = true;

  if (!hasChanges && Object.values(details).every(val => val !== undefined && val !== null && (typeof val === 'string' ? val.trim() !== "" : true) )) { 
      return { success: true, message: "No changes to shop details were made." };
  }


  try {
    await setDoc(userDocRef, dataToUpdate, { merge: true });
  } catch (dbError) {
    console.error("Error updating shop details in Firestore:", dbError);
    return { success: false, message: "Failed to save shop details to database." };
  }

  const updatedSessionData: SessionData = { ...session };
  if (dataToUpdate.shopName !== undefined) updatedSessionData.shopName = dataToUpdate.shopName;
  if (dataToUpdate.shopAddress !== undefined) updatedSessionData.shopAddress = dataToUpdate.shopAddress;
  if (dataToUpdate.shopContact !== undefined) updatedSessionData.shopContact = dataToUpdate.shopContact;

  const cookieSecure = process.env.NODE_ENV === 'production';
  const cookieSameSite = cookieSecure ? "none"as const : "lax" as const;
  try {
    cookies().set(SESSION_COOKIE_NAME, JSON.stringify(updatedSessionData), {
      httpOnly: true, secure: cookieSecure, maxAge: 60 * 60 * 24 * 7, path: "/", sameSite: cookieSameSite,
    });
    return { success: true, message: "Shop details updated." };
  } catch (error) {
    console.error("Failed to update session cookie for shop details:", error);
    return { success: false, message: "Shop details saved, but session update failed. Changes reflect on next login." };
  }
}
    
    