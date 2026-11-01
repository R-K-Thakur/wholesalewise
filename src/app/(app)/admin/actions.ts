
"use server";

import { revalidatePath } from "next/cache";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, Timestamp, writeBatch, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getSession, type SessionData } from "@/app/login/actions";
import type { StaffMember, StaffMemberInput } from "@/lib/types";

const APP_SETTINGS_COLLECTION = "app_settings";
const ROLE_MANAGEMENT_DOC = "role_management";
const USERS_COLLECTION = "users";
const STAFF_MEMBERS_COLLECTION = "staff_members";

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

// --- Comprehensive Staff Members & Credentials Management Actions ---

export async function getStaffMembersAction(): Promise<StaffMember[]> {
  try {
    await verifyOwner();
    if (!db) {
      console.error("Firestore (db) instance is not initialized.");
      return [];
    }

    const staffMembersRef = collection(db, STAFF_MEMBERS_COLLECTION);
    const querySnap = await getDocs(staffMembersRef);
    const members: StaffMember[] = [];

    querySnap.forEach((docSnap) => {
      const data = docSnap.data();
      members.push({
        id: docSnap.id,
        staffId: data.staffId || docSnap.id,
        name: data.name || data.staffId || "Staff Member",
        email: data.email || "",
        password: data.password || "",
        role: "staff",
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
        notes: data.notes || "",
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      });
    });

    // Also check for legacy staffEmails in role_management that aren't yet in staff_members
    try {
      const roleRef = doc(db, APP_SETTINGS_COLLECTION, ROLE_MANAGEMENT_DOC);
      const roleSnap = await getDoc(roleRef);
      if (roleSnap.exists()) {
        const roleData = roleSnap.data();
        const staffEmails: string[] = Array.isArray(roleData.staffEmails) ? roleData.staffEmails : [];
        for (const email of staffEmails) {
          const lower = email.toLowerCase();
          const existing = members.find((m) => m.email.toLowerCase() === lower);
          if (!existing) {
            const fallbackId = lower.split("@")[0].replace(/[^a-zA-Z0-9_-]/g, "");
            members.push({
              id: `legacy_${lower.replace(/[^a-zA-Z0-9]/g, "_")}`,
              staffId: fallbackId || "staff",
              name: lower.split("@")[0],
              email: lower,
              password: "", // Indicates password needs to be set
              role: "staff",
              isActive: true,
              notes: "Legacy email account (Set password to enable ID/password login)",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
    } catch (e) {
      console.warn("Could not check legacy staffEmails:", e);
    }

    // Sort by name or staffId
    members.sort((a, b) => a.name.localeCompare(b.name));
    return members;
  } catch (error) {
    console.error("Error fetching staff members:", error);
    return [];
  }
}

export async function addStaffMemberAction(
  input: StaffMemberInput
): Promise<{ success: boolean; message: string; staff?: StaffMember }> {
  try {
    await verifyOwner();
    if (!db) {
      return { success: false, message: "Database service not available." };
    }

    const trimmedStaffId = input.staffId ? input.staffId.trim() : "";
    const trimmedName = input.name ? input.name.trim() : "";
    const trimmedPassword = input.password ? input.password.trim() : "";
    let trimmedEmail = input.email ? input.email.trim().toLowerCase() : "";

    if (!trimmedStaffId || trimmedStaffId.length < 2) {
      return { success: false, message: "Staff ID is required and must be at least 2 characters." };
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedStaffId)) {
      return { success: false, message: "Staff ID can only contain letters, numbers, hyphens, and underscores." };
    }
    if (!trimmedName) {
      return { success: false, message: "Staff name is required." };
    }
    if (!trimmedPassword || trimmedPassword.length < 3) {
      return { success: false, message: "Password must be at least 3 characters long." };
    }

    // If no email provided or invalid email, create a default unique system email
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      trimmedEmail = `${trimmedStaffId.toLowerCase()}@wholesalewise.staff`;
    }

    // Check if email conflicts with owner emails
    const roleManagementRef = doc(db, APP_SETTINGS_COLLECTION, ROLE_MANAGEMENT_DOC);
    const roleSnap = await getDoc(roleManagementRef);
    if (roleSnap.exists()) {
      const roleData = roleSnap.data();
      const ownerEmails: string[] = Array.isArray(roleData.ownerEmails)
        ? roleData.ownerEmails.map((e) => String(e).toLowerCase())
        : [];
      if (ownerEmails.includes(trimmedEmail)) {
        return { success: false, message: "This email is registered as an Owner account and cannot be used for staff." };
      }
    }

    // Check if staffId already exists in staff_members
    const staffMembersRef = collection(db, STAFF_MEMBERS_COLLECTION);
    const existingStaffSnap = await getDocs(
      query(staffMembersRef, where("staffId", "==", trimmedStaffId))
    );
    if (!existingStaffSnap.empty) {
      return { success: false, message: `Staff ID '${trimmedStaffId}' is already in use. Please choose a different ID.` };
    }

    // Also check case-insensitive match by ID
    const docId = trimmedStaffId.toLowerCase();
    const docRef = doc(db, STAFF_MEMBERS_COLLECTION, docId);
    const directDocSnap = await getDoc(docRef);
    if (directDocSnap.exists()) {
      return { success: false, message: `Staff ID '${trimmedStaffId}' already exists.` };
    }

    const now = new Date().toISOString();
    const newStaff: StaffMember = {
      id: docId,
      staffId: trimmedStaffId,
      name: trimmedName,
      email: trimmedEmail,
      password: trimmedPassword,
      role: "staff",
      isActive: input.isActive !== undefined ? input.isActive : true,
      notes: input.notes ? input.notes.trim() : "",
      createdAt: now,
      updatedAt: now,
    };

    // Save staff member doc
    await setDoc(docRef, newStaff);

    // Ensure staff email is added to role_management staffEmails
    await setDoc(
      roleManagementRef,
      {
        staffEmails: arrayUnion(trimmedEmail),
      },
      { merge: true }
    );

    // Ensure users doc exists for profile/invoicing consistency
    const userDocRef = doc(db, USERS_COLLECTION, trimmedEmail);
    await setDoc(
      userDocRef,
      {
        email: trimmedEmail,
        displayName: trimmedName,
        role: "staff",
      },
      { merge: true }
    );

    revalidatePath("/admin/settings");
    return {
      success: true,
      message: `Staff member '${trimmedName}' (ID: ${trimmedStaffId}) added successfully with full credentials saved.`,
      staff: newStaff,
    };
  } catch (error) {
    console.error("Error adding staff member:", error);
    return {
      success: false,
      message: `Failed to add staff member: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export async function updateStaffMemberAction(
  id: string,
  input: {
    staffId?: string;
    name?: string;
    email?: string;
    password?: string;
    isActive?: boolean;
    notes?: string;
  }
): Promise<{ success: boolean; message: string }> {
  try {
    await verifyOwner();
    if (!db) {
      return { success: false, message: "Database service not available." };
    }
    if (!id) {
      return { success: false, message: "Staff identifier is required." };
    }

    let targetDocId = id;
    let docRef = doc(db, STAFF_MEMBERS_COLLECTION, targetDocId);
    let docSnap = await getDoc(docRef);

    // If not found and starts with legacy_, check by email
    if (!docSnap.exists() && id.startsWith("legacy_")) {
      const emailQuery = input.email?.toLowerCase();
      if (emailQuery) {
        const staffQuery = await getDocs(
          query(collection(db, STAFF_MEMBERS_COLLECTION), where("email", "==", emailQuery))
        );
        if (!staffQuery.empty) {
          targetDocId = staffQuery.docs[0].id;
          docRef = doc(db, STAFF_MEMBERS_COLLECTION, targetDocId);
          docSnap = staffQuery.docs[0];
        }
      }
    }

    const updates: Partial<StaffMember> & { updatedAt: string } = {
      updatedAt: new Date().toISOString(),
    };

    if (input.name !== undefined) {
      const trimmedName = input.name.trim();
      if (!trimmedName) return { success: false, message: "Staff name cannot be empty." };
      updates.name = trimmedName;
    }

    if (input.password !== undefined && input.password.trim() !== "") {
      const trimmedPassword = input.password.trim();
      if (trimmedPassword.length < 3) {
        return { success: false, message: "Password must be at least 3 characters." };
      }
      updates.password = trimmedPassword;
    }

    if (input.isActive !== undefined) {
      updates.isActive = Boolean(input.isActive);
    }

    if (input.notes !== undefined) {
      updates.notes = input.notes.trim();
    }

    let newEmail = input.email ? input.email.trim().toLowerCase() : undefined;
    let oldEmail: string | undefined = docSnap.exists() ? docSnap.data().email : undefined;

    if (newEmail && newEmail !== oldEmail) {
      if (!newEmail.includes("@")) {
        return { success: false, message: "Invalid email address format." };
      }
      updates.email = newEmail;
    }

    if (docSnap.exists()) {
      await updateDoc(docRef, updates);
    } else {
      // If doc didn't exist (e.g. legacy entry being upgraded with full credentials)
      const staffId = input.staffId?.trim() || id.replace("legacy_", "");
      const now = new Date().toISOString();
      const newStaffDoc: StaffMember = {
        id: staffId.toLowerCase(),
        staffId: staffId,
        name: input.name?.trim() || staffId,
        email: newEmail || `${staffId.toLowerCase()}@wholesalewise.staff`,
        password: input.password?.trim() || "123456",
        role: "staff",
        isActive: input.isActive !== undefined ? input.isActive : true,
        notes: input.notes?.trim() || "",
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(doc(db, STAFF_MEMBERS_COLLECTION, newStaffDoc.id), newStaffDoc);
    }

    // Sync email with role_management if email changed or was added
    if (newEmail) {
      const roleRef = doc(db, APP_SETTINGS_COLLECTION, ROLE_MANAGEMENT_DOC);
      const batchUpdates: any = { staffEmails: arrayUnion(newEmail) };
      if (oldEmail && oldEmail !== newEmail) {
        batchUpdates.staffEmails = arrayRemove(oldEmail);
      }
      await updateDoc(roleRef, batchUpdates).catch(async () => {
        await setDoc(roleRef, { staffEmails: [newEmail] }, { merge: true });
      });

      // Update user doc displayName
      if (updates.name) {
        await setDoc(
          doc(db, USERS_COLLECTION, newEmail),
          { email: newEmail, displayName: updates.name, role: "staff" },
          { merge: true }
        );
      }
    }

    revalidatePath("/admin/settings");
    return { success: true, message: "Staff credentials and details updated successfully." };
  } catch (error) {
    console.error("Error updating staff member:", error);
    return {
      success: false,
      message: `Failed to update staff member: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export async function resetStaffPasswordAction(
  id: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  try {
    await verifyOwner();
    if (!db) {
      return { success: false, message: "Database service not available." };
    }
    const trimmed = newPassword ? newPassword.trim() : "";
    if (!trimmed || trimmed.length < 3) {
      return { success: false, message: "Password must be at least 3 characters long." };
    }

    const docRef = doc(db, STAFF_MEMBERS_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      return { success: false, message: "Staff member record not found." };
    }

    await updateDoc(docRef, {
      password: trimmed,
      updatedAt: new Date().toISOString(),
    });

    revalidatePath("/admin/settings");
    return { success: true, message: `Password reset successfully. New password is: ${trimmed}` };
  } catch (error) {
    console.error("Error resetting staff password:", error);
    return {
      success: false,
      message: `Failed to reset password: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export async function deleteStaffMemberAction(id: string): Promise<{ success: boolean; message: string }> {
  try {
    await verifyOwner();
    if (!db) {
      return { success: false, message: "Database service not available." };
    }

    let emailToRemove: string | null = null;
    const docRef = doc(db, STAFF_MEMBERS_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      emailToRemove = data.email || null;
      await deleteDoc(docRef);
    } else if (id.startsWith("legacy_")) {
      // Legacy item where id encodes the email
      const roleRef = doc(db, APP_SETTINGS_COLLECTION, ROLE_MANAGEMENT_DOC);
      const roleSnap = await getDoc(roleRef);
      if (roleSnap.exists()) {
        const staffEmails: string[] = roleSnap.data().staffEmails || [];
        for (const e of staffEmails) {
          if (`legacy_${e.toLowerCase().replace(/[^a-zA-Z0-9]/g, "_")}` === id) {
            emailToRemove = e;
            break;
          }
        }
      }
    }

    // Remove from role_management if email was found
    if (emailToRemove) {
      const roleRef = doc(db, APP_SETTINGS_COLLECTION, ROLE_MANAGEMENT_DOC);
      await updateDoc(roleRef, {
        staffEmails: arrayRemove(emailToRemove.toLowerCase()),
      }).catch((e) => console.warn("Failed to remove staff email from role_management:", e));
    }

    revalidatePath("/admin/settings");
    return { success: true, message: "Staff member deleted and credentials removed." };
  } catch (error) {
    console.error("Error deleting staff member:", error);
    return {
      success: false,
      message: `Failed to delete staff member: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

    
    

    

    