import {
  initializeApp,
  getApps,
  FirebaseApp,
  FirebaseOptions,
} from 'firebase/app';
import { getDatabase, ref, set, Database } from 'firebase/database';
import {
  getMessaging,
  getToken,
  onMessage,
  Messaging,
} from 'firebase/messaging';

let sharedApp: FirebaseApp | null = null;
let sharedDb: Database | null = null;
let sharedMessaging: Messaging | null = null;
type SharedFirebaseConfig = FirebaseOptions & { vapidKey: string };

let sharedConfig: SharedFirebaseConfig | null = null;
let foregroundHandlerSetup = false;

/**
 * Fetches the configuration for RTDB and FCM from the secure API and initializes a secondary app.
 */
export async function getSharedFirebaseConfig(): Promise<SharedFirebaseConfig> {
  if (sharedConfig) return sharedConfig;

  sharedConfig = {
    apiKey: 'AIzaSyDZFNapAjmnS0TZIM1lK8wNA4PDgedVnRo',
    authDomain: 'forms-389a6.firebaseapp.com',
    projectId: 'forms-389a6',
    storageBucket: 'forms-389a6.firebasestorage.app',
    messagingSenderId: '721032079467',
    appId: '1:721032079467:web:b525c93448811b8bf4292e',
    databaseURL:
      'https://forms-389a6-default-rtdb.asia-southeast1.firebasedatabase.app',
    vapidKey:
      'BH-Py3hgXNTO92ksco5vUvezLLth_VbVhS_eSUt4PzUtfJrHTbB4PMfnm6QS15N-oDCSukq_sSKcrTVNklQfacs',
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
 * Requests browser permission for push notifications and registers the FCM token to RTDB.
 */
export async function requestNotificationPermissionAndGetToken(
  clientId: string,
  userId: string,
): Promise<string | null> {
  try {
    if (typeof window === 'undefined') return null;

    console.log('FCM: Requesting notification permission...');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Notification permission denied by user.');
    }
    console.log('FCM: Notification permission granted.');

    const database = await getSharedDatabase();
    const messaging = await getSharedMessaging();
    const config = await getSharedFirebaseConfig();

    if (!messaging) {
      throw new Error(
        'Firebase Messaging is not supported or could not be initialized in this browser.',
      );
    }

    const vapidKey = config.vapidKey;
    console.log('FCM: Retrieving FCM Token with VAPID Key:', vapidKey);

    // Register service worker manually with cache busting to bypass browser cache
    let registration: ServiceWorkerRegistration | undefined;
    try {
      console.log('FCM: Registering service worker manually...');
      registration = await navigator.serviceWorker.register(
        '/firebase-messaging-sw.js?v=' + Date.now(),
        {
          scope: '/',
        },
      );
      console.log(
        'FCM: Service worker registered manually successfully:',
        registration,
      );
    } catch (swErr) {
      console.error('FCM: Manual service worker registration failed:', swErr);
      throw new Error(
        `Service Worker registration failed: ${(swErr as Error).message}`,
      );
    }

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      console.log('FCM: Token retrieved successfully:', token);

      // Save FCM token to RTDB under fcm-tokens/${clientId}/${userId}
      const tokenRef = ref(database, `fcm-tokens/${clientId}/${userId}`);
      await set(tokenRef, {
        token: token,
        updatedAt: Date.now(),
        device:
          typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      });

      console.log(
        `FCM: Saved token to RTDB under fcm-tokens/${clientId}/${userId}`,
      );
      return token;
    } else {
      throw new Error(
        'No registration token available. Request permission to generate one.',
      );
    }
  } catch (err) {
    console.error('FCM: Failed to get push token:', err);
    throw err;
  }
}
/**
 * Sets up the foreground push notification handler.
 * Firebase's onMessage only fires when the app tab IS focused.
 * We use the Service Worker to showNotification so it looks identical
 * to a background notification.
 *
 * Call this once from the root layout (client component).
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
        // Use SW showNotification so it appears as a real OS notification
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, options);
        console.log('FCM: Foreground notification shown via SW.');
      } catch (swErr) {
        // Fallback: use Notification API directly
        console.warn(
          'FCM: SW showNotification failed, falling back to Notification API:',
          swErr,
        );
        if (Notification.permission === 'granted') {
          new Notification(title, options);
        }
      }
    });

    foregroundHandlerSetup = true;
    console.log('FCM: Foreground notification handler registered.');
  } catch (err) {
    console.error(
      'FCM: Failed to set up foreground notification handler:',
      err,
    );
  }
}
