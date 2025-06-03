
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// In a real application, use a secure way to store and verify passwords (e.g., hashing)
// and fetch users from a database.
// This USERS array and the loginAction are kept for potential direct API use or future re-integration,
// but the primary login mechanism is now Google Sign-In.
const USERS = [
  { username: "owner", password: "password", email: "owner@wholesalewise.com", role: "owner" as const, name: "Owner User" },
  { username: "staff", password: "password", email: "staff@wholesalewise.com", role: "staff" as const, name: "Staff User" },
];

// Define owner emails here. Replace with actual owner Google email addresses.
const OWNER_EMAILS: string[] = ["your-owner-email@example.com"]; // IMPORTANT: Update this with the owner's actual Google email

const SESSION_COOKIE_NAME = "auth-session";

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

export async function signInWithGoogleAction(userData: GoogleSignInData) {
  if (!userData.email) {
    return { success: false, error: "Email not provided by Google Sign-In." };
  }

  // Determine role based on email
  const userRole = OWNER_EMAILS.includes(userData.email.toLowerCase()) ? "owner" : "staff";

  const sessionData: SessionData = {
    username: userData.email, // Use email as username for Google Sign-In users
    email: userData.email,
    role: userRole,
    name: userData.name || userData.email, // Use name if available, else email
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

