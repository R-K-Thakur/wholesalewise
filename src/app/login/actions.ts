
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { doc, getDoc, setDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

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

export async function signInWithEmailAction(email: string): Promise<{ success: boolean; error?: string }> {
  if (!db) {
    return { success: false, error: "Authentication service is critically misconfigured. Database unavailable." };
  }
  if (!email || !email.includes('@')) {
    return { success: false, error: "Invalid email format provided." };
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
        return { success: false, error: "Login failed: No authorized users are configured in the system. Please contact an administrator." };
      }
      return { success: false, error: "Login failed: This email address is not authorized for access." };
    }

    const userDocRef = doc(db, USERS_COLLECTION, userEmailLower);
    let userDocSnap = await getDoc(userDocRef);
    let userDocDataFromDb: UserDocumentData | null = userDocSnap.exists() ? userDocSnap.data() as UserDocumentData : null;

    const userDataToSet: Partial<UserDocumentData> & { email: string; displayName?: string } = { // displayName is optional initially
      email: userEmailLower,
    };
    if (userDocDataFromDb?.displayName?.trim()) {
        userDataToSet.displayName = userDocDataFromDb.displayName.trim();
    } else {
        userDataToSet.displayName = userEmailLower; // Default if not present or empty
    }
    
    if (userDocDataFromDb?.invoicePrimaryColor) userDataToSet.invoicePrimaryColor = userDocDataFromDb.invoicePrimaryColor;
    if (userDocDataFromDb?.shopName) userDataToSet.shopName = userDocDataFromDb.shopName;
    if (userDocDataFromDb?.shopAddress) userDataToSet.shopAddress = userDocDataFromDb.shopAddress;
    if (userDocDataFromDb?.shopContact) userDataToSet.shopContact = userDocDataFromDb.shopContact;

    if (userRole === "staff") {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      const isAfterStartTime = currentHour > DEFAULT_STAFF_LOGIN_START_TIME.H || (currentHour === DEFAULT_STAFF_LOGIN_START_TIME.H && currentMinute >= DEFAULT_STAFF_LOGIN_START_TIME.M);
      const isBeforeEndTime = currentHour < DEFAULT_STAFF_LOGIN_END_TIME.H;

      if (!(isAfterStartTime && isBeforeEndTime)) {
        return { success: false, error: `Access denied. Staff login is only permitted between ${DEFAULT_STAFF_LOGIN_START_TIME.H.toString().padStart(2,'0')}:${DEFAULT_STAFF_LOGIN_START_TIME.M.toString().padStart(2,'0')} and ${DEFAULT_STAFF_LOGIN_END_TIME.H.toString().padStart(2,'0')}:00 (exclusive).` };
      }
    }
    
    await setDoc(userDocRef, userDataToSet, { merge: true });
    
    const finalUserDisplayName = userDataToSet.displayName || userEmailLower; 

    const sessionData: SessionData = {
      username: userEmailLower, 
      email: userEmailLower,    
      role: userRole!,
      name: finalUserDisplayName, 
    };
    if (userDataToSet.invoicePrimaryColor) sessionData.invoicePrimaryColor = userDataToSet.invoicePrimaryColor;
    if (userDataToSet.shopName) sessionData.shopName = userDataToSet.shopName;
    if (userDataToSet.shopAddress) sessionData.shopAddress = userDataToSet.shopAddress;
    if (userDataToSet.shopContact) sessionData.shopContact = userDataToSet.shopContact;

    console.log('[signInWithEmailAction] EXACT Session data being set in cookie:', JSON.stringify(sessionData, null, 2));

    const cookieStore = await cookies();
    const cookieSecure = process.env.NODE_ENV === 'production';
    console.log(`[signInWithEmailAction] Cookie settings: cookieSecure = ${cookieSecure}, effective SameSite will be 'Lax' (forced for this test)`);
    
    cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(sessionData), {
      httpOnly: true,
      secure: cookieSecure, 
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
      sameSite: "lax" as const,
    });

    return { success: true };

  } catch (e: any) {
    if (typeof e.message === 'string' && e.message.includes('NEXT_REDIRECT')) {
      // This should not happen anymore as we are not calling redirect()
      console.error("[signInWithEmailAction] Caught NEXT_REDIRECT unexpectedly:", e);
      return { success: false, error: "Login failed due to an unexpected redirection error."};
    }
    console.error("[signInWithEmailAction] Caught an unhandled server error during login:", e);
    let safeErrorMessage = "An unexpected server error occurred during login.";
    if (e instanceof Error && typeof e.message === 'string' && e.message.trim() !== "") {
      safeErrorMessage = `Login failed: ${e.message}`;
    } else if (typeof e === 'string' && e.trim() !== "") {
      safeErrorMessage = `Login failed: ${e}`;
    }
    return { success: false, error: safeErrorMessage };
  }
}

