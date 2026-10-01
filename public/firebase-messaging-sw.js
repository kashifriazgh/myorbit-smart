// public/firebase-messaging-sw.js
// Service Worker for FCM & Web Push Notifications with Android Customization

console.log('[SW] firebase-messaging-sw.js loaded.');

// Helper to build type-specific notification options in Service Worker
function buildSWOptions(data, notification) {
  const type = data.notificationType || 'general';
  const entityId = data.entityId || '';
  const title = notification.title || data.title || getDefaultTitleForType(type);
  const body = notification.body || data.body || 'You have a new update in MyOrbit.';
  const appUrl = data.appUrl || getDefaultUrlForType(type, entityId);

  let actions = [
    { action: 'view', title: '👁 Open' },
    { action: 'dismiss', title: 'Dismiss' },
  ];

  switch (type) {
    case 'todo':
      actions = [
        { action: 'action_done', title: '✓ Done' },
        { action: 'action_snooze', title: '💤 Snooze' },
        { action: 'view', title: 'Open' },
      ];
      break;

    case 'schedule':
      actions = [
        { action: 'action_done', title: '✓ Done' },
        { action: 'action_snooze', title: '⏰ Snooze' },
        { action: 'view', title: 'Open' },
      ];
      break;

    case 'goal':
      actions = [
        { action: 'action_log', title: '✓ Log' },
        { action: 'action_snooze', title: '💤 Later' },
        { action: 'view', title: 'Open' },
      ];
      break;

    case 'overdue':
      actions = [
        { action: 'action_done', title: '✓ Complete' },
        { action: 'action_reschedule', title: '📅 Reschedule' },
        { action: 'view', title: 'Open' },
      ];
      break;

    case 'finance':
      actions = [
        { action: 'view', title: '📊 View' },
        { action: 'dismiss', title: 'Dismiss' },
      ];
      break;

    case 'summary_morning':
    case 'summary_evening':
      actions = [
        { action: 'view', title: '👁 View Summary' },
        { action: 'dismiss', title: 'Dismiss' },
      ];
      break;
  }

  const tagKey = data.tag || (entityId ? `myorbit-${type}-${entityId}` : `myorbit-${type}-${Date.now()}`);

  return {
    title,
    options: {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      tag: tagKey,
      vibrate: [200, 100, 200, 100, 200], // Vibration pattern for Android system alerts
      silent: false,                       // Request notification sound
      renotify: true,                      // Re-trigger sound/vibrate even if tag is updated
      requireInteraction: true,
      actions,
      data: {
        ...data,
        notificationType: type,
        entityId,
        appUrl,
        tag: tagKey,
        timestamp: Date.now(),
      },
    },
  };
}

function getDefaultTitleForType(type) {
  switch (type) {
    case 'todo': return 'Task Reminder 📝';
    case 'schedule': return 'Schedule Alert 📅';
    case 'goal': return 'Goal Check-in 🎯';
    case 'finance': return 'Finance Alert 💰';
    case 'overdue': return 'Overdue Tasks ⚠️';
    case 'summary_morning': return 'Good Morning ☀️ — Today\'s Focus';
    case 'summary_evening': return 'Evening Recap 🌙 — Day Review';
    default: return 'MyOrbit Notification 🔔';
  }
}

function getDefaultUrlForType(type, entityId) {
  switch (type) {
    case 'todo': return entityId ? `/to-do/${entityId}` : '/to-do';
    case 'schedule': return '/';
    case 'goal': return entityId ? `/goals/${entityId}` : '/goals';
    case 'overdue': return '/to-do';
    case 'finance': return '/finance';
    default: return '/';
  }
}

// ─── 1. RAW PUSH HANDLER (Fires for background FCM push alerts) ───
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received:', event);

  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = {
      data: {
        title: 'MyOrbit Notification 🔔',
        body: event.data ? event.data.text() : 'You have a pending reminder!',
        notificationType: 'general',
      }
    };
  }

  const n = payload.notification || {};
  const d = payload.data || {};

  const { title, options } = buildSWOptions(d, n);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const hasFocusedClient = clientList.some((c) => c.focused);
      if (hasFocusedClient) {
        console.log('[SW] Active window is focused. Letting foreground handler manage in-app alert.');
        // Display toast or silent notification if required
      }
      console.log('[SW] Showing background notification:', title, options);
      return self.registration.showNotification(title, options);
    })
  );
});

// ─── 2. NOTIFICATION CLICK & INTERACTIVE ACTION HANDLER ───
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click action:', event.action, 'Data:', event.notification.data);
  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};
  const appUrl = data.appUrl || getDefaultUrlForType(data.notificationType, data.entityId);

  if (action === 'dismiss') return;

  // Handle background actions without needing full window focus
  if (action === 'action_done' || action === 'action_snooze') {
    const apiAction = action === 'action_done' ? 'done' : 'snooze';
    
    event.waitUntil(
      fetch('/api/notifications/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: apiAction,
          notificationType: data.notificationType,
          entityId: data.entityId,
          userId: data.userId,
        }),
      })
        .then((res) => res.json())
        .then((resData) => {
          console.log('[SW] Notification action API result:', resData);
          const confirmTitle = apiAction === 'done' ? '✓ Marked Complete' : '💤 Snoozed';
          const confirmBody = apiAction === 'done'
            ? 'Item status updated to done.'
            : 'Reminder snoozed for 15 minutes.';

          return self.registration.showNotification(confirmTitle, {
            body: confirmBody,
            icon: '/icons/icon-192x192.png',
            tag: `confirm-${data.tag}`,
            timeout: 3000,
          });
        })
        .catch((err) => {
          console.error('[SW] Notification action API failed:', err);
        })
    );
    return;
  }

  // Action 'action_log', 'action_reschedule', 'view', or body click -> open / focus target URL
  const targetUrl = new URL(appUrl, self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ─── 3. FIREBASE COMPAT SDK INITIALIZATION ───
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

    messaging.onBackgroundMessage((payload) => {
      console.log('[SW] onBackgroundMessage payload:', payload);
    });
  } catch (initError) {
    console.error('[SW] Firebase messaging init error:', initError);
  }
}

// ─── 4. LIFECYCLE EVENTS + APP SHELL PRE-CACHE ───

const SHELL_CACHE = 'myorbit-app-shell-v1';

// Critical assets to cache immediately on install for instant PWA launch
const APP_SHELL_ASSETS = [
  '/',
  '/offline',
  '/favicon.svg',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  console.log('[SW] install — pre-caching app shell');
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      return cache.addAll(APP_SHELL_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache partial failure (non-critical):', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] activate — claiming clients & pruning old caches');
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Remove old shell cache versions
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('myorbit-app-shell-') && k !== SHELL_CACHE)
            .map((k) => caches.delete(k))
        )
      ),
    ])
  );
});

// ─── 5. FETCH HANDLER — Stale-While-Revalidate for navigation + Cache-First for static ───
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET, chrome-extension, Firebase, API routes
  if (
    event.request.method !== 'GET' ||
    url.protocol === 'chrome-extension:' ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // ── Navigation requests (page loads): Stale-While-Revalidate ──
  // Serve from cache immediately, update in background. Critical for offline & slow networks.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then((cached) => {
        const networkFetch = fetch(event.request)
          .then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => {
            // Network failed — serve cached offline page
            return caches.match('/offline') || cached;
          });

        // Serve cached immediately, revalidate in background
        return cached || networkFetch;
      })
    );
    return;
  }

  // ── Static assets (_next/static, icons, fonts): Cache-First ──
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|otf|eot)$/i)
  ) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) => cached || fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
      )
    );
    return;
  }
});
