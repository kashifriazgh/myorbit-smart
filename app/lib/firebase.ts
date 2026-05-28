// lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database'; // ← ADD THIS
// import { getStorage } from 'firebase/storage' // optional

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDZFNapAjmnS0TZIM1lK8wNA4PDgedVnRo",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "forms-389a6.firebaseapp.com",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://forms-389a6-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "forms-389a6",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "forms-389a6.firebasestorage.app",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:721032079467:web:b525c93448811b8bf4292e",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export { app }; // ✅ Add this line

export const db = getFirestore(app);
export const auth = getAuth(app);
export const database = getDatabase(app); // ← ADD THIS
// export const storage = getStorage(app)
