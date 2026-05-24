'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import BellOnIcon from '@mui/icons-material/NotificationsActive';
import BellOffIcon from '@mui/icons-material/NotificationsOff';
import BackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import DevicesIcon from '@mui/icons-material/DevicesOther';
import { requestNotificationPermissionAndGetToken } from '@/app/lib/utils/fcm';
import { useAuth } from '@/app/lib/context/userContext';

type SubscriptionStatus = 'idle' | 'loading' | 'subscribed' | 'denied' | 'error';

export default function PushNotificationsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // On mount, check if the browser already has notification permission granted
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        setStatus('subscribed');
      } else if (Notification.permission === 'denied') {
        setStatus('denied');
      }
    }
  }, []);

  const handleSubscribe = async () => {
    if (!user) return;
    setStatus('loading');
    setErrorMessage('');
    try {
      const clientId = process.env.NEXT_PUBLIC_CLIENT_ID || `user_${user.uid}`;
      const token = await requestNotificationPermissionAndGetToken(clientId, user.uid);
      if (token) {
        setStatus('subscribed');
      } else {
        setStatus('error');
        setErrorMessage('Could not retrieve push token. Please try again.');
      }
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
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-200 transition-colors mb-6 group"
          >
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
          isSubscribed
            ? 'bg-emerald-950/30 border-emerald-500/30'
            : 'bg-slate-900/60 border-slate-800'
        }`}>
          {/* Glow when subscribed */}
          {isSubscribed && (
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
          )}

          <div className="flex flex-col items-center text-center gap-6">
            {/* Icon */}
            <div className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 ${
              isSubscribed
                ? 'bg-emerald-500/15 border-2 border-emerald-500/40 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-800/80 border-2 border-slate-700'
            }`}>
              {isSubscribed ? (
                <>
                  <BellOnIcon className="text-emerald-400 text-[36px]" />
                  {/* Pulse ring */}
                  <div className="absolute inset-0 rounded-full border-2 border-emerald-400/30 animate-ping" />
                </>
              ) : (
                <BellOffIcon className="text-slate-500 text-[36px]" />
              )}
            </div>

            {/* Title & description */}
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

            {/* CTA Button */}
            {status === 'denied' ? (
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
              <div className="flex items-center gap-2.5 px-5 py-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-full">
                <CheckIcon className="text-emerald-400 text-[18px]" />
                <span className="text-emerald-300 text-sm font-extrabold">Subscribed</span>
              </div>
            ) : (
              <button
                id="enable-push-btn"
                onClick={handleSubscribe}
                disabled={isLoading}
                className={`
                  relative px-8 py-3.5 rounded-2xl font-extrabold text-sm transition-all duration-200
                  ${isLoading
                    ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-xl shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-105 active:scale-95'
                  }
                `}
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

            {/* Error message */}
            {status === 'error' && errorMessage && (
              <div className="flex items-start gap-2 px-4 py-3 bg-red-500/10 border border-red-500/25 rounded-xl text-left">
                <InfoIcon className="text-red-400 text-[16px] flex-shrink-0 mt-0.5" />
                <p className="text-red-400 text-xs font-semibold leading-relaxed">{errorMessage}</p>
              </div>
            )}
          </div>
        </div>

        {/* How it works card */}
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
