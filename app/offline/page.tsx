'use client';

import React, { useEffect, useState } from 'react';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);
  const [dots, setDots] = useState('');

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Animated dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Auto-reload when back online
  useEffect(() => {
    if (isOnline) {
      const timer = setTimeout(() => window.location.reload(), 800);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .offline-root {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
          color: #f1f5f9;
          position: relative;
          overflow: hidden;
          text-align: center;
        }

        /* Subtle floating orbs */
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.15;
          animation: drift 8s ease-in-out infinite alternate;
          pointer-events: none;
        }
        .orb-1 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, #2563eb, transparent);
          top: -100px; left: -100px;
          animation-delay: 0s;
        }
        .orb-2 {
          width: 300px; height: 300px;
          background: radial-gradient(circle, #7c3aed, transparent);
          bottom: -80px; right: -80px;
          animation-delay: -4s;
        }
        @keyframes drift {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(30px, 20px) scale(1.1); }
        }

        .card {
          position: relative;
          background: rgba(30, 41, 59, 0.7);
          border: 1px solid rgba(100, 116, 139, 0.25);
          border-radius: 24px;
          padding: 48px 40px;
          max-width: 420px;
          width: 100%;
          backdrop-filter: blur(16px);
          box-shadow: 0 25px 60px rgba(0,0,0,0.4);
          z-index: 1;
        }

        .icon-wrap {
          width: 80px; height: 80px;
          border-radius: 50%;
          background: linear-gradient(135deg, #1d4ed8, #7c3aed);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 28px;
          box-shadow: 0 0 40px rgba(37, 99, 235, 0.4);
          animation: pulse-ring 2.5s ease-in-out infinite;
        }
        @keyframes pulse-ring {
          0%, 100% { box-shadow: 0 0 0 0 rgba(37,99,235,0.4), 0 0 40px rgba(37,99,235,0.4); }
          50%       { box-shadow: 0 0 0 16px rgba(37,99,235,0), 0 0 40px rgba(37,99,235,0.4); }
        }

        .icon-wrap svg {
          width: 38px; height: 38px;
          color: #fff;
        }

        h1 {
          font-size: 1.6rem;
          font-weight: 700;
          margin-bottom: 12px;
          background: linear-gradient(135deg, #e2e8f0, #94a3b8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          line-height: 1.3;
        }

        .subtitle {
          font-size: 0.9rem;
          color: #94a3b8;
          line-height: 1.6;
          margin-bottom: 32px;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 18px;
          border-radius: 99px;
          font-size: 0.82rem;
          font-weight: 600;
          margin-bottom: 28px;
          transition: all 0.4s ease;
        }
        .status-badge.offline {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
        }
        .status-badge.online {
          background: rgba(34, 197, 94, 0.15);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #86efac;
        }
        .dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          animation: blink 1.2s ease-in-out infinite;
        }
        .offline .dot { background: #f87171; }
        .online  .dot { background: #4ade80; }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }

        .retry-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 28px;
          border-radius: 12px;
          background: linear-gradient(135deg, #2563eb, #7c3aed);
          color: #fff;
          font-size: 0.9rem;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.2s;
          text-decoration: none;
        }
        .retry-btn:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }
        .retry-btn:active { transform: translateY(0); }

        .tips {
          margin-top: 32px;
          padding: 18px 20px;
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.5);
          border: 1px solid rgba(100, 116, 139, 0.15);
          text-align: left;
        }
        .tips-title {
          font-size: 0.78rem;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 10px;
        }
        .tips ul {
          list-style: none;
          display: flex; flex-direction: column; gap: 6px;
        }
        .tips li {
          font-size: 0.82rem;
          color: #94a3b8;
          display: flex; align-items: flex-start; gap: 8px;
        }
        .tips li::before {
          content: '›';
          color: #3b82f6;
          font-weight: 700;
          flex-shrink: 0;
        }

        .app-name {
          font-size: 0.78rem;
          color: #475569;
          margin-top: 28px;
          letter-spacing: 0.04em;
        }
      `}</style>

      <div className="offline-root">
        <div className="orb orb-1" />
        <div className="orb orb-2" />

        <div className="card">
          {/* Icon */}
          <div className="icon-wrap">
            {isOnline ? (
              // Wifi icon (online)
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
              </svg>
            ) : (
              // No-wifi icon (offline)
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.584 10.587a5.25 5.25 0 016.834.829M5.106 11.856c1.818-1.818 4.13-2.886 6.448-3.204M1.924 8.674a14.244 14.244 0 014.144-2.904M17.573 8.43A14.25 14.25 0 0122.076 8.674M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
              </svg>
            )}
          </div>

          {/* Status badge */}
          <div className={`status-badge ${isOnline ? 'online' : 'offline'}`}>
            <span className="dot" />
            {isOnline ? `Back online — reloading${dots}` : 'No internet connection'}
          </div>

          <h1>{isOnline ? 'Connected!' : 'You\'re Offline'}</h1>

          <p className="subtitle">
            {isOnline
              ? 'Your connection is restored. Taking you back to My Orbit…'
              : 'My Orbit can\'t reach the server right now. Previously visited pages are available offline.'}
          </p>

          {!isOnline && (
            <button className="retry-btn" onClick={() => window.location.reload()}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Try again
            </button>
          )}

          {!isOnline && (
            <div className="tips">
              <div className="tips-title">What you can do</div>
              <ul>
                <li>Check your Wi-Fi or mobile data</li>
                <li>Navigate to a previously visited page</li>
                <li>Come back when you&apos;re connected again</li>
              </ul>
            </div>
          )}
        </div>

        <p className="app-name">MY ORBIT · Smart Productivity</p>
      </div>
    </>
  );
}
