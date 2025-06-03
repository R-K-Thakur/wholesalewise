
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Check for placeholder values and log critical errors if found
if (!firebaseConfig.projectId || firebaseConfig.projectId === 'YOUR_PROJECT_ID') {
  console.error(
    'CRITICAL FIREBASE CONFIGURATION ERROR: Firebase Project ID is not set or is still a placeholder. ' +
    'Please update NEXT_PUBLIC_FIREBASE_PROJECT_ID in your .env file with your actual Firebase Project ID and restart the server. ' +
    'The current value is: ' + firebaseConfig.projectId
  );
}
if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'YOUR_API_KEY') {
  console.error(
    'CRITICAL FIREBASE CONFIGURATION ERROR: Firebase API Key is not set or is still a placeholder. ' +
    'Please update NEXT_PUBLIC_FIREBASE_API_KEY in your .env file with your actual Firebase API Key and restart the server. ' +
    'The current value is: ' + firebaseConfig.apiKey
  );
}

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const db: Firestore = getFirestore(app);
const auth = getAuth(app);

export { db, app, auth };
