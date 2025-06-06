
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { doc, getDoc, setDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const SESSION_COOKIE_NAME = "auth-session";
const APP_SETTINGS_COLLECTION = "app_settings";
const ROLE_MANAGEMENT_DOC = "role_management";
const USERS_COLLECTION = "users";

export interface SessionData {
  username: string; // Should be the email
  email: string;
  role: "owner" | "staff";
  name: string; // Should be the displayName
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
  // loginApprovalStatus and lastLoginRequestTimestamp are removed as we are reverting the approval system
}

interface RoleEmails {
  ownerEmails: string[];
  staffEmails: string[];
}

async function getRoleEmailsFromFirestore(): Promise<RoleEmails> {
  if (!db) {
    console.error(
      "getRoleEmailsFromFirestore: Firestore (db) instance is not initialized. Returning empty lists."
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
        return { error: "Login failed: No authorized users are configured in the system." };
      }
      return { error: "Login failed: This email address is not authorized." };
    }

    const userDocRef = doc(db, USERS_COLLECTION, userEmailLower);
    let userDocDataFromDb: UserDocumentData | null = null;
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      userDocDataFromDb = userDocSnap.data() as UserDocumentData;
    }

    const userDisplayName = userDocDataFromDb?.displayName?.trim() || userEmailLower;

    // Prepare data for Firestore, omitting undefined optional fields
    const userDataForFirestore: Partial<UserDocumentData> = {
      email: userEmailLower,
      displayName: userDisplayName,
    };
    if (userDocDataFromDb?.invoicePrimaryColor) userDataForFirestore.invoicePrimaryColor = userDocDataFromDb.invoicePrimaryColor;
    if (userDocDataFromDb?.shopName) userDataForFirestore.shopName = userDocDataFromDb.shopName;
    if (userDocDataFromDb?.shopAddress) userDataForFirestore.shopAddress = userDocDataFromDb.shopAddress;
    if (userDocDataFromDb?.shopContact) userDataForFirestore.shopContact = userDocDataFromDb.shopContact;
    
    Object.keys(userDataForFirestore).forEach(key => {
        const K = key as keyof Partial<UserDocumentData>;
        if (userDataForFirestore[K] === undefined) {
            delete userDataForFirestore[K];
        }
    });

    await setDoc(userDocRef, userDataForFirestore, { merge: true });

    const sessionData: SessionData = {
      username: userEmailLower, 
      email: userEmailLower,
      role: userRole!,
      name: userDisplayName, 
    };

    if (userDataForFirestore.invoicePrimaryColor) sessionData.invoicePrimaryColor = userDataForFirestore.invoicePrimaryColor;
    if (userDataForFirestore.shopName) sessionData.shopName = userDataForFirestore.shopName;
    if (userDataForFirestore.shopAddress) sessionData.shopAddress = userDataForFirestore.shopAddress;
    if (userDataForFirestore.shopContact) sessionData.shopContact = userDataForFirestore.shopContact;

    // console.log('[signInWithEmailAction] Creating session with data:', sessionData); // Reverted: removed this specific log for now

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
      throw e; 
    }
    console.error("[signInWithEmailAction] Error during login:", e);
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
      // Basic validation: check for essential fields
      if (
        parsedData &&
        typeof parsedData === 'object' &&
        typeof parsedData.email === 'string' &&
        parsedData.email.includes('@') &&
        typeof parsedData.role === 'string' &&
        (parsedData.role === 'owner' || parsedData.role === 'staff') &&
        typeof parsedData.name === 'string' && // name is displayName
        parsedData.name.trim() !== '' &&
        typeof parsedData.username === 'string' && // username is email
        parsedData.username.trim() !== ''
      ) {
         // Validate optional string fields: if present, they must be strings
        const optionalStringFields: (keyof SessionData)[] = ['invoicePrimaryColor', 'shopName', 'shopAddress', 'shopContact'];
        for (const field of optionalStringFields) {
            if (parsedData[field] !== undefined && typeof parsedData[field] !== 'string') {
                // console.warn(`[getSession] Optional field ${String(field)} is invalid. Deleting cookie.`);
                cookies().delete(SESSION_COOKIE_NAME);
                return null;
            }
        }
        return parsedData as SessionData;
      } else {
        // console.warn("[getSession] Session cookie parsed, but data is invalid or incomplete. Deleting cookie.");
        cookies().delete(SESSION_COOKIE_NAME);
        return null;
      }
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
    const updatePayload: Partial<UserDocumentData> = { displayName: newTrimmedName };
    await setDoc(userDocRef, updatePayload, { merge: true }); 
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

  if (!hasChanges && Object.values(details).every(val => val !== undefined && val !== "")) { 
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
    
    

    