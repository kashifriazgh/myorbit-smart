// Guest User Management System
// This allows users to use the app without authentication

import Cookies from 'js-cookie';
import { Timestamp } from 'firebase/firestore';

export interface GuestUser {
  uid: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  role: 'guest';
  createdAt: Timestamp;
  isGuest: true;
}

const GUEST_UID_KEY = 'guest_uid';
const GUEST_EXPIRY_DAYS = 30; // Guest sessions last 30 days

/**
 * Generate a unique guest user ID
 */
export function generateGuestUID(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 15);
  return `guest_${timestamp}_${randomStr}`;
}

/**
 * Get or create a guest user
 */
export function getOrCreateGuestUser(): GuestUser {
  // Check if guest user already exists in cookies
  const existingGuestUID = Cookies.get(GUEST_UID_KEY);

  if (existingGuestUID && existingGuestUID.startsWith('guest_')) {
    // Return existing guest user
    return {
      uid: existingGuestUID,
      email: 'guest@myorbit.app',
      displayName: 'Guest User',
      firstName: 'Guest',
      lastName: 'User',
      role: 'guest',
      createdAt: Timestamp.now(),
      isGuest: true,
    };
  }

  // Create new guest user
  const guestUID = generateGuestUID();

  // Store guest UID in cookies for 30 days with path '/'
  Cookies.set(GUEST_UID_KEY, guestUID, {
    expires: GUEST_EXPIRY_DAYS,
    sameSite: 'lax',
    path: '/',
  });

  return {
    uid: guestUID,
    email: 'guest@myorbit.app',
    displayName: 'Guest User',
    firstName: 'Guest',
    lastName: 'User',
    role: 'guest',
    createdAt: Timestamp.now(),
    isGuest: true,
  };
}

/**
 * Check if a user ID is a guest user
 */
export function isGuestUser(uid: string): boolean {
  return uid.startsWith('guest_');
}

/**
 * Clear guest user data with path '/'
 */
export function clearGuestUser(): void {
  Cookies.remove(GUEST_UID_KEY, { path: '/' });
}

/**
 * Get guest user from cookies
 */
export function getGuestUserFromCookies(): GuestUser | null {
  const guestUID = Cookies.get(GUEST_UID_KEY);

  if (guestUID && guestUID.startsWith('guest_')) {
    return {
      uid: guestUID,
      email: 'guest@myorbit.app',
      displayName: 'Guest User',
      firstName: 'Guest',
      lastName: 'User',
      role: 'guest',
      createdAt: Timestamp.now(),
      isGuest: true,
    };
  }

  return null;
}
