
"use server";

import { revalidatePath } from "next/cache";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, Timestamp, writeBatch, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getSession, type SessionData } from "@/app/login/actions";

const APP_SETTINGS_COLLECTION = "app_settings";
const ROLE_MANAGEMENT_DOC = "role_management";
const USERS_COLLECTION = "users";


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
    console.error("Firestore (db) instance is not initialized. Cannot fetch owner emails. Returning empty list.");
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

      if (roleDoc.exists()) {
        const data = roleDoc.data();
        ownerEmails = (data?.ownerEmails && Array.isArray(data.ownerEmails)) ? data.ownerEmails.map(e => String(e).toLowerCase()) : [];
        staffEmails = (data?.staffEmails && Array.isArray(data.staffEmails)) ? data.staffEmails.map(e => String(e).toLowerCase()) : [];
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
        const initialRoleData: any = { ownerEmails: [normalizedEmail], staffEmails: [] };
        transaction.set(roleManagementRef, initialRoleData);
      }
      
      // Ensure user document exists with displayName, but remove loginApprovalStatus as system is reverted
      transaction.set(userDocRef, { 
        email: normalizedEmail, 
        displayName: normalizedEmail, 
      }, { merge: true });
    });
    
    revalidatePath("/admin/settings");
    let message = "Owner email added successfully. They can log in directly.";
    return { success: true, message: message };
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
    return { success: true, message: "Owner email removed successfully." };
  } catch (error) {
    console.error("Error removing owner email:", error);
    return { success: false, message: `Failed to remove owner email: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

// --- Staff Email Actions ---

export async function getStaffEmailsAction(): Promise<string[]> {
  if (!db) {
    console.error("Firestore (db) instance is not initialized. Cannot fetch staff emails. Returning empty list.");
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
      // let staffEmails: string[] = []; // Not strictly needed for validation here anymore

      if (roleDoc.exists()) {
        const data = roleDoc.data();
        ownerEmails = (data?.ownerEmails && Array.isArray(data.ownerEmails)) ? data.ownerEmails.map(e => String(e).toLowerCase()) : [];
        // staffEmails = (data?.staffEmails && Array.isArray(data.staffEmails)) ? data.staffEmails.map(e => String(e).toLowerCase()) : [];
      }

      if (ownerEmails.includes(normalizedEmail)) {
        throw new Error("Email already exists in the owner list. Cannot be both owner and staff.");
      }
      
      if (roleDoc.exists()) {
        transaction.update(roleManagementRef, { staffEmails: arrayUnion(normalizedEmail) });
      } else {
        transaction.set(roleManagementRef, { ownerEmails: [], staffEmails: [normalizedEmail] });
      }
      
      // Ensure user document exists with displayName, remove loginApprovalStatus and lastLoginRequestTimestamp
      transaction.set(userDocRef, { 
        email: normalizedEmail, 
        displayName: normalizedEmail, 
      }, { merge: true });
    });
        
    revalidatePath("/admin/settings");
    return { success: true, message: "Staff email added. They can log in directly." };
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
    // const userDocRef = doc(db, USERS_COLLECTION, normalizedEmailToRemove); // No longer need to update userDoc for approval status

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

      // No longer setting loginApprovalStatus to 'denied' as the system is reverted
      // transaction.set(userDocRef, { loginApprovalStatus: 'denied' }, { merge: true });
    });
    
    revalidatePath("/admin/settings");
    return { success: true, message: "Staff email removed successfully." };
  } catch (error) {
    console.error("Error removing staff email:", error);
    return { success: false, message: `Failed to remove staff email: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

// --- Staff Login Approval Actions (Removed as system is reverted) ---
// interface PendingStaffUser {
//   email: string;
//   displayName?: string;
//   lastLoginRequestTimestamp?: string;
// }
// export async function getPendingStaffAction(): Promise<PendingStaffUser[]> { return []; }
// export async function approveStaffLoginAction(staffEmail: string): Promise<{ success: boolean; message: string }> { return {success: false, message: "Feature disabled."}; }
// export async function denyStaffLoginAction(staffEmail: string): Promise<{ success: boolean; message: string }> { return {success: false, message: "Feature disabled."}; }
    

    