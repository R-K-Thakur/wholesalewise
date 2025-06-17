
"use server";

import { cookies } from "next/headers";
import { doc, getDoc, setDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import crypto from "crypto";

const SESSION_COOKIE_NAME = "auth-session";
const PIN_PENDING_COOKIE_NAME = "auth-session-pin-pending";
const PIN_SETUP_PENDING_COOKIE_NAME = "auth-session-pin-setup-pending";
const APP_SETTINGS_COLLECTION = "app_settings";
const ROLE_MANAGEMENT_DOC = "role_management";
const USERS_COLLECTION = "users";

const UTC_STAFF_LOGIN_START_TIME = { H: 3, M: 30 }; 
const UTC_STAFF_LOGIN_END_TIME = { H: 17, M: 30 };  

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
  ownerPinHash?: string;
  ownerPinSalt?: string;
  role?: "owner" | "staff"; 
}

interface RoleEmails {
  ownerEmails: string[];
  staffEmails: string[];
}

// --- PIN Hashing Utilities ---
const HASH_ITERATIONS = 10000;
const HASH_KEYLEN = 64;
const HASH_DIGEST = "sha512";

function generateSalt(length = 16): string {
  return crypto.randomBytes(length).toString("hex");
}

function hashPin(pin: string, salt: string): string {
  return crypto
    .pbkdf2Sync(pin, salt, HASH_ITERATIONS, HASH_KEYLEN, HASH_DIGEST)
    .toString("hex");
}

function verifyPin(pin: string, hash: string, salt: string): boolean {
  const hashToVerify = hashPin(pin, salt);
  return crypto.timingSafeEqual(Buffer.from(hashToVerify, 'hex'), Buffer.from(hash, 'hex'));
}
// --- End PIN Hashing Utilities ---

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

async function finalizeLoginSession(userData: UserDocumentData, role: "owner" | "staff"): Promise<void> {
  const sessionData: SessionData = {
    username: userData.email,
    email: userData.email,
    role: role,
    name: userData.displayName,
    invoicePrimaryColor: userData.invoicePrimaryColor,
    shopName: userData.shopName,
    shopAddress: userData.shopAddress,
    shopContact: userData.shopContact,
  };

  const cookieStore = cookies();
  const cookieSecure = process.env.NODE_ENV === 'production';
  
  cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(sessionData), {
    httpOnly: true,
    secure: cookieSecure,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
    sameSite: "lax" as const,
  });
}