export async function logoutAction() {
  cookies().delete(SESSION_COOKIE_NAME);
  redirect("/login");
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (sessionCookie && sessionCookie.value) {
    console.log(`[getSession] Found session cookie. Value (first 50 chars): ${sessionCookie.value.substring(0, 50)}...`);
    try {
      const parsedData = JSON.parse(sessionCookie.value);
      
      if (!parsedData || typeof parsedData !== 'object') {
        console.warn("[getSession] Invalid session: Parsed data is null, undefined, or not an object. Deleting cookie.");
        cookieStore.delete(SESSION_COOKIE_NAME);
        return null;
      }

      const requiredFields: (keyof SessionData)[] = ['email', 'username', 'role', 'name'];
      for (const field of requiredFields) {
        if (!parsedData[field] || typeof parsedData[field] !== 'string' || (parsedData[field] as string).trim() === '') {
           console.warn(`[getSession] Invalid session: Field '${String(field)}' is problematic (value: '${parsedData[field]}', type: ${typeof parsedData[field]}). Deleting cookie.`);
          cookieStore.delete(SESSION_COOKIE_NAME);
          return null;
        }
      }
      
      if (parsedData.role !== 'owner' && parsedData.role !== 'staff') {
        console.warn(`[getSession] Invalid session: Role is problematic (value: ${parsedData.role}, type: ${typeof parsedData.role}). Deleting cookie.`);
        cookieStore.delete(SESSION_COOKIE_NAME);
        return null;
      }
      
      const optionalStringFields: (keyof SessionData)[] = ['invoicePrimaryColor', 'shopName', 'shopAddress', 'shopContact'];
      for (const field of optionalStringFields) {
        if (parsedData[field] !== undefined && typeof parsedData[field] !== 'string') {
          console.warn(`[getSession] Session cookie parsed, but optional field '${String(field)}' is not a string (value: ${parsedData[field]}, type: ${typeof parsedData[field]}). Invalidating and deleting cookie.`);
          cookieStore.delete(SESSION_COOKIE_NAME);
          return null;
        }
      }
      
      return parsedData as SessionData;

    } catch (error) {
      console.error("[getSession] Failed to parse session cookie:", error);
      cookieStore.delete(SESSION_COOKIE_NAME);
      return null;
    }
  }
  console.log("[getSession] No session cookie found.");
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
  const cookieStore = cookies();
  const cookieSecure = process.env.NODE_ENV === 'production';
  const cookieSameSite = "lax" as const; 

  try {
    cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(updatedSessionData), {
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
  const cookieStore = cookies();
  const cookieSecure = process.env.NODE_ENV === 'production';
  const cookieSameSite = "lax" as const; 

  try {
    cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(updatedSessionData), {
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

  const cookieStore = cookies();
  const cookieSecure = process.env.NODE_ENV === 'production';
  const cookieSameSite = "lax" as const;
  try {
    cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(updatedSessionData), {
      httpOnly: true, secure: cookieSecure, maxAge: 60 * 60 * 24 * 7, path: "/", sameSite: cookieSameSite,
    });
    return { success: true, message: "Shop details updated." };
  } catch (error) {
    console.error("Failed to update session cookie for shop details:", error);
    return { success: false, message: "Shop details saved, but session update failed. Changes reflect on next login." };
  }
}
    
    

    

    

    