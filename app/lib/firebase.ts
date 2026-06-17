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

const sharedRtdbConfig = {
  apiKey: 'AIzaSyDZFNapAjmnS0TZIM1lK8wNA4PDgedVnRo',
  authDomain: 'forms-389a6.firebaseapp.com',
  databaseURL:
    'https://forms-389a6-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'forms-389a6',
  storageBucket: 'forms-389a6.firebasestorage.app',
  messagingSenderId: '721032079467',
  appId: '1:721032079467:web:b525c93448811b8bf4292e',
};

const sharedRtdbApp =
  getApps().find((app) => app.name === 'shared-rtdb-app') ||
  initializeApp(sharedRtdbConfig, 'shared-rtdb-app');

export const database = getDatabase(sharedRtdbApp);
// export const storage = getStorage(app)