export async function signInWithEmailAction(email: string): Promise<{ success: boolean; error?: string; pinRequired?: boolean; pinSetupRequired?: boolean; email?: string }> {
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
    
    const userDisplayName = userDocDataFromDb?.displayName?.trim() ? userDocDataFromDb.displayName.trim() : userEmailLower;

    if (userRole === "staff") {
      const now = new Date(); 
      const currentUTCHour = now.getUTCHours();
      const currentUTCMinute = now.getUTCMinutes();

      const isAfterStartTime = currentUTCHour > UTC_STAFF_LOGIN_START_TIME.H || 
                              (currentUTCHour === UTC_STAFF_LOGIN_START_TIME.H && currentUTCMinute >= UTC_STAFF_LOGIN_START_TIME.M);
      
      const isBeforeEndTime = currentUTCHour < UTC_STAFF_LOGIN_END_TIME.H ||
                              (currentUTCHour === UTC_STAFF_LOGIN_END_TIME.H && currentUTCMinute < UTC_STAFF_LOGIN_END_TIME.M);

      if (!(isAfterStartTime && isBeforeEndTime)) {
        return { success: false, error: `Access denied. Staff login is only permitted between 09:00 and 23:00 (exclusive).` };
      }
    }
    
    const userDataToSet: Partial<UserDocumentData> = {
      email: userEmailLower,
      displayName: userDisplayName,
      role: userRole,
    };

    if (userDocDataFromDb) {
      // Conditionally add fields only if they exist in the fetched document
      if (userDocDataFromDb.invoicePrimaryColor !== undefined) userDataToSet.invoicePrimaryColor = userDocDataFromDb.invoicePrimaryColor;
      if (userDocDataFromDb.shopName !== undefined) userDataToSet.shopName = userDocDataFromDb.shopName;
      if (userDocDataFromDb.shopAddress !== undefined) userDataToSet.shopAddress = userDocDataFromDb.shopAddress;
      if (userDocDataFromDb.shopContact !== undefined) userDataToSet.shopContact = userDocDataFromDb.shopContact;
      if (userDocDataFromDb.ownerPinHash !== undefined) userDataToSet.ownerPinHash = userDocDataFromDb.ownerPinHash;
      if (userDocDataFromDb.ownerPinSalt !== undefined) userDataToSet.ownerPinSalt = userDocDataFromDb.ownerPinSalt;
    }


    await setDoc(userDocRef, userDataToSet, { merge: true });
    userDocSnap = await getDoc(userDocRef); 
    userDocDataFromDb = userDocSnap.exists() ? userDocSnap.data() as UserDocumentData : null;

    if (!userDocDataFromDb) {
        throw new Error("Failed to retrieve user data after update.");
    }

    const cookieStore = cookies();
    const cookieSecure = process.env.NODE_ENV === 'production';

    if (userRole === "owner") {
      if (userDocDataFromDb.ownerPinHash && userDocDataFromDb.ownerPinSalt) {
        const pinPendingData = { email: userEmailLower, name: userDisplayName };
        cookieStore.set(PIN_PENDING_COOKIE_NAME, JSON.stringify(pinPendingData), {
          httpOnly: true, secure: cookieSecure, maxAge: 60 * 10, path: "/", sameSite: "lax" as const,
        });
        console.log(`[signInWithEmailAction] Owner ${userEmailLower} has PIN. Setting PIN_PENDING cookie.`);
        return { success: true, pinRequired: true, email: userEmailLower };
      } else {
        const pinSetupPendingData = { email: userEmailLower, name: userDisplayName };
        cookieStore.set(PIN_SETUP_PENDING_COOKIE_NAME, JSON.stringify(pinSetupPendingData), {
          httpOnly: true, secure: cookieSecure, maxAge: 60 * 10, path: "/", sameSite: "lax" as const,
        });
        console.log(`[signInWithEmailAction] New owner ${userEmailLower} or owner without PIN. Setting PIN_SETUP_PENDING cookie.`);
        return { success: true, pinSetupRequired: true, email: userEmailLower };
      }
    }
    
    await finalizeLoginSession(userDocDataFromDb, userRole);
    console.log(`[signInWithEmailAction] Setting full session cookie for staff ${userEmailLower}.`);
    return { success: true };

  } catch (e: any) {
    console.error("[signInWithEmailAction] Error:", e);
    let safeErrorMessage = "An unexpected server error occurred during login.";
    if (e instanceof Error && typeof e.message === 'string' && e.message.trim() !== "") {
      safeErrorMessage = e.message.startsWith("Function setDoc() called with invalid data. Unsupported field value: undefined")
        ? "Login setup error. Please try again." 
        : `Login failed: ${e.message}`;
    } else if (typeof e === 'string' && e.trim() !== "") {
      safeErrorMessage = `Login failed: ${e}`;
    }
    return { success: false, error: safeErrorMessage };
  }
}

export async function verifyOwnerPinAction(email: string, enteredPin: string): Promise<{ success: boolean; error?: string }> {
  if (!email || !enteredPin) {
    return { success: false, error: "Email and PIN are required." };
  }

  const userEmailLower = email.toLowerCase();
  const userDocRef = doc(db, USERS_COLLECTION, userEmailLower);

  try {
    const userDocSnap = await getDoc(userDocRef);
    if (!userDocSnap.exists()) {
      return { success: false, error: "User not found." };
    }

    const userData = userDocSnap.data() as UserDocumentData;
    if (userData.role !== "owner") { 
        const { ownerEmails } = await getRoleEmailsFromFirestore();
        if (!ownerEmails.includes(userEmailLower)) {
            return { success: false, error: "PIN verification is for owners only." };
        }
    }

    if (!userData.ownerPinHash || !userData.ownerPinSalt) {
      return { success: false, error: "No PIN set for this owner account. Please set up a PIN first." };
    }
    
    const isPinValid = verifyPin(enteredPin, userData.ownerPinHash, userData.ownerPinSalt);
    if (!isPinValid) {
      return { success: false, error: "Invalid PIN." };
    }

    await finalizeLoginSession(userData, "owner");
    cookies().delete(PIN_PENDING_COOKIE_NAME);
    console.log(`[verifyOwnerPinAction] PIN verified for ${userEmailLower}. Full session set. PIN_PENDING cookie cleared.`);
    return { success: true };

  } catch (e: any) {
    console.error("[verifyOwnerPinAction] Error:", e);
    return { success: false, error: "An unexpected error occurred during PIN verification." };
  }
}


