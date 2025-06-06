
"use server";

import { revalidatePath } from "next/cache";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, Timestamp, writeBatch, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getSession, type SessionData } from "@/app/login/actions";
import type { UserAccessDetails } from "@/lib/types";

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
      
      transaction.set(userDocRef, { 
        email: normalizedEmail, 
        displayName: normalizedEmail,
        loginManuallyDisabled: false, // Owners should always be able to log in
      }, { merge: true });
    });
    
    revalidatePath("/admin/settings");
    revalidatePath("/admin/staff-access"); // Revalidate new page
    return { success: true, message: "Owner email added successfully. Their login is enabled." };
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
    
    // Optionally, update the user's document if they are no longer an owner (e.g., disable login or change role if needed)
    // For now, just removing from owner list. Their login status would be re-evaluated if they try to log in.

    revalidatePath("/admin/settings");
    revalidatePath("/admin/staff-access");
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

      if (roleDoc.exists()) {
        const data = roleDoc.data();
        ownerEmails = (data?.ownerEmails && Array.isArray(data.ownerEmails)) ? data.ownerEmails.map(e => String(e).toLowerCase()) : [];
        staffEmails = (data?.staffEmails && Array.isArray(data.staffEmails)) ? data.staffEmails.map(e => String(e).toLowerCase()) : [];
      }

      if (ownerEmails.includes(normalizedEmail)) {
        throw new Error("Email already exists in the owner list. Cannot be both owner and staff.");
      }
      if (staffEmails.includes(normalizedEmail)) {
        // If staff email already exists, ensure their login is enabled (loginManuallyDisabled: false)
        // as per "default access is enabled" requirement.
         transaction.set(userDocRef, {
          email: normalizedEmail,
          displayName: normalizedEmail, // Or fetch existing displayName if preferred
          loginManuallyDisabled: false,
        }, { merge: true });
        throw new Error("Email already exists in the staff list. Their login access has been ensured to be enabled.");
      }
      
      if (roleDoc.exists()) {
        transaction.update(roleManagementRef, { staffEmails: arrayUnion(normalizedEmail) });
      } else {
        transaction.set(roleManagementRef, { ownerEmails: [], staffEmails: [normalizedEmail] });
      }
      
      // New staff: ensure user document exists with displayName and loginManuallyDisabled: false (enabled by default)
      transaction.set(userDocRef, { 
        email: normalizedEmail, 
        displayName: normalizedEmail, 
        loginManuallyDisabled: false,
      }, { merge: true });
    });
        
    revalidatePath("/admin/settings");
    revalidatePath("/admin/staff-access");
    return { success: true, message: "Staff email added. Their login is enabled by default." };
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

      // When staff is removed from the list, also disable their login access in their user document.
      // This prevents login even if they were somehow re-added later without explicit enabling.
      transaction.set(userDocRef, { loginManuallyDisabled: true }, { merge: true });
    });
    
    revalidatePath("/admin/settings");
    revalidatePath("/admin/staff-access");
    return { success: true, message: "Staff email removed successfully and their login access has been disabled." };
  } catch (error) {
    console.error("Error removing staff email:", error);
    return { success: false, message: `Failed to remove staff email: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

// --- Staff Login Access Management Actions ---

export async function getStaffWithAccessStatusAction(): Promise<UserAccessDetails[]> {
  try {
    await verifyOwner();
    if (!db) {
      console.error("DB not available for getStaffWithAccessStatusAction");
      return [];
    }

    const roleManagementRef = doc(db, APP_SETTINGS_COLLECTION, ROLE_MANAGEMENT_DOC);
    const roleDocSnap = await getDoc(roleManagementRef);

    if (!roleDocSnap.exists()) {
      console.warn("Role management document not found.");
      return [];
    }

    const roleData = roleDocSnap.data();
    const staffEmails: string[] = (roleData?.staffEmails && Array.isArray(roleData.staffEmails))
      ? roleData.staffEmails.map((e: any) => String(e).toLowerCase())
      : [];

    if (staffEmails.length === 0) {
      return [];
    }

    const staffAccessDetails: UserAccessDetails[] = [];

    for (const email of staffEmails) {
      const userDocRef = doc(db, USERS_COLLECTION, email);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        staffAccessDetails.push({
          email: email,
          displayName: userData?.displayName || email,
          loginManuallyDisabled: userData?.loginManuallyDisabled === true, // Explicitly check for true
        });
      } else {
        // Staff email exists in role_management but no user document yet.
        // Default to login enabled (not manually disabled).
        // This can happen if staff added but never logged in.
        // We should also create a basic user document for them here for consistency.
        await setDoc(userDocRef, {
            email: email,
            displayName: email,
            loginManuallyDisabled: false,
        }, { merge: true });
        staffAccessDetails.push({
          email: email,
          displayName: email,
          loginManuallyDisabled: false,
        });
      }
    }
    return staffAccessDetails;

  } catch (error) {
    console.error("Error in getStaffWithAccessStatusAction:", error);
    // Don't re-throw to client, return empty or partial if applicable
    return [];
  }
}

export async function toggleStaffLoginAccessAction(staffEmail: string, newDisabledState: boolean): Promise<{ success: boolean; message: string }> {
  try {
    await verifyOwner();
    if (!db) {
      return { success: false, message: "Database service not available." };
    }
    if (!staffEmail || !staffEmail.includes('@')) {
      return { success: false, message: "Invalid staff email provided." };
    }

    const normalizedEmail = staffEmail.toLowerCase();
    const userDocRef = doc(db, USERS_COLLECTION, normalizedEmail);
    
    // First check if this email is indeed in the staff list
    const roleManagementRef = doc(db, APP_SETTINGS_COLLECTION, ROLE_MANAGEMENT_DOC);
    const roleDocSnap = await getDoc(roleManagementRef);
    if (roleDocSnap.exists()) {
        const roleData = roleDocSnap.data();
        const staffEmails: string[] = (roleData?.staffEmails && Array.isArray(roleData.staffEmails))
        ? roleData.staffEmails.map((e: any) => String(e).toLowerCase())
        : [];
        if(!staffEmails.includes(normalizedEmail)){
            return { success: false, message: "This email is not listed as a staff member." };
        }
    } else {
        return { success: false, message: "Role management data not found." };
    }


    await setDoc(userDocRef, { loginManuallyDisabled: newDisabledState }, { merge: true });

    revalidatePath("/admin/staff-access");
    const actionVerb = newDisabledState ? "disabled" : "enabled";
    return { success: true, message: `Login access for ${staffEmail} has been ${actionVerb}.` };

  } catch (error) {
    console.error("Error in toggleStaffLoginAccessAction:", error);
    return { success: false, message: `Failed to update login access: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}
