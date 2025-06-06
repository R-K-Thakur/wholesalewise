
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
      // staffEmailsUpdated = false; // This variable was unused

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
        // staffEmailsUpdated = true;
      }
      
      if (roleDoc.exists()) {
        transaction.update(roleManagementRef, updatePayload);
      } else {
        // If role_management doc doesn't exist, create it with the new owner and an empty staff list
        const initialRoleData: any = { ownerEmails: [normalizedEmail], staffEmails: [] };
        if (updatePayload.staffEmails && Array.isArray(updatePayload.staffEmails) && updatePayload.staffEmails.length > 0) {
            // This case is tricky: updatePayload.staffEmails contains arrayRemove.
            // For a new doc, if a staff was removed, it implies it shouldn't be in initial staffEmails.
        } else if (staffEmails.includes(normalizedEmail) && updatePayload.staffEmails === undefined) {
             // If it was in staffEmails, and we decided to remove it, ensure staffEmails starts empty or without it.
        }
        transaction.set(roleManagementRef, initialRoleData);
      }
      
      transaction.set(userDocRef, { 
        email: normalizedEmail, 
        displayName: normalizedEmail, 
        loginApprovalStatus: 'approved' 
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
      let staffEmails: string[] = [];

      if (roleDoc.exists()) {
        const data = roleDoc.data();
        ownerEmails = (data?.ownerEmails && Array.isArray(data.ownerEmails)) ? data.ownerEmails.map(e => String(e).toLowerCase()) : [];
        staffEmails = (data?.staffEmails && Array.isArray(data.staffEmails)) ? data.staffEmails.map(e => String(e).toLowerCase()) : [];
      }

      if (ownerEmails.includes(normalizedEmail)) {
        throw new Error("Email already exists in the owner list. Cannot be both owner and staff.");
      }
      // It's okay if they are already in staffEmails, this action will just re-ensure their user doc is set for pending.
      
      if (roleDoc.exists()) {
        transaction.update(roleManagementRef, { staffEmails: arrayUnion(normalizedEmail) });
      } else {
        // If role_management doc doesn't exist, create it with the new staff and an empty owner list
        transaction.set(roleManagementRef, { ownerEmails: [], staffEmails: [normalizedEmail] });
      }
      
      transaction.set(userDocRef, { 
        email: normalizedEmail, 
        displayName: normalizedEmail, 
        loginApprovalStatus: 'pending',
        lastLoginRequestTimestamp: new Date().toISOString()
      }, { merge: true });
    });
        
    revalidatePath("/admin/settings");
    return { success: true, message: "Staff email added. Their login will require owner approval." };
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
    const userDocRef = doc(db, USERS_COLLECTION, normalizedEmailToRemove);

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

      transaction.set(userDocRef, { loginApprovalStatus: 'denied' }, { merge: true });
    });
    
    revalidatePath("/admin/settings");
    return { success: true, message: "Staff email removed successfully." };
  } catch (error) {
    console.error("Error removing staff email:", error);
    return { success: false, message: `Failed to remove staff email: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

// --- Staff Login Approval Actions ---
interface PendingStaffUser {
  email: string;
  displayName?: string;
  lastLoginRequestTimestamp?: string;
}

export async function getPendingStaffAction(): Promise<PendingStaffUser[]> {
  try {
    await verifyOwner(); // Ensures only owners can call this
    if (!db) {
      console.error("Firestore (db) instance is not initialized. Cannot fetch pending staff. Returning empty list.");
      return [];
    }
    
    const usersRef = collection(db, USERS_COLLECTION);
    const roleManagementRef = doc(db, APP_SETTINGS_COLLECTION, ROLE_MANAGEMENT_DOC);
    const roleDocSnap = await getDoc(roleManagementRef);
    let currentStaffEmails: string[] = [];

    if (roleDocSnap.exists() && Array.isArray(roleDocSnap.data()?.staffEmails)) {
        currentStaffEmails = (roleDocSnap.data()?.staffEmails as string[]).map(e => String(e).toLowerCase());
    }

    const q = query(usersRef, where("loginApprovalStatus", "==", "pending"));
    const querySnapshot = await getDocs(q);
    
    const pendingUsers: PendingStaffUser[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const userEmail = (data.email || docSnap.id).toLowerCase();
      
      // Only consider users for pending approval if they are currently listed in staffEmails
      if (currentStaffEmails.includes(userEmail)) {
        pendingUsers.push({
          email: userEmail,
          displayName: data.displayName,
          lastLoginRequestTimestamp: data.lastLoginRequestTimestamp,
        });
      }
    });

    pendingUsers.sort((a, b) => {
        if (a.lastLoginRequestTimestamp && b.lastLoginRequestTimestamp) {
            return new Date(b.lastLoginRequestTimestamp).getTime() - new Date(a.lastLoginRequestTimestamp).getTime();
        }
        if (a.lastLoginRequestTimestamp) return -1;
        if (b.lastLoginRequestTimestamp) return 1;
        return 0;
    });
    return pendingUsers;
  } catch (error) {
    console.error("Error in getPendingStaffAction:", error);
    // This catch block will handle errors from verifyOwner() or Firestore operations.
    // Returning an empty array is a safe default to prevent client-side crashes.
    // The client-side component (AdminSettingsPage) should independently verify session and redirect if not owner.
    return [];
  }
}


export async function approveStaffLoginAction(staffEmail: string): Promise<{ success: boolean; message: string }> {
  try {
    await verifyOwner();
    if (!db) {
      return { success: false, message: "Database service not available." };
    }
    if (!staffEmail) {
      return { success: false, message: "Staff email is required." };
    }
    const userDocRef = doc(db, USERS_COLLECTION, staffEmail.toLowerCase());
    await updateDoc(userDocRef, { loginApprovalStatus: 'approved' });
    revalidatePath("/admin/settings");
    return { success: true, message: `Login approved for ${staffEmail}.` };
  } catch (error) {
    console.error(`Error approving staff login for ${staffEmail}:`, error);
    return { success: false, message: `Failed to approve login: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

export async function denyStaffLoginAction(staffEmail: string): Promise<{ success: boolean; message: string }> {
  try {
    await verifyOwner();
    if (!db) {
      return { success: false, message: "Database service not available." };
    }
    if (!staffEmail) {
      return { success: false, message: "Staff email is required." };
    }
    const userDocRef = doc(db, USERS_COLLECTION, staffEmail.toLowerCase());
    await updateDoc(userDocRef, { loginApprovalStatus: 'denied' });
    revalidatePath("/admin/settings");
    return { success: true, message: `Login denied for ${staffEmail}.` };
  } catch (error) {
    console.error(`Error denying staff login for ${staffEmail}:`, error);
    return { success: false, message: `Failed to deny login: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}
    

    