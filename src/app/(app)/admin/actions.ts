
"use server";

import { revalidatePath } from "next/cache";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, Timestamp } from "firebase/firestore";
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
    const docRef = doc(db, APP_SETTINGS_COLLECTION, ROLE_MANAGEMENT_DOC);
    const docSnap = await getDoc(docRef);

    let ownerEmails: string[] = [];
    let staffEmails: string[] = [];
    let updates: { ownerEmails?: any; staffEmails?: any } = {}; // Firestore update payload

    if (docSnap.exists()) {
      const data = docSnap.data();
      ownerEmails = (data?.ownerEmails && Array.isArray(data.ownerEmails)) ? data.ownerEmails.map(e => String(e).toLowerCase()) : [];
      staffEmails = (data?.staffEmails && Array.isArray(data.staffEmails)) ? data.staffEmails.map(e => String(e).toLowerCase()) : [];
    }

    if (ownerEmails.includes(normalizedEmail)) {
      return { success: false, message: "Email already exists in the owner list." };
    }

    // If email is in staff list, prepare to remove it from staff
    if (staffEmails.includes(normalizedEmail)) {
      updates.staffEmails = arrayRemove(normalizedEmail);
      // We will proceed to add it to owners
      console.log(`Promoting ${normalizedEmail} from staff to owner.`);
    }
    
    updates.ownerEmails = arrayUnion(normalizedEmail);

    if (docSnap.exists()) {
      await updateDoc(docRef, updates);
    } else {
      // If doc doesn't exist, create it with the new owner and empty staff (unless staff was just removed)
      const initialData: any = { ownerEmails: [normalizedEmail], staffEmails: [] };
      if (updates.staffEmails) { // This case is unlikely if docSnap doesn't exist but for completeness
        initialData.staffEmails = []; // Ensure it's empty after potential removal
      }
      await setDoc(docRef, initialData);
    }
    
    // Also update the user's document to ensure they are approved
    const userDocRef = doc(db, USERS_COLLECTION, normalizedEmail);
    await setDoc(userDocRef, { email: normalizedEmail, loginApprovalStatus: 'approved', displayName: normalizedEmail }, { merge: true });

    revalidatePath("/admin/settings");
    return { success: true, message: "Owner email added successfully." + (updates.staffEmails ? " Email removed from staff list." : "") };
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
    const docRef = doc(db, APP_SETTINGS_COLLECTION, ROLE_MANAGEMENT_DOC);
    const docSnap = await getDoc(docRef);

    let ownerEmails: string[] = [];
    let staffEmails: string[] = [];

    if (docSnap.exists()) {
      const data = docSnap.data();
      ownerEmails = (data?.ownerEmails && Array.isArray(data.ownerEmails)) ? data.ownerEmails.map(e => String(e).toLowerCase()) : [];
      staffEmails = (data?.staffEmails && Array.isArray(data.staffEmails)) ? data.staffEmails.map(e => String(e).toLowerCase()) : [];
    } else {
      // If role_management doc doesn't exist, create it.
      await setDoc(docRef, { ownerEmails: [], staffEmails: [normalizedEmail] });
      // Initialize user doc for new staff as pending
      const userDocRef = doc(db, USERS_COLLECTION, normalizedEmail);
      await setDoc(userDocRef, { 
        email: normalizedEmail, 
        displayName: normalizedEmail,
        loginApprovalStatus: 'pending', 
        lastLoginRequestTimestamp: new Date().toISOString()
      }, { merge: true });
      revalidatePath("/admin/settings");
      return { success: true, message: "Staff email added successfully. Login approval is pending." };
    }

    if (ownerEmails.includes(normalizedEmail)) {
      return { success: false, message: "Email already exists in the owner list. Cannot be both owner and staff." };
    }
    if (staffEmails.includes(normalizedEmail)) {
      return { success: false, message: "Email already exists in the staff list." };
    }
    
    await updateDoc(docRef, {
      staffEmails: arrayUnion(normalizedEmail)
    });
    // Initialize or update user doc for new staff as pending
    const userDocRef = doc(db, USERS_COLLECTION, normalizedEmail);
    await setDoc(userDocRef, { 
      email: normalizedEmail, 
      displayName: normalizedEmail,
      loginApprovalStatus: 'pending',
      lastLoginRequestTimestamp: new Date().toISOString()
    }, { merge: true });
    
    revalidatePath("/admin/settings");
    return { success: true, message: "Staff email added successfully. Login approval is pending." };
  } catch (error) {
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
    const docRef = doc(db, APP_SETTINGS_COLLECTION, ROLE_MANAGEMENT_DOC);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { success: false, message: "Role management document not found." };
    }

    const data = docSnap.data();
    let staffEmails: string[] = (data?.staffEmails && Array.isArray(data.staffEmails)) ? data.staffEmails.map(e => String(e).toLowerCase()) : [];

    if (!staffEmails.includes(normalizedEmailToRemove)) {
      return { success: false, message: "Email not found in the staff list." };
    }

    await updateDoc(docRef, {
      staffEmails: arrayRemove(normalizedEmailToRemove)
    });
    
    // Deny login for the removed staff member to prevent access if they were pending/approved
    const userDocRef = doc(db, USERS_COLLECTION, normalizedEmailToRemove);
    await updateDoc(userDocRef, {
        loginApprovalStatus: 'denied'
    }).catch(err => console.warn(`Could not update login status for removed staff ${normalizedEmailToRemove}: ${err.message}`));


    revalidatePath("/admin/settings");
    return { success: true, message: "Staff email removed successfully and their login access (if any) has been set to denied." };
  } catch (error) {
    console.error("Error removing staff email:", error);
    return { success: false, message: `Failed to remove staff email: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}


// --- Staff Login Approval Actions ---

interface PendingStaffUser {
  email: string;
  displayName?: string;
  requestTimestamp?: string;
}

export async function getPendingStaffAction(): Promise<PendingStaffUser[]> {
  await verifyOwner();
  if (!db) {
    console.error("Firestore (db) instance is not initialized. Cannot fetch pending staff.");
    return [];
  }
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    // Query for users who are in staffEmails list AND have loginApprovalStatus 'pending'
    // First, get the list of staff emails
    const roleDocRef = doc(db, APP_SETTINGS_COLLECTION, ROLE_MANAGEMENT_DOC);
    const roleDocSnap = await getDoc(roleDocRef);
    let staffEmails: string[] = [];
    if (roleDocSnap.exists()) {
        const roleData = roleDocSnap.data();
        staffEmails = (roleData?.staffEmails && Array.isArray(roleData.staffEmails)) ? roleData.staffEmails.map(e => String(e).toLowerCase()) : [];
    }

    if (staffEmails.length === 0) {
        return []; // No staff emails, so no pending staff.
    }

    // Firestore "in" query limit is 30. If more staff, need multiple queries or different approach.
    // For now, assume staff list is manageable.
    const q = query(usersRef, where("email", "in", staffEmails), where("loginApprovalStatus", "==", "pending"));
    const querySnapshot = await getDocs(q);
    
    const pendingStaff: PendingStaffUser[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      pendingStaff.push({
        email: data.email,
        displayName: data.displayName || data.email,
        requestTimestamp: data.lastLoginRequestTimestamp 
          ? new Date(data.lastLoginRequestTimestamp).toLocaleString() 
          : "N/A",
      });
    });
    return pendingStaff;
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
  const normalizedEmail = staffEmail.toLowerCase();
  const userDocRef = doc(db, USERS_COLLECTION, normalizedEmail);

  try {
    // Ensure the user is actually in the staff list before approving
    const roleDocRef = doc(db, APP_SETTINGS_COLLECTION, ROLE_MANAGEMENT_DOC);
    const roleDocSnap = await getDoc(roleDocRef);
    if (roleDocSnap.exists()) {
        const staffEmails = (roleDocSnap.data()?.staffEmails || []).map((e:string) => e.toLowerCase());
        if (!staffEmails.includes(normalizedEmail)) {
            return { success: false, message: `Cannot approve: ${staffEmail} is not in the current staff list.` };
        }
    } else {
        return { success: false, message: "Role management document not found." };
    }

    await updateDoc(userDocRef, {
      loginApprovalStatus: 'approved',
    });
    revalidatePath("/admin/settings");
    return { success: true, message: `Login approved for ${staffEmail}.` };
  } catch (error) {
    console.error(`Error approving staff login for ${staffEmail}:`, error);
    return { success: false, message: `Failed to approve login for ${staffEmail}: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

export async function denyStaffLoginAction(staffEmail: string): Promise<{ success: boolean; message: string }> {
  await verifyOwner();
  if (!staffEmail) {
    return { success: false, message: "Staff email is required." };
  }
  const normalizedEmail = staffEmail.toLowerCase();
  const userDocRef = doc(db, USERS_COLLECTION, normalizedEmail);

  try {
    await updateDoc(userDocRef, {
      loginApprovalStatus: 'denied',
    });
    revalidatePath("/admin/settings");
    return { success: true, message: `Login denied for ${staffEmail}.` };
  } catch (error) {
    console.error(`Error denying staff login for ${staffEmail}:`, error);
    return { success: false, message: `Failed to deny login for ${staffEmail}: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}
    

    