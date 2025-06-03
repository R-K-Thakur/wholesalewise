
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth"; // Import Auth type

// Attempt to load environment variables
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let authInstance: Auth | null = null; // Renamed to avoid conflict with exported 'auth'

let configIsValid = true;

// Detailed checks for critical Firebase configuration
if (projectId === 'YOUR_PROJECT_ID') {
  console.error(
    'CRITICAL FIREBASE CONFIGURATION ERROR: Firebase Project ID is set to a placeholder value. ' +
    'Please update NEXT_PUBLIC_FIREBASE_PROJECT_ID in your .env file with your actual Firebase Project ID and restart the server. ' +
    'The current value is: ' + projectId
  );
  configIsValid = false;
} else if (!projectId) {
  console.warn(
    'Firebase Project ID (NEXT_PUBLIC_FIREBASE_PROJECT_ID) is not set in .env. Firebase features will not work. ' +
    'Please set it with your actual Firebase Project ID and restart the server.'
  );
  configIsValid = false;
}

if (apiKey === 'YOUR_API_KEY') {
  console.error(
    'CRITICAL FIREBASE CONFIGURATION ERROR: Firebase API Key is set to a placeholder value. ' +
    'Please update NEXT_PUBLIC_FIREBASE_API_KEY in your .env file with your actual Firebase API Key and restart the server. ' +
    'The current value is: ' + apiKey
  );
  configIsValid = false;
} else if (!apiKey) {
  console.warn(
    'Firebase API Key (NEXT_PUBLIC_FIREBASE_API_KEY) is not set in .env. Firebase features (like Google Sign-In) will not work. ' +
    'Please set it with your actual Firebase API Key and restart the server.'
  );
  configIsValid = false;
}

// Check other potentially important configurations
if (!authDomain) {
    console.warn('Firebase Auth Domain (NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) is not set in .env. Authentication might be affected.');
    // Depending on strictness, you might set configIsValid = false here too.
}


if (configIsValid) {
  const firebaseConfig = {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  };

  if (!getApps().length) {
    try {
      app = initializeApp(firebaseConfig);
    } catch (e) {
        console.error("Firebase initialization failed:", e);
        configIsValid = false; // Mark as invalid if initializeApp itself throws
    }
  } else {
    app = getApps()[0];
  }

  if (app && configIsValid) { // Ensure app was successfully initialized
    db = getFirestore(app);
    authInstance = getAuth(app);
  } else if (configIsValid) { // app is null but config was thought to be valid (edge case)
    console.error("Firebase app object is null despite configuration thought to be valid. Firebase will not be functional.");
    configIsValid = false; // Correct the state
  }
}

if (!configIsValid) {
  console.error(
    "*********************************************************************************\n" +
    "IMPORTANT: Firebase is not properly configured and has NOT been initialized. \n" +
    "Application features relying on Firebase (Database, Authentication) WILL NOT WORK.\n" +
    "Please check your .env file for NEXT_PUBLIC_FIREBASE_PROJECT_ID and NEXT_PUBLIC_FIREBASE_API_KEY.\n" +
    "Ensure they are set to your actual Firebase project values and NOT placeholders.\n" +
    "After correcting your .env file, RESTART your development server.\n" +
    "*********************************************************************************"
  );
}

// Export potentially null services. Consumers must handle this.
export { db, app, authInstance as auth };
