import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { userDb } from '@/app/lib/firebase';
import { userFirebaseConfig } from '@/app/lib/firebaseUsersConfig';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

/**
 * Signs a JWT assertion locally using Node's native crypto module (RS256).
 */
function signJwt(payload: object, privateKey: string): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${encodedHeader}.${encodedPayload}`);
  const signature = sign.sign(privateKey, 'base64url');
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Exchanges JWT assertion for Google OAuth 2.0 access token for FCM.
 */
async function getFcmAccessToken(privateKey: string, clientEmail: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const jwt = signJwt(claim, privateKey);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Google OAuth exchange failed: ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate Request via Firebase ID Token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const apiKey = userFirebaseConfig.apiKey;

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing centralized users Firebase API Key configuration' }, { status: 500 });
    }

    // Exchange ID Token for User Record to verify UID securely
    const authRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );

    const authData = await authRes.json();
    if (!authRes.ok || !authData.users || authData.users.length === 0) {
      console.error('FCM Test Dispatch: Token verification failed:', authData);
      return NextResponse.json({ error: 'Invalid or expired Firebase session' }, { status: 401 });
    }

    const userId = authData.users[0].localId;
    console.log(`FCM Test Dispatch: Authenticated userId: ${userId}`);

    // Parse body if present for custom payloads
    const body = await req.json().catch(() => ({}));
    const customTitle = body.title;
    const customBody = body.bodyText;
    const customAppUrl = body.appUrl;

    // 2. Load Service Account Credentials
    const clientEmail = process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL;
    const rawPrivateKey = process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY;

    if (!clientEmail || !rawPrivateKey) {
      return NextResponse.json(
        {
          error:
            'FCM Service Account credentials are missing in .env.local. Please configure FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL and FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY.',
        },
        { status: 500 }
      );
    }

    const privateKey = rawPrivateKey.replace(/\\n/g, '\n');

    // Parse Firebase Project ID from the service account email
    const projectIdMatch = clientEmail.match(/@([^.]+)\.iam/);
    const projectId = projectIdMatch ? projectIdMatch[1] : 'forms-389a6';

    // 3. Fetch target user's registered FCM devices (FIDs)
    const targetUid = body.targetUid;
    let finalTargetUid = userId;

    if (targetUid && targetUid !== userId) {
      // Security Check: Load the authenticated user's document to verify targetUid is in sharedWith
      const authUserRef = doc(userDb, 'users', userId);
      const authUserSnap = await getDoc(authUserRef);
      if (!authUserSnap.exists()) {
        return NextResponse.json({ error: 'Authenticated user profile not found.' }, { status: 404 });
      }
      
      const authUserData = authUserSnap.data();
      const sharedList: { uid: string }[] = authUserData.sharedWith || [];
      const isShared = sharedList.some(item => item.uid === targetUid);
      
      if (!isShared) {
        return NextResponse.json({ error: 'You do not have permission to send notifications to this user.' }, { status: 403 });
      }
      
      finalTargetUid = targetUid;
    }

    const deviceCol = collection(userDb, 'users', finalTargetUid, 'notificationDevices');
    const deviceSnapshot = await getDocs(deviceCol);
    const activeDevices = deviceSnapshot.docs
      .map((doc) => doc.data())
      .filter((device) => device.enabled === true);

    if (activeDevices.length === 0) {
      return NextResponse.json({ error: 'No active device subscriptions found for the target user.' }, { status: 404 });
    }

    // 4. Generate OAuth 2.0 Access Token
    let accessToken = '';
    try {
      accessToken = await getFcmAccessToken(privateKey, clientEmail);
    } catch (tokenErr) {
      console.error('FCM Token generation failed:', tokenErr);
      return NextResponse.json({ error: `Authentication failed: ${(tokenErr as Error).message}` }, { status: 500 });
    }

    // 5. Send FCM message payload to each active device (FID)
    const results = [];
    for (const device of activeDevices) {
      const fid = device.fid;
      const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

      const payload = {
        message: {
          token: fid,
          data: {
            title: customTitle || 'Test Notification 🔔',
            body: customBody || 'Your device is successfully subscribed to MyOrbit Smart Push Alerts!',
            appUrl: customAppUrl || '/settings/push-notifications',
          },
        },
      };

      try {
        const fcmRes = await fetch(fcmUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const fcmData = await fcmRes.json();
        results.push({
          fid,
          success: fcmRes.ok,
          status: fcmRes.status,
          response: fcmData,
        });
      } catch (fcmErr) {
        results.push({
          fid,
          success: false,
          error: (fcmErr as Error).message,
        });
      }
    }

    return NextResponse.json({
      message: 'FCM dispatch completed.',
      projectId,
      results,
    });
  } catch (err) {
    console.error('Error in send-test-notification route:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
