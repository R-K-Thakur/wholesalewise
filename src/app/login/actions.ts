
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// In a real application, use a secure way to store and verify passwords (e.g., hashing)
// and fetch users from a database.
// This USERS array and the loginAction are kept for potential direct API use or future re-integration,
// but the primary login mechanism is now Google Sign-In.
const USERS = [
  { username: "owner", password: "password", email: "owner@wholesalewise.com", role: "owner" as const, name: "Owner User" },
  { username: "staff", password: "password", email: "staff@wholesalewise.com", role: "staff" as const, name: "Staff User" },
];

const SESSION_COOKIE_NAME = "auth-session";
const APP_SETTINGS_COLLECTION = "app_settings";
const ROLE_MANAGEMENT_DOC = "role_management";

export interface SessionData {
  username: string;
  email: string;
  role: "owner" | "staff";
  name: string;
  uid?: string; // Add UID for Firebase users
}

export async function loginAction(formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!username || !password) {
    return { success: false, error: "Username and password are required." };
  }

  const user = USERS.find((u) => u.username === username);

  if (!user || user.password !== password) {
    return { success: false, error: "Invalid username or password." };
  }

  const sessionData: SessionData = {
    username: user.username,
    email: user.email,
    role: user.role,
    name: user.name,
  };

  cookies().set(SESSION_COOKIE_NAME, JSON.stringify(sessionData), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: "/",
    sameSite: "lax",
  });

  return { success: true };
}

export interface GoogleSignInData {
  email: string | null;
  name: string | null;
  uid: string;
}

async function getOwnerEmailsFromFirestore(): Promise<string[]> {
  try {
    const docRef = doc(db, APP_SETTINGS_COLLECTION, ROLE_MANAGEMENT_DOC);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && Array.isArray(data.ownerEmails)) {
        return data.ownerEmails.map(email => String(email).toLowerCase());
      }
    }
    console.warn(`Firestore: '${APP_SETTINGS_COLLECTION}/${ROLE_MANAGEMENT_DOC}' document not found or 'ownerEmails' field is missing/invalid. Defaulting to no owners.`);
    return [];
  } catch (error) {
    console.error("Error fetching owner emails from Firestore:", error);
    return []; // Default to no owners on error
  }
}

export async function signInWithGoogleAction(userData: GoogleSignInData) {
  if (!userData.email) {
    return { success: false, error: "Email not provided by Google Sign-In." };
  }

  const ownerEmails = await getOwnerEmailsFromFirestore();
  const userEmailLower = userData.email.toLowerCase();
  const userRole = ownerEmails.includes(userEmailLower) ? "owner" : "staff";

  const sessionData: SessionData = {
    username: userData.email, 
    email: userData.email,
    role: userRole,
    name: userData.name || userData.email, 
    uid: userData.uid,
  };

  cookies().set(SESSION_COOKIE_NAME, JSON.stringify(sessionData), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: "/",
    sameSite: "lax",
  });

  return { success: true };
}


export async function logoutAction() {
  cookies().delete(SESSION_COOKIE_NAME);
  redirect("/login");
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (sessionCookie?.value) {
    try {
      const sessionData = JSON.parse(sessionCookie.value) as SessionData;
      return sessionData;
    } catch (error) {
      console.error("Failed to parse session cookie:", error);
      cookies().delete(SESSION_COOKIE_NAME);
      return null;
    }
  }
  return null;
}
