
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
  loginApprovalStatus?: 'pending' | 'approved' | 'denied';
  lastLoginRequestTimestamp?: string;
}

interface RoleEmails {
  ownerEmails: string[];
  staffEmails: string[];
}

async function getRoleEmailsFromFirestore(): Promise<RoleEmails> {
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
    return { ownerEmails: [], staffEmails: [] };
  }
}

export async function signInWithEmailAction(email: string): Promise<{ error: string } | void> {
  if (!db) {
    console.error("[signInWithEmailAction] Firestore (db) instance is not initialized!");
    return { error: "Authentication service is critically misconfigured. Database unavailable." };
  }

  if (!email || !email.includes('@')) {
    return { error: "Invalid email format provided." };
  }

  try {
    const roleEmailsResult = await getRoleEmailsFromFirestore();
    
    const { ownerEmails, staffEmails } = roleEmailsResult;
    const userEmailLower = email.toLowerCase();
    let userRole: SessionData['role'] | null = null;
    let isOwner = false;
    let isStaff = false;

    if (ownerEmails.includes(userEmailLower)) {
      userRole = "owner";
      isOwner = true;
    } else if (staffEmails.includes(userEmailLower)) {
      userRole = "staff";
      isStaff = true;
    }

    if (!userRole) {
      if (ownerEmails.length === 0 && staffEmails.length === 0) {
        return { error: "Login failed: No authorized users (owners or staff) are configured in the system. Please contact an administrator." };
      }
      return { error: "Login failed: This email address is not authorized to access the application." };
    }

    const userDocRef = doc(db, USERS_COLLECTION, userEmailLower);
    let userDocSnap;
    let userDocDataFromDb: UserDocumentData | null = null;

    try {
      userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        userDocDataFromDb = userDocSnap.data() as UserDocumentData;
      }
    } catch (dbError) {
      console.error("Error fetching user document during login:", dbError);
      return { error: "A database error occurred while processing your login. Please try again." };
    }
    
    let userDisplayName: string = userDocDataFromDb?.displayName?.trim() || userEmailLower;
    if (!userDisplayName) { // Fallback just in case userEmailLower was also empty (though validated earlier)
        userDisplayName = userEmailLower;
    }

    let userInvoicePrimaryColor = userDocDataFromDb?.invoicePrimaryColor;
    let userShopName = userDocDataFromDb?.shopName;
    let userShopAddress = userDocDataFromDb?.shopAddress;
    let userShopContact = userDocDataFromDb?.shopContact;

    if (isOwner) {
      const ownerDataToSet: Partial<UserDocumentData> = {
        email: userEmailLower,
        displayName: userDisplayName,
        loginApprovalStatus: 'approved',
      };
      if (userInvoicePrimaryColor) ownerDataToSet.invoicePrimaryColor = userInvoicePrimaryColor;
      if (userShopName) ownerDataToSet.shopName = userShopName;
      if (userShopAddress) ownerDataToSet.shopAddress = userShopAddress;
      if (userShopContact) ownerDataToSet.shopContact = userShopContact;
      
      await setDoc(userDocRef, ownerDataToSet, { merge: true });

    } else if (isStaff) {
      const currentApprovalStatus = userDocDataFromDb?.loginApprovalStatus;
      const nowISO = new Date().toISOString();

      if (currentApprovalStatus === 'approved') {
        // Staff is approved, proceed to login
      } else if (currentApprovalStatus === 'denied') {
        return { error: "Your login request was previously denied. Please contact an owner." };
      } else { 
        const staffDataToSet: Partial<UserDocumentData> = {
          email: userEmailLower,
          displayName: userDisplayName,
          loginApprovalStatus: 'pending',
          lastLoginRequestTimestamp: nowISO,
        };
        if (userInvoicePrimaryColor) staffDataToSet.invoicePrimaryColor = userInvoicePrimaryColor;
        if (userShopName) staffDataToSet.shopName = userShopName;
        if (userShopAddress) staffDataToSet.shopAddress = userShopAddress;
        if (userShopContact) staffDataToSet.shopContact = userShopContact;

        await setDoc(userDocRef, staffDataToSet, { merge: true });
        
        if (currentApprovalStatus === 'pending') {
          return { error: "Your login request is still awaiting owner approval." };
        }
        return { error: "Your login request has been submitted for owner approval. Please wait or contact an owner." };
      }
    }

    const sessionData: SessionData = {
      username: userEmailLower, // Ensure username is always set
      email: userEmailLower,
      role: userRole!,
      name: userDisplayName, // Ensure name is always set
    };

    if (userInvoicePrimaryColor) sessionData.invoicePrimaryColor = userInvoicePrimaryColor;
    if (userShopName) sessionData.shopName = userShopName;
    if (userShopAddress) sessionData.shopAddress = userShopAddress;
    if (userShopContact) sessionData.shopContact = userShopContact;
    
    console.log('[signInWithEmailAction] Creating session with data:', sessionData);

    const cookieSecure = process.env.NODE_ENV === 'production';
    const cookieSameSite = cookieSecure ? "none" as "none" | "lax" | "strict" | undefined : "lax" as "none" | "lax" | "strict" | undefined;
    
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
      throw e; // Re-throw NEXT_REDIRECT, Next.js will handle it.
    }
    // Log the raw error object for more details on the server
    console.error("[signInWithEmailAction] Caught an unhandled server error during login:", e);
    
    // Construct a simple, safe error message to return to the client
    let safeErrorMessage = "An unexpected server error occurred. Please check server logs for details.";
    if (e instanceof Error && typeof e.message === 'string' && e.message.trim() !== "") {
        safeErrorMessage = `Login failed: ${e.message}`;
    } else if (typeof e === 'string' && e.trim() !== "") {
        safeErrorMessage = `Login failed: ${e}`;
    }
    // DO NOT include the raw error 'e' or complex parts of it in the object returned to the client,
    // as it might not be serializable and could cause the "Server Error" on the client.
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
      let isValid = true;
      let reason = "";

      if (!parsedData) {
        isValid = false;
        reason = "parsedData is null/undefined";
      } else if (typeof parsedData !== 'object') {
        isValid = false;
        reason = "parsedData is not an object";
      } else if (typeof parsedData.email !== 'string' || parsedData.email.trim() === "") {
        isValid = false;
        reason = "Email field missing, not a string, or empty";
      } else if (typeof parsedData.role !== 'string' || (parsedData.role !== 'owner' && parsedData.role !== 'staff')) {
        isValid = false;
        reason = "Role field missing or invalid";
      } else if (typeof parsedData.name !== 'string' || parsedData.name.trim() === "") {
        isValid = false;
        reason = "Name field missing, not a string, or empty";
      } else if (typeof parsedData.username !== 'string' || parsedData.username.trim() === "") {
        isValid = false;
        reason = "Username field missing, not a string, or empty";
      }
      
      const optionalStringFields: (keyof SessionData)[] = ['invoicePrimaryColor', 'shopName', 'shopAddress', 'shopContact'];
      for (const field of optionalStringFields) {
          if (parsedData[field] !== undefined && typeof parsedData[field] !== 'string') {
              isValid = false;
              reason = `${String(field)}, if present, must be a string. Found: ${typeof parsedData[field]}`;
              break; 
          }
      }

      if (isValid) {
        return parsedData as SessionData;
      } else {
        console.warn(`[getSession] Session cookie parsed, but data is invalid or incomplete. Reason: ${reason}. Deleting cookie. Parsed data keys:`, Object.keys(parsedData || {}));
        cookies().delete(SESSION_COOKIE_NAME);
        // No redirect here; middleware or page logic should handle missing session.
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
    const userDocSnap = await getDoc(userDocRef);
    let updatePayload: Partial<UserDocumentData> = { displayName: newTrimmedName };

    if (userDocSnap.exists()) {
      await updateDoc(userDocRef, updatePayload);
    } else {
      await setDoc(userDocRef, { email: userEmailLower, displayName: newTrimmedName }, { merge: true });
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

  const cookieSecure = process.env.NODE_ENV === 'production';
  const cookieSameSite = cookieSecure ? "none" as "none" | "lax" | "strict" | undefined : "lax" as "none" | "lax" | "strict" | undefined;

  try {
    cookies().set(SESSION_COOKIE_NAME, JSON.stringify(updatedSessionData), {
      httpOnly: true,
      secure: cookieSecure,
      maxAge: 60 * 60 * 24 * 7, // 7 days
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

  if (!/^#[0-9A-F]{6}$/i.test(color)) {
    return { success: false, message: "Invalid color format. Please use a valid hex color code (e.g., #RRGGBB)." };
  }

  const userEmailLower = session.email.toLowerCase();
  const userDocRef = doc(db, USERS_COLLECTION, userEmailLower);

  try {
    const dataToSet: Partial<UserDocumentData> = { invoicePrimaryColor: color };
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
        await updateDoc(userDocRef, dataToSet);
    } else {
        await setDoc(userDocRef, { email: userEmailLower, displayName: session.name, invoicePrimaryColor: color }, { merge: true });
    }
  } catch (dbError) {
    console.error("Error updating user invoicePrimaryColor in Firestore:", dbError);
    return { success: false, message: "Failed to save invoice color to the database. Please try again." };
  }

  const updatedSessionData: SessionData = {
    ...session,
    invoicePrimaryColor: color,
  };

  const cookieSecure = process.env.NODE_ENV === 'production';
  const cookieSameSite = cookieSecure ? "none" as "none" | "lax" | "strict" | undefined : "lax" as "none" | "lax" | "strict" | undefined;

  try {
    cookies().set(SESSION_COOKIE_NAME, JSON.stringify(updatedSessionData), {
      httpOnly: true,
      secure: cookieSecure,
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
      sameSite: cookieSameSite,
    });
    return { success: true, message: "Invoice color updated successfully." };
  } catch (error) {
    console.error("Failed to update session cookie for invoice color:", error);
    return { success: false, message: "Invoice color was saved to the database, but failed to update your current session. Changes will reflect on next login." };
  }
}

export interface ShopDetailsPayload {
  shopName?: string;
  shopAddress?: string;
  shopContact?: string;
}

export async function updateShopDetailsAction(details: ShopDetailsPayload): Promise<{ success: boolean; message?: string }> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: "No active session found. Please log in again." };
  }

  const userEmailLower = session.email.toLowerCase();
  const userDocRef = doc(db, USERS_COLLECTION, userEmailLower);

  const dataToUpdate: Partial<UserDocumentData> = {};
  if (details.shopName !== undefined) dataToUpdate.shopName = details.shopName.trim();
  if (details.shopAddress !== undefined) dataToUpdate.shopAddress = details.shopAddress.trim();
  if (details.shopContact !== undefined) dataToUpdate.shopContact = details.shopContact.trim();

  if (Object.keys(dataToUpdate).length === 0 && !Object.values(details).some(val => val === "")) { 
    return { success: true, message: "No shop details to update." };
  }


  try {
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
        await updateDoc(userDocRef, dataToUpdate);
    } else {
        await setDoc(userDocRef, { email: userEmailLower, displayName: session.name, ...dataToUpdate }, {merge: true});
         console.warn(`User document for ${userEmailLower} was created during shop details update.`);
    }
  } catch (dbError) {
    console.error("Error updating shop details in Firestore:", dbError);
    return { success: false, message: "Failed to save shop details to the database. Please try again." };
  }

  const updatedSessionData: SessionData = {
    ...session,
    shopName: dataToUpdate.shopName !== undefined ? dataToUpdate.shopName : session.shopName,
    shopAddress: dataToUpdate.shopAddress !== undefined ? dataToUpdate.shopAddress : session.shopAddress,
    shopContact: dataToUpdate.shopContact !== undefined ? dataToUpdate.shopContact : session.shopContact,
  };
  

  const cookieSecure = process.env.NODE_ENV === 'production';
  const cookieSameSite = cookieSecure ? "none" as "none" | "lax" | "strict" | undefined : "lax" as "none" | "lax" | "strict" | undefined;

  try {
    cookies().set(SESSION_COOKIE_NAME, JSON.stringify(updatedSessionData), {
      httpOnly: true,
      secure: cookieSecure,
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
      sameSite: cookieSameSite,
    });
    return { success: true, message: "Shop details updated successfully." };
  } catch (error) {
    console.error("Failed to update session cookie for shop details:", error);
    return { success: false, message: "Shop details were saved, but failed to update your current session. Changes will reflect on next login." };
  }
}
    
