
"use server";

import { revalidatePath } from "next/cache";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, Timestamp, writeBatch } from "firebase/firestore";
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
  await verifyOwner();
  
  if (!db) {
    return { success: false, message: "Database service not available." };
  }
  if (!emailToAdd || !emailToAdd.includes('@')) {
    return { success: false, message: "Invalid email format." };
  }
  const normalizedEmail = emailToAdd.toLowerCase();

  try {
    const roleManagementRef = doc(db, APP_SETTINGS_COLLECTION, ROLE_MANAGEMENT_DOC);
    const userDocRef = doc(db, USERS_COLLECTION, normalizedEmail);
    
    await runTransaction(db, async (transaction) => {
      const roleDoc = await transaction.get(roleManagementRef);
      let ownerEmails: string[] = [];
      let staffEmails: string[] = [];
      let staffEmailsUpdated = false;

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
        staffEmailsUpdated = true;
      }
      
      if (roleDoc.exists()) {
        transaction.update(roleManagementRef, updatePayload);
      } else {
        transaction.set(roleManagementRef, { ownerEmails: [normalizedEmail], staffEmails: [] });
      }
      
      // Set owner user document with approved status
      transaction.set(userDocRef, { 
        email: normalizedEmail, 
        displayName: normalizedEmail, // Default display name
        loginApprovalStatus: 'approved' 
      }, { merge: true });
    });
    
    revalidatePath("/admin/settings");
    let message = "Owner email added successfully. They can log in directly.";
    // This part of message might be confusing if promotion from staff happened, owner has full access regardless
    // if (staffEmailsUpdated) {
    //     message += ` ${normalizedEmail} was also removed from the staff list.`;
    // }
    return { success: true, message: message };
  } catch (error) {
    console.error("Error adding owner email:", error);
    return { success: false, message: `Failed to add owner email: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

export async function removeOwnerEmailAction(emailToRemove: string): Promise<{ success: boolean; message: string }> {
  await verifyOwner();

  if (!db) {
    return { success: false, message: "Database service not available." };
  }
  if (!emailToRemove) {
    return { success: false, message: "Email to remove is required." };
  }
  const normalizedEmailToRemove = emailToRemove.toLowerCase();

  try {
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
    
    // Optionally, update the removed owner's user document (e.g., set loginApprovalStatus to 'denied' or remove role field)
    // For now, just removing from owner list is sufficient.
    // const userDocRef = doc(db, USERS_COLLECTION, normalizedEmailToRemove);
    // await updateDoc(userDocRef, { loginApprovalStatus: 'denied' }); // Or some other status

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
  await verifyOwner(); 

  if (!db) {
    return { success: false, message: "Database service not available." };
  }
  if (!emailToAdd || !emailToAdd.includes('@')) {
    return { success: false, message: "Invalid email format." };
  }
  const normalizedEmail = emailToAdd.toLowerCase();

  try {
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
      if (staffEmails.includes(normalizedEmail)) {
        // If already staff, ensure their user doc is updated for pending approval if needed
        // However, if already in staff list, they are likely already approved or denied.
        // This function mainly focuses on adding *new* staff to the list.
        // If an existing staff is re-added, their approval status should ideally be checked/reset by owner if intended.
        // For simplicity here, we'll just note it.
        // For now, we don't throw an error, allowing re-addition to re-trigger pending if their user doc status isn't 'approved'.
        // throw new Error("Email already exists in the staff list."); 
      }
      
      if (roleDoc.exists()) {
        transaction.update(roleManagementRef, { staffEmails: arrayUnion(normalizedEmail) });
      } else {
        transaction.set(roleManagementRef, { ownerEmails: [], staffEmails: [normalizedEmail] });
      }
      
      // Set staff user document for pending approval
      transaction.set(userDocRef, { 
        email: normalizedEmail, 
        displayName: normalizedEmail, // Default display name
        loginApprovalStatus: 'pending',
        lastLoginRequestTimestamp: new Date().toISOString()
      }, { merge: true });
    });
        
    revalidatePath("/admin/settings");
    return { success: true, message: "Staff email added. Their login will require owner approval." };
  } catch (error)
 {
    console.error("Error adding staff email:", error);
    return { success: false, message: `Failed to add staff email: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

export async function removeStaffEmailAction(emailToRemove: string): Promise<{ success: boolean; message: string }> {
  await verifyOwner(); 

  if (!db) {
    return { success: false, message: "Database service not available." };
  }
  if (!emailToRemove) {
    return { success: false, message: "Email to remove is required." };
  }
  const normalizedEmailToRemove = emailToRemove.toLowerCase();

  try {
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

      // Optionally, update the removed staff's user document (e.g., set loginApprovalStatus to 'denied')
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
  await verifyOwner();
  if (!db) {
    console.error("Firestore (db) instance is not initialized. Cannot fetch pending staff. Returning empty list.");
    return [];
  }
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(usersRef, where("loginApprovalStatus", "==", "pending"));
    const querySnapshot = await getDocs(q);
    
    const pendingUsers: PendingStaffUser[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      pendingUsers.push({
        email: data.email || docSnap.id,
        displayName: data.displayName,
        lastLoginRequestTimestamp: data.lastLoginRequestTimestamp,
      });
    });
    // Sort by timestamp, newest first
    pendingUsers.sort((a, b) => {
        if (a.lastLoginRequestTimestamp && b.lastLoginRequestTimestamp) {
            return new Date(b.lastLoginRequestTimestamp).getTime() - new Date(a.lastLoginRequestTimestamp).getTime();
        }
        return 0;
    });
    return pendingUsers;
  } catch (error) {
    console.error("Error fetching pending staff:", error);
    return [];
  }
}

export async function approveStaffLoginAction(staffEmail: string): Promise<{ success: boolean; message: string }> {
  await verifyOwner();
  if (!staffEmail) {
    return { success: false, message: "Staff email is required." };
  }
  try {
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
  await verifyOwner();
  if (!staffEmail) {
    return { success: false, message: "Staff email is required." };
  }
  try {
    const userDocRef = doc(db, USERS_COLLECTION, staffEmail.toLowerCase());
    await updateDoc(userDocRef, { loginApprovalStatus: 'denied' });
    revalidatePath("/admin/settings");
    return { success: true, message: `Login denied for ${staffEmail}.` };
  } catch (error) {
    console.error(`Error denying staff login for ${staffEmail}:`, error);
    return { success: false, message: `Failed to deny login: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}
    

    