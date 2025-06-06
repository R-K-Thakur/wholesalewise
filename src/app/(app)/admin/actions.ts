
"use server";

import { revalidatePath } from "next/cache";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, Timestamp, writeBatch, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getSession, type SessionData } from "@/app/login/actions";
// UserAccessDetails type import is removed as it's no longer used

const APP_SETTINGS_COLLECTION = "app_settings";
const ROLE_MANAGEMENT_DOC = "role_management";
const USERS_COLLECTION = "users";

// Removed default login times, as they are hardcoded in login/actions.ts again


async function verifyOwner(): Promise<SessionData> {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    throw new Error("Unauthorized: Caller is not an owner.");
  }
  return session;
}

// --- Owner Email Actions ---

export async function getOwnerEmailsAction(): Promise<string[]> {
  if (!db) {
    console.error("Firestore (db) instance is not initialized. Returning empty list.");
    return [];
  }
  try {
    const docRef = doc(db, APP_SETTINGS_COLLECTION, ROLE_MANAGEMENT_DOC);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && Array.isArray(data.ownerEmails)) {
        return data.ownerEmails.map(email => String(email));
      }
    }
    return [];
  } catch (error) {
    console.error("Error fetching owner emails:", error);
    return [];
  }
}

export async function addOwnerEmailAction(emailToAdd: string): Promise<{ success: boolean; message: string }> {
  try {
    await verifyOwner();
    
    if (!db) {
      return { success: false, message: "Database service not available." };
    }
    if (!emailToAdd || !emailToAdd.includes('@')) {
      return { success: false, message: "Invalid email format." };
    }
    const normalizedEmail = emailToAdd.toLowerCase();

    const roleManagementRef = doc(db, APP_SETTINGS_COLLECTION, ROLE_MANAGEMENT_DOC);
    const userDocRef = doc(db, USERS_COLLECTION, normalizedEmail);
    
    await runTransaction(db, async (transaction) => {
      const roleDoc = await transaction.get(roleManagementRef);
      let ownerEmails: string[] = [];
      let staffEmails: string[] = [];
      // Removed staffLoginStartTime, staffLoginEndTime from local vars

      if (roleDoc.exists()) {
        const data = roleDoc.data();
        ownerEmails = (data?.ownerEmails && Array.isArray(data.ownerEmails)) ? data.ownerEmails.map(e => String(e).toLowerCase()) : [];
        staffEmails = (data?.staffEmails && Array.isArray(data.staffEmails)) ? data.staffEmails.map(e => String(e).toLowerCase()) : [];
        // Removed reading staffLoginStartTime, staffLoginEndTime
      }

      if (ownerEmails.includes(normalizedEmail)) {
        throw new Error("Email already exists in the owner list.");
      }
      
      const updatePayload: { ownerEmails: any; staffEmails?: any } = { ownerEmails: arrayUnion(normalizedEmail) };

      if (staffEmails.includes(normalizedEmail)) {
        updatePayload.staffEmails = arrayRemove(normalizedEmail);
      }
      
      if (roleDoc.exists()) {
        transaction.update(roleManagementRef, updatePayload);
      } else {
        // Simplified initial role data, no login times
        const initialRoleData: any = { 
          ownerEmails: [normalizedEmail], 
          staffEmails: [],
        };
        transaction.set(roleManagementRef, initialRoleData);
      }
      
      // No loginManuallyDisabled field for owners
      transaction.set(userDocRef, { 
        email: normalizedEmail, 
        displayName: normalizedEmail,
      }, { merge: true });
    });
    
    revalidatePath("/admin/settings");
    // No revalidatePath for /admin/staff-access as it's being removed
    return { success: true, message: "Owner email added successfully." };
  } catch (error) {
    console.error("Error adding owner email:", error);
    return { success: false, message: `Failed to add owner email: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

export async function removeOwnerEmailAction(emailToRemove: string): Promise<{ success: boolean; message: string }> {
  try {
    await verifyOwner();

    if (!db) {
      return { success: false, message: "Database service not available." };
    }
    if (!emailToRemove) {
      return { success: false, message: "Email to remove is required." };
    }
    const normalizedEmailToRemove = emailToRemove.toLowerCase();

    const docRef = doc(db, APP_SETTINGS_COLLECTION, ROLE_MANAGEMENT_DOC);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { success: false, message: "Owner roles document not found." };
    }

    const data = docSnap.data();
    let ownerEmails: string[] = (data?.ownerEmails && Array.isArray(data.ownerEmails)) ? data.ownerEmails.map(e => String(e).toLowerCase()) : [];

    if (!ownerEmails.includes(normalizedEmailToRemove)) {
      return { success: false, message: "Email not found in the owner list." };
    }
    
    if (ownerEmails.length === 1 && ownerEmails[0] === normalizedEmailToRemove) {
       return { success: false, message: "Cannot remove the last owner." };
    }

    await updateDoc(docRef, {
      ownerEmails: arrayRemove(normalizedEmailToRemove)
    });
    
    revalidatePath("/admin/settings");
    // No revalidatePath for /admin/staff-access
    return { success: true, message: "Owner email removed successfully." };
  } catch (error) {
    console.error("Error removing owner email:", error);
    return { success: false, message: `Failed to remove owner email: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

// --- Staff Email Actions ---

export async function getStaffEmailsAction(): Promise<string[]> {
  if (!db) {
    console.error("Firestore (db) instance is not initialized. Returning empty list.");
    return [];
  }
  try {
    const docRef = doc(db, APP_SETTINGS_COLLECTION, ROLE_MANAGEMENT_DOC);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && Array.isArray(data.staffEmails)) {
        return data.staffEmails.map(email => String(email));
      }
    }
    return []; 
  } catch (error) {
    console.error("Error fetching staff emails:", error);
    return [];
  }
}

export async function addStaffEmailAction(emailToAdd: string): Promise<{ success: boolean; message: string }> {
  try {
    await verifyOwner(); 

    if (!db) {
      return { success: false, message: "Database service not available." };
    }
    if (!emailToAdd || !emailToAdd.includes('@')) {
      return { success: false, message: "Invalid email format." };
    }
    const normalizedEmail = emailToAdd.toLowerCase();

    const roleManagementRef = doc(db, APP_SETTINGS_COLLECTION, ROLE_MANAGEMENT_DOC);
    const userDocRef = doc(db, USERS_COLLECTION, normalizedEmail);

    await runTransaction(db, async (transaction) => {
      const roleDoc = await transaction.get(roleManagementRef);
      let ownerEmails: string[] = [];
      let staffEmails: string[] = [];
      // Removed staffLoginStartTime, staffLoginEndTime from local vars

      if (roleDoc.exists()) {
        const data = roleDoc.data();
        ownerEmails = (data?.ownerEmails && Array.isArray(data.ownerEmails)) ? data.ownerEmails.map(e => String(e).toLowerCase()) : [];
        staffEmails = (data?.staffEmails && Array.isArray(data.staffEmails)) ? data.staffEmails.map(e => String(e).toLowerCase()) : [];
        // Removed reading staffLoginStartTime, staffLoginEndTime
      }

      if (ownerEmails.includes(normalizedEmail)) {
        throw new Error("Email already exists in the owner list. Cannot be both owner and staff.");
      }
      if (staffEmails.includes(normalizedEmail)) {
        // Just ensure user doc exists, no loginManuallyDisabled logic
         transaction.set(userDocRef, {
          email: normalizedEmail,
          displayName: normalizedEmail, 
        }, { merge: true });
        throw new Error("Email already exists in the staff list.");
      }
      
      if (roleDoc.exists()) {
        transaction.update(roleManagementRef, { staffEmails: arrayUnion(normalizedEmail) });
      } else {
        // Simplified initial role data, no login times
        transaction.set(roleManagementRef, { 
            ownerEmails: [], 
            staffEmails: [normalizedEmail],
        });
      }
      
      // No loginManuallyDisabled field
      transaction.set(userDocRef, { 
        email: normalizedEmail, 
        displayName: normalizedEmail, 
      }, { merge: true });
    });
        
    revalidatePath("/admin/settings");
    // No revalidatePath for /admin/staff-access
    return { success: true, message: "Staff email added. Login is subject to time restrictions." };
  } catch (error) {
    console.error("Error adding staff email:", error);
    return { success: false, message: `Failed to add staff email: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

export async function removeStaffEmailAction(emailToRemove: string): Promise<{ success: boolean; message: string }> {
  try {
    await verifyOwner(); 

    if (!db) {
      return { success: false, message: "Database service not available." };
    }
    if (!emailToRemove) {
      return { success: false, message: "Email to remove is required." };
    }
    const normalizedEmailToRemove = emailToRemove.toLowerCase();

    const roleManagementRef = doc(db, APP_SETTINGS_COLLECTION, ROLE_MANAGEMENT_DOC);
    // No need to interact with userDoc for loginManuallyDisabled
    // const userDocRef = doc(db, USERS_COLLECTION, normalizedEmailToRemove);

    await runTransaction(db, async (transaction) => {
      const roleDoc = await transaction.get(roleManagementRef);
      if (!roleDoc.exists()) {
        throw new Error("Role management document not found.");
      }
      const data = roleDoc.data();
      let staffEmails: string[] = (data?.staffEmails && Array.isArray(data.staffEmails)) ? data.staffEmails.map(e => String(e).toLowerCase()) : [];

      if (!staffEmails.includes(normalizedEmailToRemove)) {
        throw new Error("Email not found in the staff list.");
      }

      transaction.update(roleManagementRef, {
        staffEmails: arrayRemove(normalizedEmailToRemove)
      });
      // No update to userDoc for loginManuallyDisabled
      // transaction.set(userDocRef, { loginManuallyDisabled: true }, { merge: true });
    });
    
    revalidatePath("/admin/settings");
    // No revalidatePath for /admin/staff-access
    return { success: true, message: "Staff email removed successfully." };
  } catch (error) {
    console.error("Error removing staff email:", error);
    return { success: false, message: `Failed to remove staff email: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

// --- Staff Login Access Management Actions (REMOVED) ---
// getStaffWithAccessStatusAction is removed
// toggleStaffLoginAccessAction is removed

// --- Staff Login Time Window Actions (REMOVED) ---
// getLoginTimeSettingsAction is removed
// updateLoginTimeSettingsAction is removed

    
    

    