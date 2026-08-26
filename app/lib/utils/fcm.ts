import {
  initializeApp,
  getApps,
  FirebaseApp,
  FirebaseOptions,
} from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';
import {
  getMessaging,
  register,
  onRegistered,
  onUnregistered,
  onMessage,
  Messaging,
} from 'firebase/messaging';
import { getInstallations, getId } from 'firebase/installations';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { userDb } from '../firebase';

let sharedApp: FirebaseApp | null = null;
let sharedDb: Database | null = null;
let sharedMessaging: Messaging | null = null;
let listenersSetup = false;
let foregroundHandlerSetup = false;

type SharedFirebaseConfig = FirebaseOptions & { vapidKey: string };

let sharedConfig: SharedFirebaseConfig | null = null;

/**
 * Fetches the configuration for RTDB and FCM.
 */
export async function getSharedFirebaseConfig(): Promise<SharedFirebaseConfig> {
  if (sharedConfig) return sharedConfig;

  sharedConfig = {
    apiKey: 'AIzaSyDblRCWL3l1VSOHkUiBshnO5CWISnTXjYw',
    authDomain: 'centralize-users.firebaseapp.com',
    projectId: 'centralize-users',
    storageBucket: 'centralize-users.firebasestorage.app',
    messagingSenderId: '354356008461',
    appId: '1:354356008461:web:a3ead68b25b52b3852a744',
    databaseURL:
      'https://centralize-users-default-rtdb.asia-southeast1.firebasedatabase.app/',
    vapidKey:
      process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ||
      'BFe8C_IjXW8Rbw23Ab1w5DCo_sI__ov2eMhOOOpDtAted0zi9vbu48WrCSMRDb87Lg7gzn07u9j39VJlV392UCc',
  };
  return sharedConfig;
}

/**
 * Initializes and returns the shared Firebase application.
 */
export async function getSharedApp(): Promise<FirebaseApp> {
  if (sharedApp) return sharedApp;

  const config = await getSharedFirebaseConfig();
  const appName = 'rtdb-fcm-app';
  const apps = getApps();
  const existingApp = apps.find((a) => a.name === appName);

  sharedApp = existingApp || initializeApp(config, appName);
  return sharedApp;
}

/**
 * Gets the shared Realtime Database instance.
 */
export async function getSharedDatabase(): Promise<Database> {
  if (sharedDb) return sharedDb;

  const app = await getSharedApp();
  sharedDb = getDatabase(app);
  return sharedDb;
}

/**
 * Gets the shared Firebase Messaging instance.
 */
export async function getSharedMessaging(): Promise<Messaging | null> {
  if (sharedMessaging) return sharedMessaging;

  try {
    const app = await getSharedApp();
    sharedMessaging = getMessaging(app);
    return sharedMessaging;
  } catch (err) {
    console.warn(
      'Firebase Messaging is not supported in this browser context:',
      err,
    );
    return null;
  }
}

/**
 * Helper to fetch the current Firebase Installation ID (FID).
 */
export async function getCurrentFid(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const app = await getSharedApp();
    const installations = getInstallations(app);
    return await getId(installations);
  } catch (err) {
    console.error('FCM: Failed to get installation ID:', err);
    return null;
  }
}

/**
 * Saves/updates the FID registration details in the centralized users Firestore database.
 */
