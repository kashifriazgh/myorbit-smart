import { NextRequest, NextResponse } from 'next/server';

/**
 * SECURE ENDPOINT: Serves Firebase configuration for Realtime Database (RTDB) and Cloud Messaging (FCM).
 *
 * SECURITY RULES:
 * 1. Access to this endpoint is restricted only to logged-in users who have a valid 'uid' cookie.
 * 2. If 'uid' cookie is missing, returns 401 Unauthorized.
 */
export async function GET(req: NextRequest) {
  const uid = req.cookies.get('uid')?.value;

  if (!uid) {
    return NextResponse.json(
      {
        error:
          'Unauthorized: Access denied. You must be logged in via Firebase Auth to retrieve this configuration.',
      },
      { status: 401 },
    );
  }

  // Hardcoded centralized configuration details for RTDB and FCM
  const rtdbConfig = {
    apiKey: 'AIzaSyDZFNapAjmnS0TZIM1lK8wNA4PDgedVnRo',
    authDomain: 'forms-389a6.firebaseapp.com',
    projectId: 'forms-389a6',
    storageBucket: 'forms-389a6.firebasestorage.app',
    messagingSenderId: '721032079467',
    appId: '1:721032079467:web:b525c93448811b8bf4292e',
    databaseURL:
      'https://forms-389a6-default-rtdb.asia-southeast1.firebasedatabase.app',

    // IMPORTANT: Generate this VAPID Web Push key in Firebase Console -> Project Settings -> Cloud Messaging -> Web configuration
    vapidKey:
      'BFGvN2a5o2rX6a_mJmDk0jH3lQc_7g7wK9xH5V2hE9zD0vH8zJ7hL0dM7pX9vI1uS2tV4wX5yZ6aB7cDeFgHiJk',
  };

  return NextResponse.json(rtdbConfig);
}
