
"use server";

import { revalidatePath } from "next/cache";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getSession, type SessionData } from "@/app/login/actions";

const APP_SETTINGS_COLLECTION = "app_settings";
const ROLE_MANAGEMENT_DOC = "role_management";

async function verifyOwner(): Promise<SessionData> {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    throw new Error("Unauthorized: Caller is not an owner.");
  }
  return session;
}

export async function getOwnerEmailsAction(): Promise<string[]> {
  if (!db) {
    console.error(
      "Firestore (db) instance is not initialized. Cannot fetch owner emails for admin actions. Returning empty list."
    );
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
    // Depending on requirements, you might want to throw the error
    // or return an empty list / specific error object.
    return [];
  }
}

export async function addOwnerEmailAction(emailToAdd: string): Promise<{ success: boolean; message: string }> {
  await verifyOwner();
  
  if (!db) {
    console.error("Firestore (db) instance is not initialized. Cannot add owner email.");
    return { success: false, message: "Database service not available." };
  }

  if (!emailToAdd || !emailToAdd.includes('@')) {
    return { success: false, message: "Invalid email format." };
  }
  const normalizedEmail = emailToAdd.toLowerCase();

  try {
    const docRef = doc(db, APP_SETTINGS_COLLECTION, ROLE_MANAGEMENT_DOC);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const currentEmails = docSnap.data()?.ownerEmails || [];
      if (Array.isArray(currentEmails) && currentEmails.map(e => String(e).toLowerCase()).includes(normalizedEmail)) {
        return { success: false, message: "Email already exists in the owner list." };
      }
      await updateDoc(docRef, {
        ownerEmails: arrayUnion(normalizedEmail)
      });
    } else {
      // Document doesn't exist, create it with the new email
      await setDoc(docRef, {
        ownerEmails: [normalizedEmail]
      });
    }
    revalidatePath("/admin/settings");
    return { success: true, message: "Owner email added successfully." };
  } catch (error) {
    console.error("Error adding owner email:", error);
    return { success: false, message: `Failed to add owner email: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

export async function removeOwnerEmailAction(emailToRemove: string): Promise<{ success: boolean; message: string }> {
  const session = await verifyOwner(); // session.email is the email of the current owner trying to perform the action

  if (!db) {
    console.error("Firestore (db) instance is not initialized. Cannot remove owner email.");
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
    
    // Prevent removing the last owner, especially if it's the current user
    if (ownerEmails.length === 1 && ownerEmails[0] === normalizedEmailToRemove) {
       return { success: false, message: "Cannot remove the last owner. To change the owner, add a new one first, then remove the old one." };
    }
    
    // Optional: Prevent an owner from removing themselves if they are not the very last one.
    // This logic can be adjusted. For now, an owner can remove another owner.
    // If you want to prevent self-removal unless they are the last owner (which is handled above):
    // if (normalizedEmailToRemove === session.email.toLowerCase() && ownerEmails.length > 1) {
    //   return { success: false, message: "Owners cannot remove themselves if other owners exist. Ask another owner to remove you."};
    // }


    await updateDoc(docRef, {
      ownerEmails: arrayRemove(normalizedEmailToRemove) // Firestore's arrayRemove handles if it's not there, but we checked.
    });
    
    revalidatePath("/admin/settings");
    return { success: true, message: "Owner email removed successfully." };
  } catch (error) {
    console.error("Error removing owner email:", error);
    return { success: false, message: `Failed to remove owner email: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}
