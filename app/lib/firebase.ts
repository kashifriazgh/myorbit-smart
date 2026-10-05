// lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
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

// ── Offline-capable Firestore ────────────────────────────────────────────────
// In the browser, persist Firestore data in IndexedDB so the app can render
// previously-loaded content when opened without internet (PWA offline mode).
// On the server (API routes) we keep the default in-memory cache.
function createFirestore(firebaseApp: FirebaseApp): Firestore {
  if (typeof window === 'undefined') return getFirestore(firebaseApp);
  try {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    // Already initialized (e.g. Fast Refresh / HMR) — reuse existing instance
    return getFirestore(firebaseApp);
  }
}

export const db = createFirestore(app);
export const auth = getAuth(app);

// Additional Centralized User Database
import { userFirebaseConfig } from './firebaseUsersConfig';

const userApp =
  getApps().find((app) => app.name === 'user-app') ||
  initializeApp(userFirebaseConfig, 'user-app');

export const userDb = createFirestore(userApp);
export const userAuth = getAuth(userApp);

export const database = getDatabase(userApp);
// export const storage = getStorage(app)
