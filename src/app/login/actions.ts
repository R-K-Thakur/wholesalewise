
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
    
    let userDisplayName: string = userDocDataFromDb?.displayName?.trim() || "";
    if (!userDisplayName) {
        userDisplayName = userEmailLower; // Default to email if displayName is empty
    }

    const dataToSet: Partial<UserDocumentData> = {
        email: userEmailLower,
        displayName: userDisplayName,
    };

    if (userDocDataFromDb?.invoicePrimaryColor) dataToSet.invoicePrimaryColor = userDocDataFromDb.invoicePrimaryColor;
    if (userDocDataFromDb?.shopName) dataToSet.shopName = userDocDataFromDb.shopName;
    if (userDocDataFromDb?.shopAddress) dataToSet.shopAddress = userDocDataFromDb.shopAddress;
    if (userDocDataFromDb?.shopContact) dataToSet.shopContact = userDocDataFromDb.shopContact;


    if (isOwner) {
      dataToSet.loginApprovalStatus = 'approved';
      await setDoc(userDocRef, dataToSet, { merge: true });
    } else if (isStaff) {
      const currentApprovalStatus = userDocDataFromDb?.loginApprovalStatus;
      const nowISO = new Date().toISOString();

      if (currentApprovalStatus === 'approved') {
        // Staff is approved, proceed to login
      } else if (currentApprovalStatus === 'denied') {
        return { error: "Your login request was previously denied. Please contact an owner." };
      } else { 
        dataToSet.loginApprovalStatus = 'pending';
        dataToSet.lastLoginRequestTimestamp = nowISO;
        await setDoc(userDocRef, dataToSet, { merge: true });
        
        const message = currentApprovalStatus === 'pending' 
          ? "Your login request is still awaiting owner approval." 
          : "Your login request has been submitted for owner approval. Please wait or contact an owner.";
        return { error: message };
      }
    }

    const sessionData: SessionData = {
      username: userEmailLower,
      email: userEmailLower,
      role: userRole!,
      name: userDisplayName,
    };

    if (dataToSet.invoicePrimaryColor) sessionData.invoicePrimaryColor = dataToSet.invoicePrimaryColor;
    if (dataToSet.shopName) sessionData.shopName = dataToSet.shopName;
    if (dataToSet.shopAddress) sessionData.shopAddress = dataToSet.shopAddress;
    if (dataToSet.shopContact) sessionData.shopContact = dataToSet.shopContact;
    
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
      throw e; 
    }
    console.error("[signInWithEmailAction] Caught an unhandled server error during login:", e);
    
    let safeErrorMessage = "An unexpected server error occurred. Please check server logs for details.";
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
      let isValid = true;
      let reason = "";

      if (!parsedData) {
        isValid = false;
        reason = "parsedData is null/undefined";
      } else if (typeof parsedData !== 'object') {
        isValid = false;
        reason = "parsedData is not an object";
      } else if (typeof parsedData.email !== 'string' || parsedData.email.trim() === "" || !parsedData.email.includes('@')) {
        isValid = false;
        reason = "Email field missing, not a string, empty, or invalid format";
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

    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      await updateDoc(userDocRef, updatePayload);
    } else {
      // If doc doesn't exist, create it with essential fields + new name
      const newUserData: Partial<UserDocumentData> = { 
        email: userEmailLower, 
        displayName: newTrimmedName,
        // Preserve other potential session fields if they exist in the current session,
        // or initialize them if this is effectively a first-time setup for this user doc.
        invoicePrimaryColor: session.invoicePrimaryColor,
        shopName: session.shopName,
        shopAddress: session.shopAddress,
        shopContact: session.shopContact,
        loginApprovalStatus: session.role === 'owner' ? 'approved' : userDocSnap.data()?.loginApprovalStatus || 'pending'
      };
      await setDoc(userDocRef, newUserData, { merge: true });
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
        // If doc doesn't exist, create it with essential fields + new color
        const newUserData: Partial<UserDocumentData> = { 
            email: userEmailLower, 
            displayName: session.name, // Use current session name
            invoicePrimaryColor: color,
            shopName: session.shopName,
            shopAddress: session.shopAddress,
            shopContact: session.shopContact,
            loginApprovalStatus: session.role === 'owner' ? 'approved' : userDocSnap.data()?.loginApprovalStatus || 'pending'
        };
        await setDoc(userDocRef, newUserData, { merge: true });
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

  if (Object.keys(dataToUpdate).length === 0 && 
      !Object.values(details).some(val => typeof val === 'string' && val === "")) { 
    return { success: true, message: "No shop details to update." };
  }


  try {
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
        await updateDoc(userDocRef, dataToUpdate);
    } else {
        // If doc doesn't exist, create it with essential fields + new details
        const newUserData: Partial<UserDocumentData> = { 
            email: userEmailLower, 
            displayName: session.name, // Use current session name
            invoicePrimaryColor: session.invoicePrimaryColor,
            ...dataToUpdate, // Spread the new details
            loginApprovalStatus: session.role === 'owner' ? 'approved' : userDocSnap.data()?.loginApprovalStatus || 'pending'
        };
        await setDoc(userDocRef, newUserData, {merge: true});
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
    

    