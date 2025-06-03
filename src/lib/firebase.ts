
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
// Auth from firebase/auth is no longer needed for client-side Google Sign-In

// Attempt to load environment variables
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

// Critical configuration checks: Throw an error if placeholders or missing.
if (projectId === 'YOUR_PROJECT_ID') {
  throw new Error(
    `CRITICAL FIREBASE CONFIGURATION ERROR: Firebase Project ID (NEXT_PUBLIC_FIREBASE_PROJECT_ID) is set to the placeholder 'YOUR_PROJECT_ID'. ` +
    `Please update your .env file with your actual Firebase Project ID and restart the server.`
  );
}
if (!projectId) { // Checks for undefined, null, or empty string
  throw new Error(
    `CRITICAL FIREBASE CONFIGURATION ERROR: Firebase Project ID (NEXT_PUBLIC_FIREBASE_PROJECT_ID) is not set in your .env file. ` +
    `This is required for Firebase to function. Please add it and restart the server.`
  );
}

if (apiKey === 'YOUR_API_KEY') {
  throw new Error(
    `CRITICAL FIREBASE CONFIGURATION ERROR: Firebase API Key (NEXT_PUBLIC_FIREBASE_API_KEY) is set to the placeholder 'YOUR_API_KEY'. ` +
    `Please update your .env file with your actual Firebase API Key and restart the server.`
  );
}
if (!apiKey) { // Checks for undefined, null, or empty string
  throw new Error(
    `CRITICAL FIREBASE CONFIGURATION ERROR: Firebase API Key (NEXT_PUBLIC_FIREBASE_API_KEY) is not set in your .env file. ` +
    `This is required for Firebase to function. Please add it and restart the server.`
  );
}

// Optional configurations: Warn if missing, but don't throw.
if (!authDomain) {
    console.warn('Firebase Warning: Auth Domain (NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) is not set in .env. Authentication might be affected if not automatically inferred by Firebase.');
}
if (!storageBucket) {
    console.warn('Firebase Warning: Storage Bucket (NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) is not set in .env. Firebase Storage will not work correctly.');
}
if (!messagingSenderId) {
    console.warn('Firebase Warning: Messaging Sender ID (NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) is not set in .env. Firebase Cloud Messaging might not work.');
}
if (!appId) {
    console.warn('Firebase Warning: App ID (NEXT_PUBLIC_FIREBASE_APP_ID) is not set in .env. Analytics and other app-specific services might be affected.');
}

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
};

// Initialize Firebase App
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0]; // Use the existing app if already initialized
}

const db: Firestore = getFirestore(app);
// const auth: Auth = getAuth(app); // No longer needed for client-side Google sign-in logic here

export { db, app }; // Removed auth export
