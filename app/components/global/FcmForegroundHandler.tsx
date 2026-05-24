'use client';

import { useEffect } from 'react';
import { setupForegroundNotifications } from '@/app/lib/utils/fcm';

/**
 * Invisible component mounted once in the root layout.
 * Registers the Firebase onMessage handler so push notifications
 * are displayed even when the app tab is in the foreground.
 */
export default function FcmForegroundHandler() {
  useEffect(() => {
    // Only activate if notifications are already granted
    // (avoids triggering a permission prompt on every page load)
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      setupForegroundNotifications().catch((err) => {
        console.warn('FcmForegroundHandler: setup failed:', err);
      });
    }
  }, []);

  return null; // renders nothing
}
