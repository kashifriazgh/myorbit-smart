'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import BackIcon from '@mui/icons-material/ArrowBack';
import TerminalIcon from '@mui/icons-material/Terminal';
import RefreshIcon from '@mui/icons-material/Refresh';
import BugReportIcon from '@mui/icons-material/BugReport';
import { useAuth } from '@/app/lib/context/userContext';
import { userDb } from '@/app/lib/firebase';
import { registerNotificationDevice, getCurrentFcmToken } from '@/app/lib/utils/fcm';
import { doc, getDoc } from 'firebase/firestore';

interface ConsoleLog {
  type: string;
  message: string;
  time: string;
}

export default function PushDiagnosticsPage() {
  const { user } = useAuth();
  
  // Console logs interception state
  const [logs, setLogs] = useState<ConsoleLog[]>([]);
  const consoleBottomRef = useRef<HTMLDivElement>(null);

  // Diagnostics check status states
  const [compatCheck, setCompatCheck] = useState<'Checking...' | 'Supported ✓' | 'Not Supported ✗'>('Checking...');
  const [permissionCheck, setPermissionCheck] = useState<string>('Checking...');
  const [swCheck, setSwCheck] = useState<string>('Checking...');
  const [swScope, setSwScope] = useState<string>('None');
  const [fidCheck, setFidCheck] = useState<string>('Checking...');
  const [dbSyncCheck, setDbSyncCheck] = useState<string>('Checking...');
  const [dbEnabled, setDbEnabled] = useState<string>('Checking...');

  const [testingLocal, setTestingLocal] = useState(false);
  const [testingRemote, setTestingRemote] = useState(false);

  // ─── 1. INTERCEPT CONSOLE LOGS ───
  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    const addLog = (type: string, ...args: unknown[]) => {
      const msg = args
        .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
        .join(' ');
      const time = new Date().toLocaleTimeString();
      setLogs((prev) => [...prev.slice(-99), { type, message: msg, time }]);
    };

    console.log = (...args) => {
      originalLog.apply(console, args);
      addLog('info', ...args);
    };
    console.error = (...args) => {
      originalError.apply(console, args);
      addLog('error', ...args);
    };
    console.warn = (...args) => {
      originalWarn.apply(console, args);
      addLog('warn', ...args);
    };

    console.log('[FCM Diagnostics] Console log interception active.');

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  // Scroll to bottom when logs change
  useEffect(() => {
    if (consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // ─── 2. RUN SYSTEM DIAGNOSTIC CHECKS ───
  const runDiagnostics = async () => {
    console.log('[FCM Diagnostics] Running system checks...');
    
    // 1. Browser Push Support
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setCompatCheck('Supported ✓');
    } else {
      setCompatCheck('Not Supported ✗');
      console.error('[FCM Diagnostics] Browser does not support Service Workers or PushManager.');
    }

    // 2. Permission Status
    const perm = typeof window !== 'undefined' ? Notification.permission : 'Unknown';
    setPermissionCheck(perm);
    console.log('[FCM Diagnostics] Notification permission is:', perm);

    // 3. Service Worker checks
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        const fcmSw = regs.find((reg) => {
          const scriptUrl = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || '';
          return scriptUrl.includes('firebase-messaging-sw.js');
        });

        if (fcmSw) {
          setSwCheck(fcmSw.active ? 'Registered & Active' : 'Registered (Waiting/Installing)');
          setSwScope(fcmSw.scope);
          console.log('[FCM Diagnostics] Found FCM Service Worker with scope:', fcmSw.scope);
        } else {
          setSwCheck('Not Registered');
          setSwScope('None');
          console.warn('[FCM Diagnostics] No firebase-messaging-sw.js was found registered.');
        }
      } catch (swErr) {
        setSwCheck('Error checking registrations');
        console.error('[FCM Diagnostics] Error checking service workers:', swErr);
      }
    } else {
      setSwCheck('Not Supported');
    }

    // 4. FCM Token check
    const fid = await getCurrentFcmToken();
    if (fid) {
      setFidCheck(fid);
      console.log('[FCM Diagnostics] FCM Token obtained:', fid);

      // 5. Firestore sync check
      if (user) {
        try {
          const deviceRef = doc(userDb, 'users', user.uid, 'notificationDevices', fid);
          const snap = await getDoc(deviceRef);
          if (snap.exists()) {
            setDbSyncCheck('Synchronized ✓');
            setDbEnabled(snap.data().enabled ? 'True' : 'False (Disabled)');
            console.log('[FCM Diagnostics] Token is registered in Firestore. Enabled status:', snap.data().enabled);
          } else {
            setDbSyncCheck('Not Found in DB');
            setDbEnabled('N/A');
            console.warn('[FCM Diagnostics] Token does not exist in Firestore users collection.');
          }
        } catch (dbErr) {
          setDbSyncCheck('Error querying DB');
          setDbEnabled('Error');
          console.error('[FCM Diagnostics] Failed to query Firestore:', dbErr);
        }
      } else {
        setDbSyncCheck('User Logged Out');
        setDbEnabled('N/A');
      }
    } else {
      setFidCheck('Not Available');
      setDbSyncCheck('N/A');
      setDbEnabled('N/A');
      console.warn('[FCM Diagnostics] Failed to obtain Firebase Installation ID (FID).');
    }
  };

  useEffect(() => {
    runDiagnostics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ─── 3. ACTION CONTROLLERS ───
  const handleRequestPermission = async () => {
    console.log('[FCM Diagnostics] Requesting notification permission...');
    const result = await Notification.requestPermission();
    setPermissionCheck(result);
    console.log('[FCM Diagnostics] Request complete. Result:', result);
    runDiagnostics();
  };

  const handleForceRegistration = async () => {
    if (!user) return console.error('[FCM Diagnostics] Must be logged in to register device.');
    console.log('[FCM Diagnostics] Executing registerNotificationDevice...');
    try {
      await registerNotificationDevice(user.uid);
      console.log('[FCM Diagnostics] Registration executed successfully.');
    } catch (err) {
      console.error('[FCM Diagnostics] Registration failed:', err);
    }
    runDiagnostics();
  };

  const handleTestLocalNotification = async () => {
    setTestingLocal(true);
    console.log('[FCM Diagnostics] Triggering local notification test...');
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        const fcmSw = regs.find((reg) => {
          const scriptUrl = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || '';
          return scriptUrl.includes('firebase-messaging-sw.js');
        });

        if (fcmSw && fcmSw.active) {
          await fcmSw.showNotification('Local Push Test 🔔', {
            body: 'If you see this, notifications are working locally in your browser/OS!',
            icon: '/icons/icon-192x192.png',
            tag: 'test-local-fcm',
            requireInteraction: true,
          });
          console.log('[FCM Diagnostics] Local notification triggered successfully via SW.');
        } else {
          console.warn('[FCM Diagnostics] Active service worker not found. Attempting direct Notification API fallback...');
          new Notification('Local Fallback Test 🔔', {
            body: 'Fallback notification triggered directly.',
          });
        }
      } else {
        new Notification('Local Fallback Test 🔔', {
          body: 'Service workers are not supported by this browser.',
        });
      }
    } catch (err) {
      console.error('[FCM Diagnostics] Local test failed:', err);
    } finally {
      setTestingLocal(false);
    }
  };

  const handleTestRemoteFCM = async () => {
    if (!user) return console.error('[FCM Diagnostics] Cannot run remote test: user logged out.');
    setTestingRemote(true);
    console.log('[FCM Diagnostics] Dispatching test notification request to local server API...');
    try {
      const fid = await getCurrentFcmToken();
      if (!fid) throw new Error('No active FCM token found to target.');

      console.log(`[FCM] test notification target FCM token: ${fid} for user: ${user.uid}`);

      const { userAuth } = await import('@/app/lib/firebase');
      const idToken = await userAuth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error('Could not retrieve authentication session token.');

      const res = await fetch('/api/send-test-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          targetUid: user.uid,
          customTitle: 'Diagnostics Test Push 🚀',
          customBody: `Dispatched from diagnostics console to token: ${fid.slice(0, 5)}...`,
          customAppUrl: '/settings/push-diagnostics',
        }),
      });

      const responseData = await res.json();
      console.log(`[FCM Diagnostics] Server Response Code: ${res.status}`);
      console.log('[FCM Diagnostics] Server Response Payload:', responseData);
    } catch (err) {
      console.error('[FCM Diagnostics] Remote test dispatch failed:', err);
    } finally {
      setTestingRemote(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24 selection:bg-rose-500 selection:text-white">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-5%] left-[20%] w-[500px] h-[500px] bg-rose-500/5 rounded-full blur-[130px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[350px] h-[350px] bg-indigo-500/5 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <div className="relative border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-6 lg:px-12 py-8">
        <div className="max-w-4xl mx-auto">
          <Link href="/settings/push-notifications" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-200 transition-colors mb-6 group">
            <BackIcon className="text-[16px] group-hover:-translate-x-0.5 transition-transform" />
            Back to Push Notifications
          </Link>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                <BugReportIcon className="text-rose-400 text-[26px]" />
              </div>
              <div>
                <h1 className="text-3xl font-black bg-gradient-to-r from-rose-200 to-indigo-300 bg-clip-text text-transparent tracking-tight">
                  Diagnostics Console
                </h1>
                <p className="text-slate-400 text-sm mt-0.5 font-medium">
                  Real-time push diagnostics, manual testing, and logs capture
                </p>
              </div>
            </div>
            <button
              onClick={runDiagnostics}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors"
              title="Refresh Diagnostics"
            >
              <RefreshIcon className="text-slate-300" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid Content */}
      <div className="relative max-w-4xl mx-auto px-6 lg:px-12 mt-10 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Diagnostics Checklist (8 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-[28px] p-6 space-y-4 backdrop-blur-md">
            <h2 className="text-sm font-black uppercase tracking-[0.15em] text-slate-400">
              System Diagnostics
            </h2>

            <div className="divide-y divide-slate-800/60 text-sm font-medium">
              <div className="flex justify-between py-3">
                <span className="text-slate-400">Browser Compatibility</span>
                <span className={compatCheck.includes('Supported ✓') ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {compatCheck}
                </span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-slate-400">Notification Permission</span>
                <span className={permissionCheck === 'granted' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {permissionCheck.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-slate-400">Service Worker Registration</span>
                <span className={swCheck.includes('Active') ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {swCheck}
                </span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-slate-400">Service Worker Scope</span>
                <span className="text-slate-300 font-mono text-xs truncate max-w-[200px]">
                  {swScope}
                </span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-slate-400">FCM Registration Token</span>
                <span className="text-slate-300 font-mono text-xs truncate max-w-[200px]" title={fidCheck}>
                  {fidCheck}
                </span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-slate-400">Database Sync Status</span>
                <span className={dbSyncCheck.includes('Sync') ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {dbSyncCheck}
                </span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-slate-400">Database Enabled Status</span>
                <span className={dbEnabled === 'True' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {dbEnabled}
                </span>
              </div>
            </div>
          </div>

          {/* Action Panels */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-[28px] p-6 space-y-4 backdrop-blur-md">
            <h2 className="text-sm font-black uppercase tracking-[0.15em] text-slate-400">
              Manual Testing and Controls
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleRequestPermission}
                className="px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-850 text-xs font-bold text-slate-300 transition-colors text-left"
              >
                🔑 Request Browser Permission
              </button>
              <button
                onClick={handleForceRegistration}
                className="px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-850 text-xs font-bold text-slate-300 transition-colors text-left"
              >
                🔄 Force Re-Register Device
              </button>
              <button
                onClick={handleTestLocalNotification}
                disabled={testingLocal}
                className="px-4 py-3 rounded-xl bg-emerald-950/20 border border-emerald-900/50 hover:bg-emerald-950/30 text-xs font-bold text-emerald-300 transition-colors text-left"
              >
                {testingLocal ? '⚙️ Testing...' : '📲 Local Test Notification'}
              </button>
              <button
                onClick={handleTestRemoteFCM}
                disabled={testingRemote}
                className="px-4 py-3 rounded-xl bg-rose-950/20 border border-rose-900/50 hover:bg-rose-950/30 text-xs font-bold text-rose-300 transition-colors text-left"
              >
                {testingRemote ? '🚀 Dispatching...' : '🚀 FCM Dispatch Tester'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Console Logs Logger Output (5 cols) */}
        <div className="lg:col-span-5 flex flex-col min-h-[400px]">
          <div className="flex-1 bg-slate-950 border border-slate-800 rounded-[28px] p-5 flex flex-col overflow-hidden shadow-inner">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-900">
              <TerminalIcon className="text-slate-400 text-[18px]" />
              <h2 className="text-sm font-black uppercase tracking-[0.15em] text-slate-400">
                Log Console
              </h2>
            </div>

            {/* Scrollable logs list */}
            <div className="flex-1 overflow-y-auto space-y-2.5 font-mono text-[10px] leading-relaxed max-h-[420px] pr-1.5 custom-scrollbar">
              {logs.length === 0 ? (
                <div className="text-slate-600 italic py-4 text-center">No diagnostic logs recorded yet.</div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="space-y-0.5 border-l-2 pl-2 border-slate-900">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-600 font-sans">{log.time}</span>
                      <span className={`px-1 py-0.2 rounded font-sans uppercase font-bold text-[8px] ${
                        log.type === 'error' ? 'bg-rose-500/10 text-rose-400' :
                        log.type === 'warn' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {log.type}
                      </span>
                    </div>
                    <pre className={`whitespace-pre-wrap select-all font-mono font-medium ${
                      log.type === 'error' ? 'text-rose-400' :
                      log.type === 'warn' ? 'text-amber-400' : 'text-slate-300'
                    }`}>
                      {log.message}
                    </pre>
                  </div>
                ))
              )}
              <div ref={consoleBottomRef} />
            </div>

            <button
              onClick={() => setLogs([])}
              className="mt-3 w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 rounded-xl transition-colors"
            >
              Clear Log Console
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
