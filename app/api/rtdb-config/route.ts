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

  return NextResponse.json(rtdbConfig);
}
