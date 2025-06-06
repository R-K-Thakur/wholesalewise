
"use server";

import { revalidatePath } from "next/cache";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, Timestamp, writeBatch, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getSession, type SessionData } from "@/app/login/actions";
import type { UserAccessDetails } from "@/lib/types";

const APP_SETTINGS_COLLECTION = "app_settings";
const ROLE_MANAGEMENT_DOC = "role_management";
const USERS_COLLECTION = "users";

const DEFAULT_STAFF_LOGIN_START_TIME = "09:00";
const DEFAULT_STAFF_LOGIN_END_TIME = "23:00";


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
      let staffLoginStartTime = DEFAULT_STAFF_LOGIN_START_TIME;
      let staffLoginEndTime = DEFAULT_STAFF_LOGIN_END_TIME;


      if (roleDoc.exists()) {
        const data = roleDoc.data();
        ownerEmails = (data?.ownerEmails && Array.isArray(data.ownerEmails)) ? data.ownerEmails.map(e => String(e).toLowerCase()) : [];
        staffEmails = (data?.staffEmails && Array.isArray(data.staffEmails)) ? data.staffEmails.map(e => String(e).toLowerCase()) : [];
        staffLoginStartTime = data?.staffLoginStartTime || DEFAULT_STAFF_LOGIN_START_TIME;
        staffLoginEndTime = data?.staffLoginEndTime || DEFAULT_STAFF_LOGIN_END_TIME;
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
        const initialRoleData: any = { 
          ownerEmails: [normalizedEmail], 
          staffEmails: [],
          staffLoginStartTime: staffLoginStartTime, // Use existing or default
          staffLoginEndTime: staffLoginEndTime,     // Use existing or default
        };
        transaction.set(roleManagementRef, initialRoleData);
      }
      
      transaction.set(userDocRef, { 
        email: normalizedEmail, 
        displayName: normalizedEmail,
        loginManuallyDisabled: false, 
      }, { merge: true });
    });
    
    revalidatePath("/admin/settings");
    revalidatePath("/admin/staff-access"); 
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
      let staffLoginStartTime = DEFAULT_STAFF_LOGIN_START_TIME;
      let staffLoginEndTime = DEFAULT_STAFF_LOGIN_END_TIME;

      if (roleDoc.exists()) {
        const data = roleDoc.data();
        ownerEmails = (data?.ownerEmails && Array.isArray(data.ownerEmails)) ? data.ownerEmails.map(e => String(e).toLowerCase()) : [];
        staffEmails = (data?.staffEmails && Array.isArray(data.staffEmails)) ? data.staffEmails.map(e => String(e).toLowerCase()) : [];
        staffLoginStartTime = data?.staffLoginStartTime || DEFAULT_STAFF_LOGIN_START_TIME;
        staffLoginEndTime = data?.staffLoginEndTime || DEFAULT_STAFF_LOGIN_END_TIME;
      }

      if (ownerEmails.includes(normalizedEmail)) {
        throw new Error("Email already exists in the owner list. Cannot be both owner and staff.");
      }
      if (staffEmails.includes(normalizedEmail)) {
         transaction.set(userDocRef, {
          email: normalizedEmail,
          displayName: normalizedEmail, 
          loginManuallyDisabled: false,
        }, { merge: true });
        throw new Error("Email already exists in the staff list. Their login access has been ensured to be enabled.");
      }
      
      if (roleDoc.exists()) {
        transaction.update(roleManagementRef, { staffEmails: arrayUnion(normalizedEmail) });
      } else {
        transaction.set(roleManagementRef, { 
            ownerEmails: [], 
            staffEmails: [normalizedEmail],
            staffLoginStartTime: staffLoginStartTime,
            staffLoginEndTime: staffLoginEndTime,
        });
      }
      
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
          loginManuallyDisabled: userData?.loginManuallyDisabled === true, 
        });
      } else {
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

// --- Staff Login Time Window Actions ---

export async function getLoginTimeSettingsAction(): Promise<{ startTime: string; endTime: string }> {
  if (!db) {
    console.error("Firestore (db) instance is not initialized. Returning default times.");
    return { startTime: DEFAULT_STAFF_LOGIN_START_TIME, endTime: DEFAULT_STAFF_LOGIN_END_TIME };
  }
  try {
    const docRef = doc(db, APP_SETTINGS_COLLECTION, ROLE_MANAGEMENT_DOC);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        startTime: data?.staffLoginStartTime || DEFAULT_STAFF_LOGIN_START_TIME,
        endTime: data?.staffLoginEndTime || DEFAULT_STAFF_LOGIN_END_TIME,
      };
    }
    return { startTime: DEFAULT_STAFF_LOGIN_START_TIME, endTime: DEFAULT_STAFF_LOGIN_END_TIME };
  } catch (error) {
    console.error("Error fetching login time settings:", error);
    return { startTime: DEFAULT_STAFF_LOGIN_START_TIME, endTime: DEFAULT_STAFF_LOGIN_END_TIME };
  }
}

export async function updateLoginTimeSettingsAction(newStartTime: string, newEndTime: string): Promise<{ success: boolean; message: string }> {
  try {
    await verifyOwner();
    if (!db) {
      return { success: false, message: "Database service not available." };
    }

    // Basic validation for HH:MM format
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(newStartTime) || !timeRegex.test(newEndTime)) {
      return { success: false, message: "Invalid time format. Please use HH:MM (24-hour)." };
    }
    
    // Optional: Add logic to ensure start time is before end time if needed for your business rules,
    // though for simple "between HH:MM and HH:MM" it might not be strictly necessary if interpreted correctly.

    const settingsRef = doc(db, APP_SETTINGS_COLLECTION, ROLE_MANAGEMENT_DOC);
    await setDoc(settingsRef, {
      staffLoginStartTime: newStartTime,
      staffLoginEndTime: newEndTime,
    }, { merge: true });

    revalidatePath("/admin/settings");
    return { success: true, message: "Staff login time window updated successfully." };
  } catch (error) {
    console.error("Error updating login time settings:", error);
    return { success: false, message: `Failed to update settings: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}
