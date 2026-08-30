'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import BellOnIcon from '@mui/icons-material/NotificationsActive';
import BellOffIcon from '@mui/icons-material/NotificationsOff';
import BackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import DevicesIcon from '@mui/icons-material/DevicesOther';
import DeleteIcon from '@mui/icons-material/PersonRemove';
import { registerNotificationDevice, getCurrentFid } from '@/app/lib/utils/fcm';
import { useAuth } from '@/app/lib/context/userContext';
import { userDb } from '@/app/lib/firebase';
import { doc, deleteDoc, collection, getDocs, updateDoc, arrayRemove } from 'firebase/firestore';

type SubscriptionStatus = 'idle' | 'loading' | 'subscribed' | 'denied' | 'error';

interface NotificationDevice {
  fid: string;
  enabled: boolean;
  userAgent?: string;
  registeredAt?: string;
}

export default function PushNotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [unsubscribing, setUnsubscribing] = useState(false);
  const [devices, setDevices] = useState<NotificationDevice[]>([]);
  const [removingUser, setRemovingUser] = useState<string | null>(null);
  
  // Diagnostic state variables
  const [diagnosticPermission, setDiagnosticPermission] = useState<string>('Unknown');
  const [diagnosticSwStatus, setDiagnosticSwStatus] = useState<string>('Checking...');
  const [diagnosticToken, setDiagnosticToken] = useState<string>('Checking...');

  // Diagnostics check and console logs
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const perm = 'Notification' in window ? Notification.permission : 'Not supported';
      setDiagnosticPermission(perm);
      console.log('[FCM] permission:', perm);

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          const hasSw = regs.some(reg => {
            const scriptUrl = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || '';
            return scriptUrl.includes('firebase-messaging-sw.js');
          });
          setDiagnosticSwStatus(hasSw ? 'Registered' : 'Not Registered');
          console.log('[FCM] service worker registration count:', regs.length, 'has active message SW:', hasSw);
        }).catch((err) => {
          setDiagnosticSwStatus('Error checking SW');
          console.error('[FCM] service worker registration check error:', err);
        });
      } else {
        setDiagnosticSwStatus('Not supported');
      }

      getCurrentFid().then((fid) => {
        if (fid) {
          setDiagnosticToken(`Available (${fid.slice(0, 5)}...${fid.slice(-5)})`);
          console.log('[FCM] token obtained (FID):', fid);
        } else {
          setDiagnosticToken('Not Available');
          console.log('[FCM] token obtained (FID): Not Available');
        }
      }).catch((err) => {
        setDiagnosticToken('Error');
        console.error('[FCM] token obtained check error:', err);
      });
    }
  }, [status]);

  // Initialize and check subscription status when auth and user are loaded
  useEffect(() => {
    if (authLoading || hasInitialized) return;
    setHasInitialized(true);

    if (!user) {
      setStatus('idle');
      setCheckingStatus(false);
      return;
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'denied') {
        setStatus('denied');
        setCheckingStatus(false);
      } else if (Notification.permission === 'granted') {
        setStatus('loading');
        setCheckingStatus(true);
        const autoSync = async () => {
          try {
            const { isSupported } = await import('firebase/messaging');
            const supported = await isSupported();
            if (!supported) {
              setStatus('error');
              setErrorMessage('Push notifications are not supported by this browser.');
              return;
            }

            const fid = await getCurrentFid();
            if (fid) {
              const { doc: fsDoc, getDoc } = await import('firebase/firestore');
              const deviceRef = fsDoc(userDb, 'users', user.uid, 'notificationDevices', fid);
              const snapshot = await getDoc(deviceRef);
              
              // Verify active service worker is actually registered on client side
              let swActive = false;
              if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                try {
                  const regs = await navigator.serviceWorker.getRegistrations();
                  swActive = regs.some(reg => {
                    const scriptUrl = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || '';
                    return scriptUrl.includes('firebase-messaging-sw.js');
                  });
                } catch (swErr) {
                  console.warn('[FCM] Error checking SW registrations in autoSync:', swErr);
                }
              }

              if (snapshot.exists() && snapshot.data().enabled === true && swActive) {
                setStatus('subscribed');
              } else {
                console.log('[FCM] AutoSync: SW not active or Firestore registration missing/disabled. Running registration...');
                await registerNotificationDevice(user.uid);
                setStatus('subscribed');
              }
            } else {
              setStatus('error');
              setErrorMessage('Failed to retrieve installation ID.');
            }
          } catch (err) {
            console.error('Auto-sync FCM device failed:', err);
            setStatus('error');
            setErrorMessage((err as Error).message || 'Failed to auto-sync notification token.');
          } finally {
            setCheckingStatus(false);
          }
        };
        autoSync();
      } else {
        setStatus('idle');
        setCheckingStatus(false);
      }
    } else {
      setStatus('error');
      setErrorMessage('Push notifications are not supported by this browser.');
      setCheckingStatus(false);
    }
  }, [user, authLoading, hasInitialized]);

  // Load registered devices for this user
  useEffect(() => {
    if (!user) return;
    const loadDevices = async () => {
      try {
        const col = collection(userDb, 'users', user.uid, 'notificationDevices');
        const snap = await getDocs(col);
        setDevices(snap.docs.map(d => ({ fid: d.id, ...d.data() } as NotificationDevice)));
      } catch (err) {
        console.error('Failed to load devices:', err);
      }
    };
    loadDevices();
  }, [user, status]);

  const handleSubscribe = async () => {
    if (!user) return;
    setStatus('loading');
    setErrorMessage('');
    try {
      const { isSupported } = await import('firebase/messaging');
      const supported = await isSupported();
      if (!supported) {
        setStatus('error');
        setErrorMessage('Push notifications are not supported by this browser.');
        return;
      }
      await registerNotificationDevice(user.uid);
      setStatus('subscribed');
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('permission')) {
        setStatus('denied');
      } else {
        setStatus('error');
        setErrorMessage(msg);
      }
    }
  };

  const handleUnsubscribe = async () => {
    if (!user) return;
    setUnsubscribing(true);
    try {
      const fid = await getCurrentFid();
      if (fid) {
        await deleteDoc(doc(userDb, 'users', user.uid, 'notificationDevices', fid));
        setDevices(prev => prev.filter(d => d.fid !== fid));
      }
      setStatus('idle');
      setTestFeedback(null);
    } catch (err) {
      console.error('Unsubscribe error:', err);
    } finally {
      setUnsubscribing(false);
    }
  };

  const handleRemoveSharedUser = async (sharedUid: string, sharedDisplayName: string) => {
    if (!user) return;
    setRemovingUser(sharedUid);
    try {
      const myDisplayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || '';
      const sharedEntry = user.sharedWith?.find(u => u.uid === sharedUid);
      await updateDoc(doc(userDb, 'users', user.uid), {
        sharedWith: arrayRemove({ uid: sharedUid, displayName: sharedDisplayName, shareId: sharedEntry?.shareId || '' }),
      });
      await updateDoc(doc(userDb, 'users', sharedUid), {
        sharedWith: arrayRemove({ uid: user.uid, displayName: myDisplayName, shareId: user.shareId || '' }),
      });
    } catch (err) {
      console.error('Remove shared user error:', err);
    } finally {
      setRemovingUser(null);
    }
  };

  const handleSendTestNotification = async () => {
    if (!user) return;
    setSendingTest(true);
    setTestFeedback(null);
    setErrorMessage('');
    try {
      const { userAuth } = await import('@/app/lib/firebase');
      const idToken = await userAuth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error('Could not retrieve authentication session token.');

      const res = await fetch('/api/send-test-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch test notification.');

      setTestFeedback({ type: 'success', message: 'Test notification dispatched successfully! Watch your device for the alert.' });
    } catch (err) {
      console.error('FCM Test Dispatch failed:', err);
      setTestFeedback({ type: 'error', message: (err as Error).message || 'Failed to dispatch test notification.' });
    } finally {
      setSendingTest(false);
    }
  };

  const isSubscribed = status === 'subscribed';
  const isLoading = status === 'loading';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24 selection:bg-amber-500 selection:text-white">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-5%] left-[30%] w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[130px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[350px] h-[350px] bg-orange-500/5 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <div className="relative border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-6 lg:px-12 py-8">
        <div className="max-w-2xl mx-auto">
          <Link href="/settings" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-200 transition-colors mb-6 group">
            <BackIcon className="text-[16px] group-hover:-translate-x-0.5 transition-transform" />
            Back to Settings
          </Link>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <BellOnIcon className="text-amber-400 text-[26px]" />
            </div>
            <div>
              <h1 className="text-3xl font-black bg-gradient-to-r from-amber-200 to-orange-300 bg-clip-text text-transparent tracking-tight">
                Push Notifications
              </h1>
              <p className="text-slate-400 text-sm mt-0.5 font-medium">
                Receive real-time browser alerts for tasks and schedules
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative max-w-2xl mx-auto px-6 lg:px-12 mt-10 space-y-6">

        {/* Status Card */}
        <div className={`relative overflow-hidden rounded-[28px] border p-8 transition-all duration-500 ${
          isSubscribed ? 'bg-emerald-950/30 border-emerald-500/30' : 'bg-slate-900/60 border-slate-800'
        }`}>
          {isSubscribed && <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />}

          <div className="flex flex-col items-center text-center gap-6">
            <div className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 ${
              isSubscribed
                ? 'bg-emerald-500/15 border-2 border-emerald-500/40 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-800/80 border-2 border-slate-700'
            }`}>
              {isSubscribed ? (
                <>
                  <BellOnIcon className="text-emerald-400 text-[36px]" />
                  <div className="absolute inset-0 rounded-full border-2 border-emerald-400/30 animate-ping" />
                </>
              ) : (
                <BellOffIcon className="text-slate-500 text-[36px]" />
              )}
            </div>

            <div>
              <h2 className={`text-xl font-extrabold ${isSubscribed ? 'text-emerald-300' : 'text-white'}`}>
                {isSubscribed ? 'Push Notifications Active ✓' : 'Enable Push Notifications'}
              </h2>
              <p className="text-slate-400 text-sm mt-2 max-w-sm leading-relaxed font-medium">
                {isSubscribed
                  ? 'Your browser is subscribed. You\'ll receive alerts for tasks and schedules even when the app is in the background.'
                  : 'Get instant alerts for upcoming tasks, schedules, and reminders — even when My Orbit isn\'t open.'}
              </p>
            </div>

            {checkingStatus ? (
              <div className="flex flex-col items-center gap-3">
                <span className="inline-block w-8 h-8 border-2 border-slate-800 border-t-amber-500 rounded-full animate-spin" />
                <span className="text-slate-400 text-xs font-bold animate-pulse">Verifying subscription status...</span>
              </div>
            ) : status === 'denied' ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/25 rounded-full">
                  <BellOffIcon className="text-red-400 text-[16px]" />
                  <span className="text-red-400 text-xs font-bold">Permission Blocked in Browser</span>
                </div>
                <p className="text-slate-500 text-xs leading-relaxed max-w-xs text-center">
                  You&apos;ve blocked notifications in your browser. To re-enable, click the lock/info icon in your browser&apos;s address bar and allow notifications for this site.
                </p>
              </div>
            ) : isSubscribed ? (
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2.5 px-5 py-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-full">
                  <CheckIcon className="text-emerald-400 text-[18px]" />
                  <span className="text-emerald-300 text-sm font-extrabold">Subscribed</span>
                </div>

                <button
                  onClick={handleSendTestNotification}
                  disabled={sendingTest || isLoading}
                  className={`px-6 py-2.5 rounded-xl font-extrabold text-xs transition-all duration-200 mt-2 ${
                    sendingTest
                      ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 hover:scale-105 active:scale-95'
                  }`}
                >
                  {sendingTest ? 'Sending Test alert…' : '🔔 Send Test Notification'}
                </button>

                {testFeedback && (
                  <div className={`mt-1 px-4 py-2.5 rounded-xl text-xs font-semibold max-w-sm text-center ${
                    testFeedback.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400'
                      : 'bg-red-500/10 border border-red-500/25 text-red-400'
                  }`}>
                    {testFeedback.message}
                  </div>
                )}

                <div className="flex items-center gap-3 mt-2 flex-wrap justify-center">
                  <button
                    onClick={handleSubscribe}
                    disabled={isLoading || sendingTest}
                    className="text-xs font-bold text-slate-500 hover:text-amber-400 transition-all underline underline-offset-4"
                  >
                    {isLoading ? 'Syncing Token...' : '🔄 Sync/Re-register device token'}
                  </button>
                  <span className="text-slate-700">·</span>
                  <button
                    onClick={handleUnsubscribe}
                    disabled={unsubscribing}
                    className="text-xs font-bold text-red-500/70 hover:text-red-400 transition-all underline underline-offset-4"
                  >
                    {unsubscribing ? 'Removing…' : '🚫 Unsubscribe this device'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                id="enable-push-btn"
                onClick={handleSubscribe}
                disabled={isLoading}
                className={`relative px-8 py-3.5 rounded-2xl font-extrabold text-sm transition-all duration-200 ${
                  isLoading
                    ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-xl shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-105 active:scale-95'
                }`}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-slate-500 border-t-slate-200 rounded-full animate-spin" />
                    Requesting Permission…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <BellOnIcon className="text-[18px]" />
                    Enable Push Notifications
                  </span>
                )}
              </button>
            )}

            {status === 'error' && errorMessage && (
              <div className="flex items-start gap-2 px-4 py-3 bg-red-500/10 border border-red-500/25 rounded-xl text-left">
                <InfoIcon className="text-red-400 text-[16px] flex-shrink-0 mt-0.5" />
                <p className="text-red-400 text-xs font-semibold leading-relaxed">{errorMessage}</p>
              </div>
            )}
          </div>
        </div>

        {/* Diagnostic Card */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-[24px] p-6 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
            ⚙️ Diagnostic Console
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Notification Permission</span>
              <span className={`text-xs font-black mt-1 ${
                diagnosticPermission.toLowerCase() === 'granted' ? 'text-emerald-400' :
                diagnosticPermission.toLowerCase() === 'denied' ? 'text-rose-400' : 'text-amber-400'
              }`}>
                {diagnosticPermission.toUpperCase()}
              </span>
            </div>
            <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Service Worker</span>
              <span className={`text-xs font-black mt-1 ${
                diagnosticSwStatus.includes('Registered') && !diagnosticSwStatus.includes('Not') ? 'text-emerald-400' :
                diagnosticSwStatus.includes('Error') || diagnosticSwStatus.includes('Not') ? 'text-rose-400' : 'text-amber-400'
              }`}>
                {diagnosticSwStatus.toUpperCase()}
              </span>
            </div>
            <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">FCM Token</span>
              <span className={`text-xs font-black mt-1 ${
                diagnosticToken.includes('Available') ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {diagnosticToken}
              </span>
            </div>
          </div>
        </div>

        {/* Registered Devices */}
        {devices.length > 0 && (
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-[24px] p-6 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
              <DevicesIcon className="text-[15px] text-slate-600" />
              Registered Devices ({devices.length})
            </h3>
            {devices.map((device) => (
              <div key={device.fid} className="flex items-center justify-between gap-3 bg-slate-800/50 border border-slate-700/50 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${device.enabled ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                  <span className="text-xs font-bold text-slate-300 truncate">
                    {device.userAgent ? device.userAgent.split('(')[0].trim() : 'Browser Device'}
                  </span>
                  <span className="text-[10px] text-slate-600 font-mono truncate hidden sm:block">
                    {device.fid.slice(0, 14)}…
                  </span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${device.enabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>
                  {device.enabled ? 'Active' : 'Disabled'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Shared Users Management */}
        {user?.sharedWith && user.sharedWith.length > 0 && (
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-[24px] p-6 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
              🔗 Shared Access ({user.sharedWith.length})
            </h3>
            <p className="text-slate-500 text-xs font-medium leading-relaxed">
              These users can send push notification reminders to your device and receive reminders from you. Remove access if you no longer want to share.
            </p>
            <div className="space-y-2">
              {user.sharedWith.map((su) => (
                <div key={su.uid} className="flex items-center justify-between gap-3 bg-slate-800/50 border border-slate-700/50 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-indigo-300 font-extrabold text-xs">
                        {(su.displayName || 'U')[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-200 truncate">{su.displayName}</p>
                      <p className="text-[10px] text-slate-500 font-mono truncate">{su.shareId}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveSharedUser(su.uid, su.displayName)}
                    disabled={removingUser === su.uid}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-red-400/70 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
                    title="Remove shared access"
                  >
                    <DeleteIcon className="text-[14px]" />
                    {removingUser === su.uid ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How it works */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-[24px] p-6 space-y-4">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
            <InfoIcon className="text-[15px] text-slate-600" />
            How Push Notifications Work
          </h3>
          <ul className="space-y-3">
            {[
              { icon: '🔔', text: 'Alerts fire at the exact reminder time you set on a task or schedule.' },
              { icon: '📱', text: 'Works on desktop and mobile Chrome, Edge, Firefox, and Safari.' },
              { icon: '🔒', text: 'Your FCM token is stored securely in Firebase — only used to route notifications to your device.' },
              { icon: '🚀', text: 'Notifications are delivered even when My Orbit is closed, as long as your browser is open.' },
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-slate-400 font-medium">
                <span className="text-base flex-shrink-0">{item.icon}</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Device info */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-[24px] p-5 flex items-center gap-4">
          <DevicesIcon className="text-slate-600 text-[28px] flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-slate-400">
              Subscriptions are per-device. If you use My Orbit on multiple devices, enable push on each one separately.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
