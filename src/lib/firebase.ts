
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { initializeFirestore, getFirestore, type Firestore } from "firebase/firestore";

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
    `CRITICAL FIREBASE CONFIGURATION ERROR: Firebase Project ID (NEXT_PUBLIC_FIREBASE_PROJECT_ID) in your .env.local file is set to the placeholder 'YOUR_PROJECT_ID'. ` +
    `Please update your .env.local file with your actual Firebase Project ID and restart the server.`
  );
}
if (!projectId) { 
  throw new Error(
    `CRITICAL FIREBASE CONFIGURATION ERROR: Firebase Project ID (NEXT_PUBLIC_FIREBASE_PROJECT_ID) is not set in your .env.local file. ` +
    `This is required for Firebase to function. Please add it to .env.local and restart the server.`
  );
}

if (apiKey === 'YOUR_API_KEY') {
  throw new Error(
    `CRITICAL FIREBASE CONFIGURATION ERROR: Firebase API Key (NEXT_PUBLIC_FIREBASE_API_KEY) in your .env.local file is set to the placeholder 'YOUR_API_KEY'. ` +
    `Please update your .env.local file with your actual Firebase API Key and restart the server.`
  );
}
if (!apiKey) { 
  throw new Error(
    `CRITICAL FIREBASE CONFIGURATION ERROR: Firebase API Key (NEXT_PUBLIC_FIREBASE_API_KEY) is not set in your .env.local file. ` +
    `This is required for Firebase to function. Please add it to .env.local and restart the server.`
  );
}

// Optional configurations: Warn if missing, but don't throw.
if (!authDomain && process.env.NODE_ENV === 'development') {
    console.warn('Firebase Warning: Auth Domain (NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) is not set in .env.local. Authentication might be affected if not automatically inferred by Firebase.');
}
if (!storageBucket && process.env.NODE_ENV === 'development') {
    console.warn('Firebase Warning: Storage Bucket (NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) is not set in .env.local. Firebase Storage will not work correctly if used.');
}
if (!messagingSenderId && process.env.NODE_ENV === 'development') {
    console.warn('Firebase Warning: Messaging Sender ID (NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) is not set in .env.local. Firebase Cloud Messaging might not work if used.');
}
if (!appId && process.env.NODE_ENV === 'development') {
    console.warn('Firebase Warning: App ID (NEXT_PUBLIC_FIREBASE_APP_ID) is not set in .env.local. Analytics and other app-specific services might be affected if used.');
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
  console.log("Firebase initialized successfully with Project ID:", projectId);
} else {
  app = getApps()[0]; 
  console.log("Using existing Firebase app instance for Project ID:", projectId);
}

let db: Firestore;
try {
  db = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
  });
} catch {
  db = getFirestore(app);
}

export { db, app };
