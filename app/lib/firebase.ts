// lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database'; // ← ADD THIS
// import { getStorage } from 'firebase/storage' // optional

const firestoreConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const missingFirestoreEnv = Object.entries(firestoreConfig).filter(
  ([, value]) => !value,
);
if (missingFirestoreEnv.length > 0) {
  throw new Error(
    `Missing required Firestore Firebase env vars: ${missingFirestoreEnv
      .map(([key]) => key)
      .join(
        ', ',
      )}. Do not fallback to a shared project config for client Firestore.`,
  );
}

const app = getApps().length ? getApp() : initializeApp(firestoreConfig);
export { app };

export const db = getFirestore(app);
export const auth = getAuth(app);

// Additional Centralized User Database
import { userFirebaseConfig } from './firebaseUsersConfig';

const userApp =
  getApps().find((app) => app.name === 'user-app') ||
  initializeApp(userFirebaseConfig, 'user-app');

export const userDb = getFirestore(userApp);
export const userAuth = getAuth(userApp);

export const database = getDatabase(userApp);
// export const storage = getStorage(app)
