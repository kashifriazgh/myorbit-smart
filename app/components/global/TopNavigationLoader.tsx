'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function TopNavigationLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const finishTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevPathRef = useRef(pathname + searchParams.toString());

  // Function to start the progress loader animation
  const startLoading = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (finishTimeoutRef.current) clearTimeout(finishTimeoutRef.current);

    setVisible(true);
    setIsLoading(true);
    setProgress(15);

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev < 65) return prev + Math.random() * 10 + 4;
        if (prev < 88) return prev + Math.random() * 3 + 1;
        if (prev < 96) return prev + 0.4;
        return prev;
      });
    }, 200);
  }, []);

  // Function to complete the loading animation
  const completeLoading = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setProgress(100);

    finishTimeoutRef.current = setTimeout(() => {
      setVisible(false);
      setIsLoading(false);
      finishTimeoutRef.current = setTimeout(() => {
        setProgress(0);
      }, 300);
    }, 250);
  }, []);

  // Track pathname or search params changes to complete loading
  useEffect(() => {
    const currentPath = pathname + searchParams.toString();
    if (prevPathRef.current !== currentPath) {
      prevPathRef.current = currentPath;
      completeLoading();
    }
  }, [pathname, searchParams, completeLoading]);

  // Intercept click events on links & patch history methods for programmatic navigation
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const anchor = target.closest('a') as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute('href');

      if (
        !href ||
        anchor.target === '_blank' ||
        anchor.hasAttribute('download') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('#') ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      try {
        const targetUrl = new URL(anchor.href, window.location.href);
        const currentUrl = new URL(window.location.href);

        if (targetUrl.origin === currentUrl.origin) {
          const isSamePathAndSearch =
            targetUrl.pathname === currentUrl.pathname &&
            targetUrl.search === currentUrl.search;

          if (!isSamePathAndSearch) {
            startLoading();
          }
        }
      } catch {
        // Ignore URL parsing errors
      }
    };

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function (...args) {
      const url = args[2];
      if (url) {
        try {
          const targetUrl = new URL(url.toString(), window.location.href);
          const currentUrl = new URL(window.location.href);
          if (
            targetUrl.pathname !== currentUrl.pathname ||
            targetUrl.search !== currentUrl.search
          ) {
            startLoading();
          }
        } catch {
          // ignore
        }
      }
      return originalPushState.apply(this, args);
    };

    window.history.replaceState = function (...args) {
      return originalReplaceState.apply(this, args);
    };

    const handlePopState = () => {
      startLoading();
    };

    document.addEventListener('click', handleAnchorClick, true);
    window.addEventListener('popstate', handlePopState);

    return () => {
      document.removeEventListener('click', handleAnchorClick, true);
      window.removeEventListener('popstate', handlePopState);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      if (timerRef.current) clearInterval(timerRef.current);
      if (finishTimeoutRef.current) clearTimeout(finishTimeoutRef.current);
    };
  }, [startLoading]);

  if (!visible && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '3.5px',
        zIndex: 999999,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 300ms ease-in-out',
      }}
    >
      {/* Container Track */}
      <div className="w-full h-full bg-blue-100/30 dark:bg-blue-950/40 overflow-hidden relative">
        {/* Base Progress Bar */}
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            background:
              'linear-gradient(90deg, #3b82f6 0%, #2563eb 60%, #1d4ed8 100%)',
            boxShadow:
              '0 0 12px rgba(59, 130, 246, 0.8), 0 0 6px rgba(37, 99, 235, 0.7)',
            transition:
              progress === 100
                ? 'width 150ms ease-out'
                : 'width 200ms cubic-bezier(0.4, 0, 0.2, 1)',
            borderRadius: '0 2px 2px 0',
          }}
        />

        {/* Dynamic Continuous Moving Line Across Entire Screen (2 Fast, 1 Slow Rhythm) */}
        {isLoading && progress < 100 && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(96, 165, 250, 0.4) 20%, #ffffff 50%, rgba(96, 165, 250, 0.4) 80%, transparent 100%)',
              boxShadow:
                '0 0 14px rgba(255, 255, 255, 0.9), 0 0 8px rgba(96, 165, 250, 0.9)',
              animation: 'dynamicRhythmicCrossing 4.2s infinite ease-in-out',
            }}
          />
        )}
      </div>

      <style jsx global>{`
        @keyframes dynamicRhythmicCrossing {
          /* --- PASS 1: FAST (~1.1s) --- */
          0% {
            left: -30%;
            width: 30%;
          }
          26% {
            left: 105%;
            width: 30%;
          }

          26.01% {
            left: -30%;
            width: 30%;
          }

          /* --- PASS 2: FAST (~1.1s) --- */
          30% {
            left: -30%;
            width: 30%;
          }
          56% {
            left: 105%;
            width: 30%;
          }

          56.01% {
            left: -40%;
            width: 40%;
          }

          /* --- PASS 3: SLOW (~1.8s) --- */
          60% {
            left: -40%;
            width: 40%;
          }
          100% {
            left: 105%;
            width: 40%;
          }
        }
      `}</style>
    </div>
  );
}
