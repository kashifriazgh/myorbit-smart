// public/firebase-messaging-sw.js
// Service Worker for FCM Push Notifications
// This file MUST be at the root (served from /firebase-messaging-sw.js)

console.log('[SW] firebase-messaging-sw.js loaded.');

// ─── 1. RAW PUSH HANDLER (most reliable — fires for ALL background pushes) ───
// This handles FCM messages BEFORE Firebase SDK even loads.
// It fires whenever a push is received in the background.
self.addEventListener('push', (event) => {
  console.log('[SW] push event received:', event);

  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = {
      notification: {
        title: 'Orbit Reminder ⏰',
        body: event.data ? event.data.text() : 'You have a pending task reminder!'
      }
    };
  }

  const n = payload.notification || {};
  const d = payload.data || {};

  const title = n.title || d.title || 'Orbit Reminder ⏰';
  const options = {
    body: n.body || d.body || 'You have a pending task reminder!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    data: d,
    requireInteraction: true,
    tag: d.itemId ? `reminder-${d.itemId}` : 'orbit-reminder',
    actions: [
      { action: 'view', title: '👁 View Task' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  console.log('[SW] Showing notification:', title, options);
  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── 2. NOTIFICATION CLICK HANDLER ───
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] notificationclick:', event.action, event.notification.data);
  event.notification.close();

  if (event.action === 'dismiss') return;

  const appUrl = (event.notification.data && event.notification.data.appUrl) || '/';
  const targetUrl = new URL(appUrl, self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new tab
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ─── 3. FIREBASE COMPAT SDK (handles background message enrichment) ───
try {
  importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');
  console.log('[SW] Firebase SDKs imported successfully.');
} catch (importError) {
  console.error('[SW] Failed to import Firebase SDKs:', importError);
}

const firebaseConfig = {
  apiKey: "AIzaSyDblRCWL3l1VSOHkUiBshnO5CWISnTXjYw",
  authDomain: "centralize-users.firebaseapp.com",
  projectId: "centralize-users",
  storageBucket: "centralize-users.firebasestorage.app",
  messagingSenderId: "354356008461",
  appId: "1:354356008461:web:a3ead68b25b52b3852a744",
  databaseURL: "https://centralize-users-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

if (typeof firebase !== 'undefined') {
  try {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();
    console.log('[SW] Firebase messaging initialized.');

    // onBackgroundMessage fires when the app IS NOT focused (complements the raw push handler above)
    messaging.onBackgroundMessage((payload) => {
      console.log('[SW] onBackgroundMessage payload:', payload);
      // Note: the raw push handler above will have already shown a notification.
      // We only need to act here if the raw handler somehow missed it.
      // Firebase automatically suppresses duplicate notifications, so this is safe.
    });
  } catch (initError) {
    console.error('[SW] Firebase messaging init error:', initError);
  }
} else {
  console.warn('[SW] Firebase SDK unavailable — raw push handler will cover all cases.');
}

// ─── 4. LIFECYCLE EVENTS ───
self.addEventListener('install', (event) => {
  console.log('[SW] install — skipWaiting');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] activate — clients.claim');
  event.waitUntil(self.clients.claim());
});
