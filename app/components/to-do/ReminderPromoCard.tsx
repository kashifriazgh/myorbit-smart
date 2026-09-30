'use client';

import React, { useState, useEffect } from 'react';

const Bell = () => (
  <svg viewBox="0 0 160 140" className="h-full w-full" aria-hidden="true">
    {/* motion lines */}
    <g fill="none" strokeLinecap="round" strokeWidth="4">
      <g stroke="#A4C63E">
        <path d="M30 30 q-7 11 -4 24" />
        <path d="M17 42 q-5 11 0 22" />
        <path d="M130 30 q7 11 4 24" />
        <path d="M143 42 q5 11 0 22" />
        <path d="M128 122 l4 9" />
      </g>
      <g stroke="#F26B2D">
        <path d="M22 100 l10 4" />
        <path d="M30 113 l9 2" />
        <path d="M134 108 l9 -4" />
        <path d="M120 120 l7 4" />
      </g>
    </g>

    {/* swinging bell */}
    <g className="origin-[80px_18px] motion-safe:animate-[bellRing_2.4s_ease-in-out_infinite]">
      <circle cx="80" cy="20" r="7" fill="#F26A10" />
      <path
        d="M80 27 C58 27 50 47 50 71 C50 91 44 97 36 105 L124 105 C116 97 110 91 110 71 C110 47 102 27 80 27 Z"
        fill="#FF7E1F"
      />
      <path d="M95 31 C108 39 110 57 110 71 C110 91 116 97 124 105 L100 105 C105 94 101 80 98 64 Z" fill="#F2600C" opacity=".55" />
      <rect x="32" y="102" width="96" height="13" rx="6.5" fill="#F56A0E" />
      <path d="M67 117 a13 10 0 0 0 26 0 z" fill="#B8430B" />
      <g stroke="#fff" strokeLinecap="round" fill="none">
        <path d="M63 46 C57 54 56 63 57 73" strokeWidth="5" />
        <path d="M69 37 h.1" strokeWidth="6" />
      </g>
    </g>
  </svg>
);

interface ReminderPromoCardProps {
  taskId?: string;
  title?: string;
  description?: string;
  buttonLabel?: string;
  onSetNow?: (e: React.MouseEvent<HTMLElement>) => void;
  className?: string;
}

export default function ReminderPromoCard({
  taskId,
  title = 'Set the reminder',
  description = 'Never miss your task routine!. Get a push notification.',
  buttonLabel = 'Set Now',
  onSetNow,
  className = '',
}: ReminderPromoCardProps) {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  const storageKey = taskId
    ? `myorbit_reminder_card_minimized_${taskId}`
    : 'myorbit_reminder_card_minimized_default';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      if (saved === 'true') {
        setIsMinimized(true);
      } else {
        setIsMinimized(false);
      }
    }
  }, [storageKey]);

  const handleToggleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextState = !isMinimized;
    setIsMinimized(nextState);
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, String(nextState));
    }
  };

  if (isMinimized) {
    return (
      <section
        onClick={onSetNow}
        className={`relative flex w-full items-center justify-between gap-3 rounded-2xl bg-[#FFD9BE] py-3 px-4 shadow-sm transition-all hover:bg-[#ffcfaf] cursor-pointer ${className}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xl leading-none">🔔</span>
          <span className="text-sm font-extrabold text-[#1E1713] truncate">
            {title}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onSetNow}
            className="rounded-full bg-[#5A270C] px-4 py-1.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#6E3313] active:scale-95 cursor-pointer"
          >
            {buttonLabel}
          </button>
          <button
            type="button"
            onClick={handleToggleMinimize}
            className="text-[11px] font-bold text-[#5A270C]/80 hover:text-[#5A270C] underline px-1 py-0.5 cursor-pointer"
            title="Expand card"
          >
            Expand
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-[28px] bg-[#FFD9BE] p-6 sm:p-7 shadow-sm ${className}`}
    >
      <style>{`@keyframes bellRing{0%,55%,100%{transform:rotate(0)}10%{transform:rotate(9deg)}20%{transform:rotate(-8deg)}30%{transform:rotate(6deg)}40%{transform:rotate(-4deg)}50%{transform:rotate(2deg)}}`}</style>

      <div className="min-w-0 flex-1">
        <h2 className="text-[22px] sm:text-[26px] font-extrabold leading-tight tracking-tight text-[#1E1713]">{title}</h2>
        <p className="mt-2 whitespace-pre-line text-[14px] sm:text-[15px] font-medium leading-snug text-[#3D2E25]">{description}</p>
        
        <div className="mt-5 space-y-2">
          <div>
            <button
              type="button"
              onClick={onSetNow}
              className="rounded-full bg-[#5A270C] px-7 py-3 text-sm sm:text-base font-bold text-white shadow-md transition-all hover:bg-[#6E3313] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5A270C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFD9BE] active:scale-95 cursor-pointer"
            >
              {buttonLabel}
            </button>
          </div>
          <div>
            <button
              type="button"
              onClick={handleToggleMinimize}
              className="text-xs font-extrabold text-[#5A270C]/80 hover:text-[#5A270C] underline transition-all cursor-pointer inline-flex items-center gap-1 py-0.5"
              title="Minimize banner"
            >
              <span>─</span> Minimize
            </button>
          </div>
        </div>
      </div>

      <div className="h-28 w-32 sm:h-36 sm:w-40 shrink-0">
        <Bell />
      </div>
    </section>
  );
}
