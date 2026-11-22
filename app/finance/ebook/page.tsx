'use client';

import React, { useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  List,
  Lightbulb,
  Sparkles,
  X,
} from 'lucide-react';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import {
  URDU_FINANCE_EBOOK_CHAPTERS,
  type EbookBlock,
  type EbookChapter,
} from '@/app/lib/data/urduFinanceEbook';

type TextScale = 'sm' | 'md' | 'lg';

const SCALE_CLASSES: Record<TextScale, { body: string; pointTitle: string; majorHeading: string; subHeading: string }> = {
  sm: {
    body: 'text-sm sm:text-base',
    pointTitle: 'text-base sm:text-lg',
    majorHeading: 'text-lg sm:text-xl',
    subHeading: 'text-base sm:text-lg',
  },
  md: {
    body: 'text-base sm:text-lg',
    pointTitle: 'text-lg sm:text-xl',
    majorHeading: 'text-xl sm:text-2xl',
    subHeading: 'text-lg sm:text-xl',
  },
  lg: {
    body: 'text-lg sm:text-xl',
    pointTitle: 'text-xl sm:text-2xl',
    majorHeading: 'text-2xl sm:text-3xl',
    subHeading: 'text-xl sm:text-2xl',
  },
};

export default function UrduFinanceEbookPage() {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  // null = clean 11-section index view; number = reading that chapter
  const [activeChapterId, setActiveChapterId] = useState<number | null>(null);
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const [textScale, setTextScale] = useState<TextScale>('md');
  const topRef = useRef<HTMLDivElement | null>(null);

  const activeChapter: EbookChapter | null = useMemo(
    () =>
      activeChapterId === null
        ? null
        : URDU_FINANCE_EBOOK_CHAPTERS.find((c) => c.id === activeChapterId) ?? null,
    [activeChapterId]
  );

  const activeIdx = useMemo(
    () =>
      activeChapterId === null
        ? -1
        : URDU_FINANCE_EBOOK_CHAPTERS.findIndex((c) => c.id === activeChapterId),
    [activeChapterId]
  );

  const prevChapter = activeIdx > 0 ? URDU_FINANCE_EBOOK_CHAPTERS[activeIdx - 1] : null;
  const nextChapter =
    activeIdx >= 0 && activeIdx < URDU_FINANCE_EBOOK_CHAPTERS.length - 1
      ? URDU_FINANCE_EBOOK_CHAPTERS[activeIdx + 1]
      : null;

  const openChapter = (id: number) => {
    setActiveChapterId(id);
    setNavDrawerOpen(false);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scale = SCALE_CLASSES[textScale];

  const renderBlock = (block: EbookBlock, idx: number) => {
    switch (block.type) {
      case 'heading': {
        if (block.level === 'sub') {
          return (
            <h3
              key={idx}
              className={`mt-6 mb-3 inline-flex items-center gap-2 rounded-xl border-r-4 border-teal-500 px-3.5 py-2 font-bold ${scale.subHeading} ${
                isDark
                  ? 'bg-teal-500/10 text-teal-200'
                  : 'bg-teal-50 text-teal-900'
              }`}
            >
              <span>{block.text}</span>
            </h3>
          );
        }

        return (
          <div
            key={idx}
            className={`mt-9 mb-4 flex items-center gap-3 rounded-2xl border-r-4 border-emerald-500 px-4 py-3.5 shadow-sm ${
              isDark
                ? 'bg-gradient-to-l from-emerald-500/15 via-[#282e3d] to-[#282e3d] text-white ring-1 ring-white/10'
                : 'bg-gradient-to-l from-emerald-50 via-white to-slate-50 text-slate-900 ring-1 ring-emerald-200/70'
            }`}
          >
            {typeof block.number === 'number' && (
              <span
                dir="ltr"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-sm font-extrabold text-white shadow-sm"
                style={{ fontFamily: 'var(--font-inter), sans-serif', lineHeight: 1 }}
              >
                {block.number}
              </span>
            )}
            <h2 className={`font-extrabold leading-relaxed ${scale.majorHeading}`}>
              {block.text}
            </h2>
          </div>
        );
      }

      case 'paragraph':
        return (
          <p
            key={idx}
            className={`mb-4 ${scale.body} ${
              block.emphasis
                ? isDark
                  ? 'font-bold text-emerald-300'
                  : 'font-bold text-emerald-800'
                : isDark
                ? 'text-slate-200'
                : 'text-slate-700'
            }`}
            style={{ lineHeight: 2.25 }}
          >
            {block.text}
          </p>
        );

      case 'point':
        return (
          <div
            key={idx}
            className={`mb-4 rounded-2xl border p-4 sm:p-5 transition-colors ${
              isDark
                ? 'border-white/10 bg-[#282e3d]/80'
                : 'border-slate-200/90 bg-slate-50/90'
            }`}
          >
            <div className="mb-2.5 flex items-start gap-3">
              <span
                dir="ltr"
                className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold ${
                  isDark
                    ? 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30'
                    : 'bg-blue-600 text-white'
                }`}
                style={{ fontFamily: 'var(--font-inter), sans-serif', lineHeight: 1 }}
              >
                {block.number}
              </span>
              <h3
                className={`font-bold ${scale.pointTitle} ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
                style={{ lineHeight: 2 }}
              >
                {block.title}
              </h3>
            </div>

            {block.paragraphs.map((p, pIdx) => (
              <p
                key={pIdx}
                className={`mb-2 last:mb-0 ${scale.body} ${
                  isDark ? 'text-slate-200' : 'text-slate-700'
                }`}
                style={{ lineHeight: 2.2 }}
              >
                {p}
              </p>
            ))}

            {block.bullets && block.bullets.length > 0 && (
              <ul className="my-3 space-y-2 pr-4">
                {block.bullets.map((item, bIdx) => (
                  <li
                    key={bIdx}
                    className={`flex items-start gap-2.5 ${scale.body} ${
                      isDark ? 'text-slate-200' : 'text-slate-700'
                    }`}
                    style={{ lineHeight: 2.1 }}
                  >
                    <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}

            {block.afterBullets &&
              block.afterBullets.map((p, aIdx) => (
                <p
                  key={aIdx}
                  className={`mt-2 ${scale.body} ${
                    isDark ? 'text-slate-300' : 'text-slate-600'
                  }`}
                  style={{ lineHeight: 2.2 }}
                >
                  {p}
                </p>
              ))}
          </div>
        );

      case 'bullets':
        return (
          <ul key={idx} className="my-4 space-y-2.5 pr-2">
            {block.items.map((item, bIdx) => (
              <li
                key={bIdx}
                className={`flex items-start gap-3 ${scale.body} ${
                  isDark ? 'text-slate-200' : 'text-slate-700'
                }`}
                style={{ lineHeight: 2.15 }}
              >
                <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        );

      case 'numberedList':
        return (
          <ol key={idx} className="my-4 space-y-3">
            {block.items.map((item, nIdx) => (
              <li
                key={nIdx}
                className={`flex items-start gap-3 rounded-xl border px-3.5 py-2.5 ${
                  isDark
                    ? 'border-white/10 bg-[#282e3d]/60 text-slate-200'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                <span
                  dir="ltr"
                  className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-extrabold text-white"
                  style={{ fontFamily: 'var(--font-inter), sans-serif', lineHeight: 1 }}
                >
                  {nIdx + 1}
                </span>
                <span className={scale.body} style={{ lineHeight: 2.1 }}>
                  {item}
                </span>
              </li>
            ))}
          </ol>
        );

      case 'table':
        return (
          <div
            key={idx}
            className={`my-5 overflow-x-auto rounded-2xl border ${
              isDark ? 'border-white/10' : 'border-slate-200'
            }`}
          >
            <table className="w-full border-collapse text-right">
              <thead>
                <tr
                  className={
                    isDark
                      ? 'bg-emerald-600/20 text-emerald-200'
                      : 'bg-emerald-50 text-emerald-900'
                  }
                >
                  {block.headers.map((h, hIdx) => (
                    <th
                      key={hIdx}
                      className={`border-b px-4 py-3 font-bold ${scale.body} ${
                        isDark ? 'border-white/10' : 'border-emerald-200/80'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rIdx) => {
                  const isTotalRow =
                    rIdx === block.rows.length - 1 &&
                    (row[0]?.includes('کل') || row[0]?.includes('مجموعی'));
                  return (
                    <tr
                      key={rIdx}
                      className={
                        isTotalRow
                          ? isDark
                            ? 'bg-emerald-500/15 font-bold text-white'
                            : 'bg-emerald-50/80 font-bold text-slate-900'
                          : rIdx % 2 === 1
                          ? isDark
                            ? 'bg-white/[0.03]'
                            : 'bg-slate-50/70'
                          : ''
                      }
                    >
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className={`border-b px-4 py-3 ${scale.body} ${
                            isDark
                              ? 'border-white/5 text-slate-200'
                              : 'border-slate-100 text-slate-700'
                          }`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );

      case 'callout': {
        const isPrinciple = block.kind === 'principle';
        return (
          <div
            key={idx}
            className={`my-5 rounded-2xl border-r-4 p-4 sm:p-5 ${
              isPrinciple
                ? isDark
                  ? 'border-amber-400 bg-amber-500/10 text-amber-100'
                  : 'border-amber-500 bg-amber-50 text-amber-950'
                : isDark
                ? 'border-sky-400 bg-sky-500/10 text-sky-100'
                : 'border-sky-500 bg-sky-50 text-sky-950'
            }`}
          >
            <div className="mb-1.5 flex items-center gap-2 font-bold">
              {isPrinciple ? (
                <Sparkles size={16} className={isDark ? 'text-amber-300' : 'text-amber-600'} />
              ) : (
                <Lightbulb size={16} className={isDark ? 'text-sky-300' : 'text-sky-600'} />
              )}
              <span className={scale.subHeading}>{block.label}</span>
            </div>
            <p className={scale.body} style={{ lineHeight: 2.2 }}>
              {block.text}
            </p>
          </div>
        );
      }

      case 'divider':
        return (
          <hr
            key={idx}
            className={`my-7 border-0 h-px ${
              isDark
                ? 'bg-gradient-to-l from-transparent via-white/15 to-transparent'
                : 'bg-gradient-to-l from-transparent via-slate-300 to-transparent'
            }`}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div
      ref={topRef}
      className={`min-h-screen pb-24 transition-colors ${
        isDark ? 'bg-[#181c24] text-white' : 'bg-[#f1f5f9] text-slate-900'
      }`}
    >
      {/* Top Navigation Bar */}
      <div
        className={`sticky top-0 z-20 border-b backdrop-blur-md ${
          isDark
            ? 'border-white/10 bg-[#181c24]/90'
            : 'border-slate-200 bg-white/90'
        }`}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-3 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            {activeChapter ? (
              <button
                type="button"
                onClick={() => setActiveChapterId(null)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition cursor-pointer ${
                  isDark
                    ? 'border-white/10 bg-[#1f2430] text-slate-200 hover:bg-[#282e3d]'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <ArrowLeft size={15} />
                <span>All 11 Chapters</span>
              </button>
            ) : (
              <Link
                href="/finance"
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                  isDark
                    ? 'border-white/10 bg-[#1f2430] text-slate-200 hover:bg-[#282e3d]'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <ArrowLeft size={15} />
                <span>Finance</span>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeChapter && (
              <div
                className={`inline-flex items-center rounded-xl border p-0.5 ${
                  isDark
                    ? 'border-white/10 bg-[#1f2430]'
                    : 'border-slate-200 bg-slate-100'
                }`}
                aria-label="Text size"
              >
                {(['sm', 'md', 'lg'] as const).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setTextScale(sz)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                      textScale === sz
                        ? 'bg-emerald-600 text-white'
                        : isDark
                        ? 'text-slate-400 hover:text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {sz === 'sm' ? 'A-' : sz === 'md' ? 'A' : 'A+'}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setNavDrawerOpen(true)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition cursor-pointer ${
                isDark
                  ? 'border-white/10 bg-[#1f2430] text-slate-200 hover:bg-[#282e3d]'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <List size={15} />
              <span className="hidden sm:inline">Chapters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-3 pt-5 sm:px-6">
        {!activeChapter ? (
          /* Starting Page: Clean 11-Section Clickable Navigation (no extra headlines) */
          <div dir="rtl" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {URDU_FINANCE_EBOOK_CHAPTERS.map((chapter) => (
              <button
                key={chapter.id}
                type="button"
                onClick={() => openChapter(chapter.id)}
                className={`group flex items-center justify-between gap-3 rounded-2xl border p-4 text-right transition-all cursor-pointer ${
                  chapter.isComingSoon
                    ? isDark
                      ? 'border-white/5 bg-[#1f2430]/70 hover:border-white/15'
                      : 'border-slate-200/80 bg-white/80 hover:border-slate-300'
                    : isDark
                    ? 'border-emerald-500/30 bg-[#1f2430] shadow-lg hover:border-emerald-400/60 hover:-translate-y-0.5'
                    : 'border-emerald-200 bg-white shadow-sm hover:border-emerald-400 hover:-translate-y-0.5'
                }`}
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  <span
                    dir="ltr"
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ${
                      chapter.isComingSoon
                        ? isDark
                          ? 'bg-white/5 text-slate-400'
                          : 'bg-slate-100 text-slate-500'
                        : 'bg-emerald-600 text-white shadow-sm'
                    }`}
                    style={{ fontFamily: 'var(--font-inter), sans-serif', lineHeight: 1 }}
                  >
                    {chapter.id}
                  </span>
                  <div className="min-w-0">
                    <span
                      className={`block text-xs font-semibold ${
                        chapter.isComingSoon
                          ? isDark
                            ? 'text-slate-500'
                            : 'text-slate-400'
                          : isDark
                          ? 'text-emerald-400'
                          : 'text-emerald-700'
                      }`}
                    >
                      {chapter.badge}
                    </span>
                    <p
                      className={`mt-0.5 text-base font-bold break-words ${
                        chapter.isComingSoon
                          ? isDark
                            ? 'text-slate-400'
                            : 'text-slate-500'
                          : isDark
                          ? 'text-white'
                          : 'text-slate-900'
                      }`}
                    >
                      {chapter.title}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {chapter.isComingSoon && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        isDark
                          ? 'bg-white/5 text-slate-400'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      جلد آرہا ہے
                    </span>
                  )}
                  <ChevronLeft
                    size={18}
                    className={`transition-transform group-hover:-translate-x-1 ${
                      isDark ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  />
                </div>
              </button>
            ))}
          </div>
        ) : (
          /* Chapter Reader View */
          <article
            dir="rtl"
            className={`rounded-3xl border p-5 sm:p-8 transition-colors ${
              isDark
                ? 'border-white/10 bg-[#1f2430] shadow-xl'
                : 'border-slate-200 bg-white shadow-sm'
            }`}
          >
            {/* Emerging Chapter Title Banner */}
            <header
              className={`mb-7 rounded-2xl border p-5 sm:p-6 ${
                isDark
                  ? 'border-emerald-500/30 bg-gradient-to-l from-emerald-600/20 via-[#282e3d] to-[#282e3d]'
                  : 'border-emerald-200 bg-gradient-to-l from-emerald-50 via-teal-50/40 to-white'
              }`}
            >
              <div className="mb-2 flex items-center gap-2.5">
                <span
                  dir="ltr"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-xs font-extrabold text-white"
                  style={{ fontFamily: 'var(--font-inter), sans-serif', lineHeight: 1 }}
                >
                  {activeChapter.id}
                </span>
                <span
                  className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                    isDark
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {activeChapter.badge}
                </span>
              </div>
              <h1
                className={`text-2xl sm:text-3xl font-extrabold ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
                style={{ lineHeight: 2 }}
              >
                {activeChapter.title}
              </h1>
              {activeChapter.subtitle && (
                <p
                  className={`mt-1 text-sm sm:text-base font-medium ${
                    isDark ? 'text-slate-300' : 'text-slate-600'
                  }`}
                  style={{ lineHeight: 2 }}
                >
                  {activeChapter.subtitle}
                </p>
              )}
            </header>

            {activeChapter.isComingSoon ? (
              <div
                className={`rounded-2xl border p-8 text-center ${
                  isDark
                    ? 'border-white/10 bg-[#282e3d]/60 text-slate-300'
                    : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
              >
                <BookOpen size={32} className="mx-auto mb-3 text-emerald-500 opacity-80" />
                <p className="text-lg font-bold">اس باب کا مواد جلد شامل کیا جائے گا۔</p>
              </div>
            ) : (
              <div>{activeChapter.blocks.map((block, idx) => renderBlock(block, idx))}</div>
            )}

            {/* Bottom Previous / Next Chapter Navigation */}
            <nav
              className={`mt-10 flex flex-wrap items-center justify-between gap-3 border-t pt-6 ${
                isDark ? 'border-white/10' : 'border-slate-200'
              }`}
            >
              {prevChapter ? (
                <button
                  type="button"
                  onClick={() => openChapter(prevChapter.id)}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition cursor-pointer ${
                    isDark
                      ? 'border-white/10 bg-[#282e3d] text-slate-200 hover:border-emerald-500/40'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-400'
                  }`}
                >
                  <ChevronRight size={16} />
                  <span>پچھلا باب ({prevChapter.id})</span>
                </button>
              ) : (
                <div />
              )}

              {nextChapter && (
                <button
                  type="button"
                  onClick={() => openChapter(nextChapter.id)}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-500 cursor-pointer"
                >
                  <span>اگلا باب ({nextChapter.id})</span>
                  <ChevronLeft size={16} />
                </button>
              )}
            </nav>
          </article>
        )}
      </div>

      {/* Chapter Navigation Drawer (Quick jump to all 11 sections) */}
      {navDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs"
          onClick={() => setNavDrawerOpen(false)}
        >
          <div
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
            className={`flex h-full w-full max-w-sm flex-col border-r p-4 shadow-2xl ${
              isDark
                ? 'border-white/10 bg-[#1f2430] text-white'
                : 'border-slate-200 bg-white text-slate-900'
            }`}
          >
            <div
              className={`mb-3 flex items-center justify-between border-b pb-3 ${
                isDark ? 'border-white/10' : 'border-slate-200'
              }`}
            >
              <span className="text-base font-bold">ابواب کی فہرست (11 حصے)</span>
              <button
                type="button"
                onClick={() => setNavDrawerOpen(false)}
                className={`rounded-full p-1.5 cursor-pointer ${
                  isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                }`}
                aria-label="Close chapters menu"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto pl-1">
              {URDU_FINANCE_EBOOK_CHAPTERS.map((ch) => {
                const isActive = ch.id === activeChapterId;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => openChapter(ch.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-right transition cursor-pointer ${
                      isActive
                        ? isDark
                          ? 'border-emerald-500 bg-emerald-500/15 text-white'
                          : 'border-emerald-500 bg-emerald-50 text-emerald-950'
                        : isDark
                        ? 'border-white/5 bg-[#282e3d]/60 text-slate-200 hover:border-white/15'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span
                      dir="ltr"
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold ${
                        isActive
                          ? 'bg-emerald-600 text-white'
                          : isDark
                          ? 'bg-white/10 text-slate-300'
                          : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                      style={{ fontFamily: 'var(--font-inter), sans-serif', lineHeight: 1 }}
                    >
                      {ch.id}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block text-sm font-bold break-words">{ch.title}</span>
                      <span
                        className={`text-[11px] ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        {ch.isComingSoon ? 'جلد آرہا ہے' : ch.badge}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

