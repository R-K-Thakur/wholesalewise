
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
    let staffEmailsUpdated = false;

    if (docSnap.exists()) {
      const data = docSnap.data();
      ownerEmails = (data?.ownerEmails && Array.isArray(data.ownerEmails)) ? data.ownerEmails.map(e => String(e).toLowerCase()) : [];
      staffEmails = (data?.staffEmails && Array.isArray(data.staffEmails)) ? data.staffEmails.map(e => String(e).toLowerCase()) : [];
    }

    if (ownerEmails.includes(normalizedEmail)) {
      return { success: false, message: "Email already exists in the owner list." };
    }
    
    const updatePayload: { ownerEmails: any; staffEmails?: any } = { ownerEmails: arrayUnion(normalizedEmail) };

    // If email is in staff list, remove it
    if (staffEmails.includes(normalizedEmail)) {
      updatePayload.staffEmails = arrayRemove(normalizedEmail);
      staffEmailsUpdated = true;
      console.log(`${normalizedEmail} was removed from staff to be added as owner.`);
    }
    
    if (docSnap.exists()) {
      await updateDoc(docRef, updatePayload);
    } else {
      // If role_management doc doesn't exist, create it with the new owner and an empty staff list.
      // If staffEmails were part of the payload (due to removal), they are effectively handled by the new empty list.
      await setDoc(docRef, { ownerEmails: [normalizedEmail], staffEmails: [] });
    }
    
    const userDocRef = doc(db, USERS_COLLECTION, normalizedEmail);
    await setDoc(userDocRef, { email: normalizedEmail, displayName: normalizedEmail }, { merge: true });

    revalidatePath("/admin/settings");
    let message = "Owner email added successfully.";
    if (staffEmailsUpdated) {
        message += ` ${normalizedEmail} was also removed from the staff list.`;
    }
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
      await setDoc(docRef, { ownerEmails: [], staffEmails: [normalizedEmail] });
      const userDocRef = doc(db, USERS_COLLECTION, normalizedEmail);
      await setDoc(userDocRef, { 
        email: normalizedEmail, 
        displayName: normalizedEmail,
      }, { merge: true });
      revalidatePath("/admin/settings");
      return { success: true, message: "Staff email added successfully." };
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
    const userDocRef = doc(db, USERS_COLLECTION, normalizedEmail);
    await setDoc(userDocRef, { 
      email: normalizedEmail, 
      displayName: normalizedEmail,
    }, { merge: true });
    
    revalidatePath("/admin/settings");
    return { success: true, message: "Staff email added successfully." };
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
    
    revalidatePath("/admin/settings");
    return { success: true, message: "Staff email removed successfully." };
  } catch (error) {
    console.error("Error removing staff email:", error);
    return { success: false, message: `Failed to remove staff email: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}