export async function setOrChangeOwnerPinAction(newPin: string, currentPin?: string): Promise<{ success: boolean; message?: string, email?: string }> {
  const sessionCookie = cookies().get(SESSION_COOKIE_NAME);
  const pinSetupPendingCookie = cookies().get(PIN_SETUP_PENDING_COOKIE_NAME);

  let userEmailLower: string | undefined;
  let isSettingUpNewPin = false;

  if (pinSetupPendingCookie && pinSetupPendingCookie.value) {
    try {
      const parsedData = JSON.parse(pinSetupPendingCookie.value);
      userEmailLower = parsedData.email?.toLowerCase();
      isSettingUpNewPin = true;
    } catch {
      // Malformed cookie, ignore
    }
  } else if (sessionCookie && sessionCookie.value) {
    try {
      const session = JSON.parse(sessionCookie.value) as SessionData;
      if (session.role !== "owner") {
        return { success: false, message: "Unauthorized. Only owners can set/change PIN from an active session." };
      }
      userEmailLower = session.email.toLowerCase();
    } catch {
      return { success: false, message: "Invalid session data." };
    }
  }

  if (!userEmailLower) {
    return { success: false, message: "Unauthorized or session expired. Please log in again." };
  }
  
  if (!newPin || newPin.length < 4 || newPin.length > 8 || !/^\d+$/.test(newPin)) {
    return { success: false, message: "New PIN must be 4-8 digits." };
  }

  const userDocRef = doc(db, USERS_COLLECTION, userEmailLower);

  try {
    const userDocSnap = await getDoc(userDocRef);
    if (!userDocSnap.exists()) {
      return { success: false, message: "User document not found." };
    }
    const userData = userDocSnap.data() as UserDocumentData;

    if (!isSettingUpNewPin && userData.ownerPinHash && userData.ownerPinSalt) { 
      if (!currentPin) {
        return { success: false, message: "Current PIN is required to change an existing PIN." };
      }
      const isCurrentPinValid = verifyPin(currentPin, userData.ownerPinHash, userData.ownerPinSalt);
      if (!isCurrentPinValid) {
        return { success: false, message: "Incorrect current PIN." };
      }
    }

    const newSalt = generateSalt();
    const newPinHash = hashPin(newPin, newSalt);

    await updateDoc(userDocRef, {
      ownerPinHash: newPinHash,
      ownerPinSalt: newSalt,
      updatedAt: Timestamp.now().toDate().toISOString(),
    });

    const message = (userData.ownerPinHash && !isSettingUpNewPin) ? "PIN changed successfully." : "PIN set successfully.";
    
    if (isSettingUpNewPin) {
      // We don't clear PIN_SETUP_PENDING_COOKIE_NAME here.
      // The finalizeLoginAfterPinSetup action will do it after this action succeeds.
      console.log(`[setOrChangeOwnerPinAction] New PIN set for ${userEmailLower}.`);
      return { success: true, message: message, email: userEmailLower };
    }

    return { success: true, message: message };

  } catch (error) {
    console.error("Error setting/changing PIN:", error);
    return { success: false, message: `Failed to update PIN: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}


export async function logoutAction() {
  const cookieStore = cookies(); 
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(PIN_PENDING_COOKIE_NAME); 
  cookieStore.delete(PIN_SETUP_PENDING_COOKIE_NAME);
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
      console.log(`[getSession] Successfully parsed session. Name from cookie: '${parsedData.name}'`);
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

interface TempSessionInfo {
  email: string;
  name: string;
}

export async function getPinPendingSession(): Promise<TempSessionInfo | null> {
  const cookieStore = cookies();
  const pinPendingCookie = cookieStore.get(PIN_PENDING_COOKIE_NAME);

  if (pinPendingCookie && pinPendingCookie.value) {
    try {
      const parsedData = JSON.parse(pinPendingCookie.value);
      if (parsedData && parsedData.email && parsedData.name) {
        return { email: parsedData.email, name: parsedData.name };
      }
    } catch (error) {
      console.error("[getPinPendingSession] Failed to parse PIN pending cookie:", error);
      cookieStore.delete(PIN_PENDING_COOKIE_NAME);
      return null;
    }
  }
  return null;
}

export async function getPinSetupPendingSession(): Promise<TempSessionInfo | null> {
  const cookieStore = cookies();
  const pinSetupPendingCookie = cookieStore.get(PIN_SETUP_PENDING_COOKIE_NAME);

  if (pinSetupPendingCookie && pinSetupPendingCookie.value) {
    try {
      const parsedData = JSON.parse(pinSetupPendingCookie.value);
      if (parsedData && parsedData.email && parsedData.name) {
        return { email: parsedData.email, name: parsedData.name };
      }
    } catch (error) {
      console.error("[getPinSetupPendingSession] Failed to parse PIN setup pending cookie:", error);
      cookieStore.delete(PIN_SETUP_PENDING_COOKIE_NAME);
      return null;
    }
  }
  return null;
}

// Simplified version for debugging the "is not a function" error.
export async function finalizeLoginAfterPinSetup(email: string): Promise<{ success: boolean; error?: string }> {
    console.log(`[DEBUG][finalizeLoginAfterPinSetup] Called for email: ${email}`);
    if (!email || typeof email !== 'string' || !email.includes('@')) {
        console.error(`[DEBUG][finalizeLoginAfterPinSetup] Invalid email received: ${email}`);
        return { success: false, error: "Invalid email provided for login finalization." };
    }
    // This is a test. In a real scenario, you would fetch user data,
    // set the main session cookie, and clear the PIN_SETUP_PENDING_COOKIE_NAME.
    // For now, just simulate success.
    
    // const userEmailLower = email.toLowerCase();
    // const userDocRef = doc(db, USERS_COLLECTION, userEmailLower);

    // try {
    //     const userDocSnap = await getDoc(userDocRef);
    //     if (!userDocSnap.exists()) {
    //       return { success: false, error: "User not found during login finalization." };
    //     }
    //     const userData = userDocSnap.data() as UserDocumentData;
    //     if (userData.role !== "owner") {
    //          return { success: false, error: "Login finalization is for owners only." };
    //     }

    //     await finalizeLoginSession(userData, "owner");
    //     cookies().delete(PIN_SETUP_PENDING_COOKIE_NAME);
    //     console.log(`[finalizeLoginAfterPinSetup] Finalized login for ${userEmailLower}. Full session set. PIN_SETUP_PENDING cookie cleared.`);
    //     return { success: true };

    // } catch (e:any) {
    //     console.error("[finalizeLoginAfterPinSetup] Error:", e);
    //     return { success: false, error: "An unexpected error occurred during login finalization." };
    // }
    
    console.log(`[DEBUG][finalizeLoginAfterPinSetup] Simulating successful login finalization for ${email}.`);
    return { success: true };
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
    await updateDoc(userDocRef, { displayName: newTrimmedName, role: session.role });
  } catch (dbError) {
    console.error("Error updating user displayName in Firestore:", dbError);
    return { success: false, message: "Failed to save display name to the database." };
  }

  const updatedSessionData: SessionData = { ...session, name: newTrimmedName };
  console.log(`[updateUserDisplayNameAction] Updating session cookie. New name: '${updatedSessionData.name}'`);
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
    
    

    

    

    



    