export async function saveFidToDatabase(userId: string, fid: string): Promise<void> {
  try {
    const deviceRef = doc(userDb, 'users', userId, 'notificationDevices', fid);
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
    const browser = detectBrowser(userAgent);
    const deviceType = detectDeviceType(userAgent);

    await setDoc(
      deviceRef,
      {
        fid,
        platform: 'web',
        enabled: true,
        lastSeenAt: serverTimestamp(),
        userAgent,
        browser,
        deviceType,
      },
      { merge: true }
    );

    // Separately merge createdAt using merge: true to avoid overwriting it
    await setDoc(
      deviceRef,
      {
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );

    console.log(`FCM: Saved active registration in Firestore for user ${userId}, FID: ${fid}`);
  } catch (err) {
    console.error('FCM: Failed to save FID to Firestore:', err);
  }
}

/**
 * Marks the FID registration as disabled on unregistration triggers.
 */
export async function removeFidFromDatabase(userId: string, fid: string): Promise<void> {
  try {
    const deviceRef = doc(userDb, 'users', userId, 'notificationDevices', fid);
    await setDoc(
      deviceRef,
      {
        enabled: false,
        lastSeenAt: serverTimestamp(),
      },
      { merge: true }
    );
    console.log(`FCM: Disabled registration in Firestore for user ${userId}, FID: ${fid}`);
  } catch (err) {
    console.error('FCM: Failed to disable FID in Firestore:', err);
  }
}

/**
 * Registers the user's browser device with FCM.
 */
export async function registerNotificationDevice(userId: string): Promise<void> {
  if (typeof window === 'undefined') return;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission denied by user.');
  }

  const messaging = await getSharedMessaging();
  const config = await getSharedFirebaseConfig();

  if (!messaging) {
    throw new Error('Firebase Messaging is not supported or could not be initialized.');
  }

  // Register service worker manually with cache busting to bypass browser cache
  let registration: ServiceWorkerRegistration | undefined;
  try {
    console.log('FCM: Registering service worker manually...');
    registration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js?v=' + Date.now(),
      {
        scope: '/',
      }
    );
    console.log('FCM: Service worker registered manually successfully:', registration);
  } catch (swErr) {
    console.error('FCM: Manual service worker registration failed:', swErr);
    throw new Error(`Service Worker registration failed: ${(swErr as Error).message}`);
  }

  // Set up FID lifecycle listeners before calling register
  setupFidLifecycleListeners(messaging, userId);

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || config.vapidKey;
  console.log('FCM: Registering app instance using VAPID Key:', vapidKey);

  // Call the modern FID-based register API
  await register(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });

  // Manually guarantee the current FID is saved to Firestore
  const fid = await getCurrentFid();
  if (fid) {
    await saveFidToDatabase(userId, fid);
  }
}

/**
 * Registers the event listeners for FID lifecycle.
 */
function setupFidLifecycleListeners(messaging: Messaging, userId: string) {
  if (listenersSetup) return;

  onRegistered(messaging, (installationId) => {
    console.log('FCM: onRegistered callback fired. FID:', installationId);
    saveFidToDatabase(userId, installationId);
  });

  onUnregistered(messaging, (installationId) => {
    console.log('FCM: onUnregistered callback fired. FID:', installationId);
    removeFidFromDatabase(userId, installationId);
  });

  listenersSetup = true;
  console.log('FCM: FID lifecycle listeners registered.');
}

/**
 * Sets up the foreground push notification handler.
 */
export async function setupForegroundNotifications(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (foregroundHandlerSetup) return;

  try {
    const messaging = await getSharedMessaging();
    if (!messaging) return;

    onMessage(messaging, async (payload) => {
      console.log('FCM: Foreground message received:', payload);

      const n = payload.notification || {};
      const d = (payload.data || {}) as Record<string, string>;

      const title = n.title || d.title || 'Orbit Reminder ⏰';
      const options: NotificationOptions = {
        body: n.body || d.body || 'You have a pending task reminder!',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        data: d,
        requireInteraction: true,
        tag: d.itemId ? `reminder-${d.itemId}` : 'orbit-reminder-fg',
      };

      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, options);
        console.log('FCM: Foreground notification shown via SW.');
      } catch (swErr) {
        console.warn('FCM: SW showNotification failed, falling back to Notification API:', swErr);
        if (Notification.permission === 'granted') {
          new Notification(title, options);
        }
      }
    });

    foregroundHandlerSetup = true;
    console.log('FCM: Foreground notification handler registered.');
  } catch (err) {
    console.error('FCM: Failed to set up foreground notification handler:', err);
  }
}

/**
 * Utility to detect browser name from userAgent.
 */
function detectBrowser(ua: string): string {
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome') && !ua.includes('Chromium')) return 'Chrome';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  return 'Unknown';
}

/**
 * Utility to detect device type from userAgent.
 */
function detectDeviceType(ua: string): 'desktop' | 'mobile' | 'tablet' | 'unknown' {
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
  return 'desktop';
}
