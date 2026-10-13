'use client';

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Chip,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  MenuBook as QuranBookIcon,
  CheckCircle,
  Undo as UndoIcon,
  RestartAlt as ResetIcon,
  Timer as TimerIcon,
  AutoAwesome as SparklesIcon,
  TaskAlt as CompletedIcon,
  NavigateNext as NextIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Goal } from '@/app/lib/interface';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import StreakCard from '@/app/components/goals/StreakCard';
import {
  SURAH_DATA,
  TOTAL_AYAT,
  getSurahByNumber,
  calculateTotalCompletedAyat,
  QuranProgress,
  PendingSurahCompletion,
  INITIAL_QURAN_PROGRESS,
} from '@/app/lib/config/quranData';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

interface QuranReadingTrackerProps {
  goal: Goal;
  onUpdateGoal?: (goalId: string, updates: Partial<Goal>) => Promise<void>;
}

function formatCountdown(msRemaining: number): string {
  const totalSeconds = Math.max(0, Math.ceil(msRemaining / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function QuranReadingTracker({ goal, onUpdateGoal }: QuranReadingTrackerProps) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const shouldReduceMotion = useReducedMotion();

  // Storage key for instant local cache bootstrap
  const storageKey = `myorbit:quran-reading:v1:${goal.id || 'active'}`;

  // Normalize initial progress from goal object or fallback
  const initialData: QuranProgress = useMemo(() => {
    const raw = goal.quranProgress;
    if (raw && typeof raw === 'object') {
      const cur = Math.max(1, Math.min(114, Number(raw.currentSurah) || 1));
      const pos: Record<number, number> = {};
      if (raw.positions && typeof raw.positions === 'object') {
        for (const [k, v] of Object.entries(raw.positions)) {
          const numKey = Number(k);
          if (!isNaN(numKey) && numKey >= 1 && numKey <= 114) {
            const surah = getSurahByNumber(numKey);
            pos[numKey] = Math.max(0, Math.min(surah.ayahCount, Number(v) || 0));
          }
        }
      }
      return {
        currentSurah: cur,
        positions: pos,
        lastCompletedSurah: raw.lastCompletedSurah ?? null,
        pendingCompletion: raw.pendingCompletion ?? null,
        completedAt: raw.completedAt ?? null,
      };
    }
    return INITIAL_QURAN_PROGRESS;
  }, [goal.quranProgress]);

  const [progress, setProgress] = useState<QuranProgress>(initialData);
  const [loaded, setLoaded] = useState(false);
  const [countdownRemaining, setCountdownRemaining] = useState<number>(0);
  const finalizingRef = useRef(false);

  // Read saved progress after mount from localStorage if available
  useEffect(() => {
    try {
      const cached = window.localStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed.currentSurah === 'number') {
          // If Firestore progress is newer or has higher Ayat count, prefer it, else use cached
          const cachedTotal = calculateTotalCompletedAyat(parsed.positions || {});
          const dbTotal = calculateTotalCompletedAyat(initialData.positions || {});
          if (cachedTotal > dbTotal) {
            setProgress(parsed);
          }
        }
      }
    } catch {
      // Fallback to initial
    } finally {
      setLoaded(true);
    }
  }, [storageKey, initialData]);

  // Sync state if goal.quranProgress updates externally
  useEffect(() => {
    if (goal.quranProgress) {
      setProgress((prev) => {
        // If pending event is same, don't overwrite local countdown state unnecessarily
        if (
          goal.quranProgress?.currentSurah === prev.currentSurah &&
          goal.quranProgress?.pendingCompletion?.eventId === prev.pendingCompletion?.eventId
        ) {
          return prev;
        }
        return {
          currentSurah: goal.quranProgress.currentSurah || 1,
          positions: goal.quranProgress.positions || {},
          lastCompletedSurah: goal.quranProgress.lastCompletedSurah ?? null,
          pendingCompletion: goal.quranProgress.pendingCompletion ?? null,
          completedAt: goal.quranProgress.completedAt ?? null,
        };
      });
    }
  }, [goal.quranProgress]);

  // Persist helper
  const persistQuranProgress = useCallback(
    async (nextProgress: QuranProgress, ayatLoggedDiff = 0) => {
      // 1. Local storage cache immediate write
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(nextProgress));
      } catch (err) {
        console.warn('Could not cache Quran progress locally:', err);
      }

      // 2. Compute overall metrics
      const totalCompleted = calculateTotalCompletedAyat(nextProgress.positions);
      const overallPct = Math.min(100, Math.round((totalCompleted / TOTAL_AYAT) * 10000) / 100);
      const todayStr = new Date().toISOString().split('T')[0];

      // Streak & Habit Check-ins sync
      const currentCheckIns = Array.isArray(goal.habitCheckIns) ? [...goal.habitCheckIns] : [];
      const hasTodayCheckIn = currentCheckIns.some((c) => c.date && c.date.split('T')[0] === todayStr);
      const updatedCheckIns = hasTodayCheckIn
        ? currentCheckIns.map((c) => (c.date && c.date.split('T')[0] === todayStr ? { ...c, completed: true } : c))
        : [...currentCheckIns, { id: 'chk_' + Date.now(), date: todayStr, completed: true }];

      // Reading logs sync
      const currentLogs = Array.isArray(goal.readingLogs) ? [...goal.readingLogs] : [];
      const existingTodayLog = currentLogs.find((l) => l.date === todayStr);
      let updatedLogs = currentLogs;
      if (ayatLoggedDiff > 0) {
        if (existingTodayLog) {
          updatedLogs = currentLogs.map((l) =>
            l.date === todayStr ? { ...l, pagesRead: (l.pagesRead || 0) + ayatLoggedDiff } : l
          );
        } else {
          updatedLogs = [
            {
              id: 'qlog_' + Date.now(),
              date: todayStr,
              pagesRead: ayatLoggedDiff,
              chapterNote: `Surah ${getSurahByNumber(nextProgress.currentSurah).name}`,
            },
            ...currentLogs,
          ];
        }
      }

      const updates: Partial<Goal> = {
        quranProgress: nextProgress,
        currentValue: totalCompleted,
        progress: overallPct,
        habitCheckIns: updatedCheckIns,
        readingLogs: updatedLogs,
        status: overallPct >= 100 ? 'Completed' : 'In Progress',
      };

      if (goal.id) {
        if (onUpdateGoal) {
          await onUpdateGoal(goal.id, updates);
        } else {
          await updateDoc(doc(db, 'goals', goal.id), updates);
        }
      }
    },
    [goal.id, goal.habitCheckIns, goal.readingLogs, onUpdateGoal, storageKey]
  );

  // Current Surah metadata (always sequential, non-editable by dropdown)
  const currentSurah = useMemo(() => getSurahByNumber(progress.currentSurah), [progress.currentSurah]);
  const currentAyah = progress.positions[currentSurah.number] ?? 0;

  // Overall statistics
  const totalCompleted = useMemo(() => calculateTotalCompletedAyat(progress.positions), [progress.positions]);
  const overallPercentage = Math.min(100, (totalCompleted / TOTAL_AYAT) * 100);
  const surahPercentage = Math.min(100, (currentAyah / currentSurah.ayahCount) * 100);

  const completedSurahsCount = useMemo(() => {
    return SURAH_DATA.filter((s) => (progress.positions[s.number] ?? 0) === s.ayahCount).length;
  }, [progress.positions]);

  // ── Finalize Pending Completion ───────────────────────────────────────────
  const finalizeCompletion = useCallback(async () => {
    if (finalizingRef.current) return;
    finalizingRef.current = true;

    try {
      const isLastSurahOfQuran = progress.currentSurah >= 114;
      const nextSurahNum = isLastSurahOfQuran ? 114 : progress.currentSurah + 1;

      const nextPositions = { ...progress.positions };
      nextPositions[progress.currentSurah] = currentSurah.ayahCount;

      const nextProgress: QuranProgress = {
        currentSurah: nextSurahNum,
        positions: nextPositions,
        lastCompletedSurah: progress.currentSurah,
        pendingCompletion: null,
        completedAt: isLastSurahOfQuran ? new Date().toISOString() : null,
      };

      setProgress(nextProgress);
      await persistQuranProgress(nextProgress, 0);
    } catch (err) {
      console.error('Failed to finalize Surah completion:', err);
    } finally {
      finalizingRef.current = false;
    }
  }, [progress, currentSurah.ayahCount, persistQuranProgress]);

  // ── Handle Two-Minute Timer (Real-time and Re-opening checks) ──────────────
  useEffect(() => {
    const pending = progress.pendingCompletion;
    if (!pending || pending.cancelled) {
      setCountdownRemaining(0);
      return;
    }

    const now = Date.now();
    const remaining = pending.expiresAt - now;

    // If user returned AFTER expiration -> finalize immediately!
    if (remaining <= 0) {
      finalizeCompletion();
      return;
    }

    setCountdownRemaining(remaining);

    const interval = setInterval(() => {
      const msLeft = pending.expiresAt - Date.now();
      if (msLeft <= 0) {
        clearInterval(interval);
        setCountdownRemaining(0);
        finalizeCompletion();
      } else {
        setCountdownRemaining(msLeft);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [progress.pendingCompletion, finalizeCompletion]);

  // ── Mark Ayat Position (Single-tap navigation) ────────────────────────────
  const markAyah = async (ayahNumber: number) => {
    if (ayahNumber < 1 || ayahNumber > currentSurah.ayahCount) return;

    const previousAyah = progress.positions[currentSurah.number] ?? 0;
    const diff = Math.max(0, ayahNumber - previousAyah);

    // Is this the final Ayat of the current Surah?
    if (ayahNumber === currentSurah.ayahCount) {
      // Create pending Surah completion with 2-minute expiration
      const pending: PendingSurahCompletion = {
        eventId: `surah_comp_${currentSurah.number}_${Date.now()}`,
        surahNumber: currentSurah.number,
        previousAyah: previousAyah,
        expiresAt: Date.now() + 2 * 60 * 1000, // exactly 2 minutes
      };

      const nextPositions = {
        ...progress.positions,
        [currentSurah.number]: ayahNumber,
      };

      const nextProgress: QuranProgress = {
        ...progress,
        positions: nextPositions,
        pendingCompletion: pending,
      };

      setProgress(nextProgress);
      await persistQuranProgress(nextProgress, diff);
    } else {
      // Normal Ayat reached (not the final one)
      const nextPositions = {
        ...progress.positions,
        [currentSurah.number]: ayahNumber,
      };

      const nextProgress: QuranProgress = {
        ...progress,
        positions: nextPositions,
        // If an undo was in effect or moving between Ayat, clear any pending completion
        pendingCompletion: null,
      };

      setProgress(nextProgress);
      await persistQuranProgress(nextProgress, diff);
    }
  };

  // ── Undo Action (Restore Previous Ayat Position & Cancel Pending) ─────────
  const handleUndo = async () => {
    const pending = progress.pendingCompletion;
    if (!pending) return;

    const restoredAyah = pending.previousAyah;
    const nextPositions = {
      ...progress.positions,
      [currentSurah.number]: restoredAyah,
    };

    const nextProgress: QuranProgress = {
      ...progress,
      positions: nextPositions,
      pendingCompletion: null,
    };

    setProgress(nextProgress);
    await persistQuranProgress(nextProgress, 0);
  };

  // ── Reset Entire Quran Progress ───────────────────────────────────────────
  const handleReset = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to reset all Quran reading progress to Surah Al-Fatihah? This will reset all Ayat markers.'
    );
    if (!confirmed) return;

    const resetState: QuranProgress = {
      currentSurah: 1,
      positions: {},
      lastCompletedSurah: null,
      pendingCompletion: null,
      completedAt: null,
    };

    setProgress(resetState);
    await persistQuranProgress(resetState, 0);
  };

  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const surfaceBg = isDark ? '#1e293b' : '#ffffff';
  const textPrimary = isDark ? '#f8fafc' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  if (!loaded) {
    return (
      <Box sx={{ width: '100%', maxWidth: 760, mx: 'auto', p: 3 }}>
        <Box sx={{ height: 28, width: 220, bgcolor: isDark ? '#334155' : '#e2e8f0', borderRadius: '8px', mb: 2 }} />
        <Box sx={{ height: 120, bgcolor: isDark ? '#1e293b' : '#f8fafc', borderRadius: '20px', mb: 2 }} />
        <Box sx={{ height: 240, bgcolor: isDark ? '#1e293b' : '#f8fafc', borderRadius: '20px' }} />
      </Box>
    );
  }

  const isKhatamComplete = completedSurahsCount === 114;

  return (
    <Box sx={{ width: '100%', maxWidth: 760, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* ── 1. OVERALL QURAN PROGRESS HERO CARD ── */}
      <Box
        sx={{
          borderRadius: '24px',
          border: `1px solid ${cardBorder}`,
          bgcolor: surfaceBg,
          p: { xs: 2.5, sm: 3 },
          boxShadow: isDark ? '0 8px 30px rgba(0,0,0,0.35)' : '0 8px 30px rgba(16, 185, 129, 0.08)',
          background: isDark
            ? 'linear-gradient(135deg, rgba(6, 78, 59, 0.25) 0%, rgba(30, 41, 59, 1) 100%)'
            : 'linear-gradient(135deg, rgba(236, 253, 245, 0.9) 0%, #ffffff 100%)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                flexShrink: 0,
              }}
            >
              <QuranBookIcon sx={{ fontSize: 26 }} />
            </Box>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  The Holy Quran Tracker
                </Typography>
                <Chip
                  label="Hafs / Kufi (6,236 Ayat)"
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: 10,
                    fontWeight: 700,
                    bgcolor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5',
                    color: '#059669',
                  }}
                />
              </Box>
              <Typography sx={{ fontSize: { xs: 20, sm: 22 }, fontWeight: 900, color: textPrimary, mt: 0.3 }}>
                Quran Reading Goal
              </Typography>
            </Box>
          </Box>

          <Button
            size="small"
            onClick={handleReset}
            startIcon={<ResetIcon sx={{ fontSize: 15 }} />}
            sx={{
              color: textMuted,
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: '10px',
              px: 1.25,
              '&:hover': { color: '#ef4444', bgcolor: 'rgba(239, 68, 68, 0.08)' },
            }}
          >
            Reset
          </Button>
        </Box>

        {/* Overall Percentage & Gauge */}
        <Box sx={{ mt: 2.5, p: 2, borderRadius: '18px', bgcolor: isDark ? 'rgba(15, 23, 42, 0.5)' : '#ffffff', border: `1px solid ${cardBorder}` }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mb: 1.25, flexWrap: 'wrap', gap: 1 }}>
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase' }}>
                Overall Quran Progress
              </Typography>
              <Typography sx={{ fontSize: 28, fontWeight: 900, color: '#059669', lineHeight: 1.1, mt: 0.25 }}>
                {overallPercentage.toFixed(2)}%
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 800, color: textPrimary }}>
                {totalCompleted.toLocaleString()} <span style={{ color: textMuted, fontWeight: 600 }}>/ {TOTAL_AYAT.toLocaleString()} Ayat</span>
              </Typography>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#059669', mt: 0.2 }}>
                {completedSurahsCount} of 114 Surahs Completed
              </Typography>
            </Box>
          </Box>

          {/* Progress Bar */}
          <Box sx={{ height: 9, borderRadius: 99, bgcolor: isDark ? '#334155' : '#e2e8f0', overflow: 'hidden' }}>
            <Box
              sx={{
                height: '100%',
                width: `${overallPercentage}%`,
                background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                borderRadius: 99,
                transition: 'width 0.4s ease',
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* ── 2. CURRENT SURAH (NON-EDITABLE TEXT, SEQUENTIAL WORKFLOW) ── */}
      <Box
        sx={{
          borderRadius: '24px',
          border: `1px solid ${cardBorder}`,
          bgcolor: surfaceBg,
          p: { xs: 2.5, sm: 3 },
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.06)',
        }}
      >
        {/* Header: Non-editable Surah indicator */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Active Reading Surah
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, mt: 0.25 }}>
              <Typography sx={{ fontSize: { xs: 20, sm: 24 }, fontWeight: 900, color: textPrimary }}>
                {currentSurah.number}. {currentSurah.name}
              </Typography>
              {currentSurah.arabicName && (
                <Typography sx={{ fontSize: { xs: 18, sm: 22 }, fontWeight: 800, color: '#059669', fontFamily: 'serif' }}>
                  {currentSurah.arabicName}
                </Typography>
              )}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={`Surah ${currentSurah.number} of 114`}
              size="small"
              sx={{
                fontWeight: 800,
                fontSize: 11,
                bgcolor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe',
                color: '#0284c7',
              }}
            />
            {currentSurah.revelationType && (
              <Chip
                label={currentSurah.revelationType}
                size="small"
                sx={{
                  fontWeight: 700,
                  fontSize: 10.5,
                  bgcolor: isDark ? 'rgba(148, 163, 184, 0.15)' : '#f1f5f9',
                  color: textMuted,
                }}
              />
            )}
          </Box>
        </Box>

        {/* Current Surah Status Bar */}
        <Box sx={{ p: 2, borderRadius: '16px', bgcolor: isDark ? 'rgba(15, 23, 42, 0.5)' : '#f8fafc', border: `1px solid ${cardBorder}`, mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: textPrimary }}>
              {currentAyah === 0
                ? 'No Ayat recorded yet in this Surah'
                : `Last read: Ayat ${currentAyah} of ${currentSurah.ayahCount}`}
            </Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 900, color: '#059669' }}>
              {surahPercentage.toFixed(1)}%
            </Typography>
          </Box>

          <Box sx={{ height: 7, borderRadius: 99, bgcolor: isDark ? '#334155' : '#e2e8f0', overflow: 'hidden' }}>
            <Box
              sx={{
                height: '100%',
                width: `${surahPercentage}%`,
                bgcolor: '#10b981',
                borderRadius: 99,
                transition: 'width 0.3s ease',
              }}
            />
          </Box>
        </Box>

        {/* ── 3. ANIMATED 2-MINUTE UNDO CONFIRMATION BANNER ── */}
        <AnimatePresence>
          {progress.pendingCompletion && !progress.pendingCompletion.cancelled && (
            <motion.div
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 15 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <Box
                sx={{
                  mb: 3,
                  p: { xs: 2, sm: 2.5 },
                  borderRadius: '20px',
                  bgcolor: isDark ? 'rgba(6, 78, 59, 0.35)' : '#ecfdf5',
                  border: '1.5px solid',
                  borderColor: isDark ? 'rgba(16, 185, 129, 0.4)' : '#6ee7b7',
                  boxShadow: '0 8px 25px rgba(16, 185, 129, 0.2)',
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'stretch', sm: 'center' },
                  justifyContent: 'space-between',
                  gap: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '12px',
                      bgcolor: '#10b981',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      mt: 0.25,
                    }}
                  >
                    <CompletedIcon sx={{ fontSize: 24 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 14.5, fontWeight: 900, color: isDark ? '#6ee7b7' : '#065f46' }}>
                      Alhamdulillah! You&apos;ve completed Surah {currentSurah.name}.
                    </Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: isDark ? '#a7f3d0' : '#047857', mt: 0.3 }}>
                      {currentSurah.number < 114
                        ? 'Your next Surah will open automatically in 2 minutes.'
                        : 'MashaAllah! You have completed the entire Quran!'}
                    </Typography>

                    {/* Countdown indicator */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                      <Box
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.6,
                          px: 1.5,
                          py: 0.35,
                          borderRadius: '999px',
                          bgcolor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.8)',
                          border: '1px solid',
                          borderColor: isDark ? 'rgba(16, 185, 129, 0.4)' : '#a7f3d0',
                        }}
                      >
                        <TimerIcon sx={{ fontSize: 14, color: '#10b981' }} />
                        <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#059669', fontFamily: 'monospace' }}>
                          Auto-advancing in {formatCountdown(countdownRemaining)}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Box>

                {/* Actions: Undo button & Instant Next button */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: { xs: 'flex-end', sm: 'flex-end' } }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleUndo}
                    startIcon={<UndoIcon sx={{ fontSize: 16 }} />}
                    sx={{
                      borderRadius: '12px',
                      textTransform: 'none',
                      fontWeight: 800,
                      fontSize: 12,
                      borderColor: '#10b981',
                      color: isDark ? '#a7f3d0' : '#065f46',
                      bgcolor: isDark ? 'rgba(0,0,0,0.2)' : '#ffffff',
                      py: 0.9,
                      px: 2,
                      '&:hover': {
                        borderColor: '#059669',
                        bgcolor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5',
                      },
                    }}
                  >
                    Undo — Return to previous Ayat
                  </Button>

                  {currentSurah.number < 114 && (
                    <Tooltip title="Skip wait and advance now">
                      <IconButton
                        size="small"
                        onClick={finalizeCompletion}
                        sx={{
                          bgcolor: '#10b981',
                          color: '#ffffff',
                          borderRadius: '12px',
                          p: '8px',
                          '&:hover': { bgcolor: '#059669' },
                        }}
                      >
                        <NextIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 4. COMPLETION NOTICE (IF LAST COMPLETED SURAH) ── */}
        {progress.lastCompletedSurah && !progress.pendingCompletion && (
          <Box
            sx={{
              mb: 2.5,
              p: 2,
              borderRadius: '16px',
              bgcolor: isDark ? 'rgba(6, 78, 59, 0.2)' : '#ecfdf5',
              border: '1px solid',
              borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <CheckCircle sx={{ color: '#10b981', fontSize: 22 }} />
            <Box>
              <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: isDark ? '#a7f3d0' : '#065f46' }}>
                Surah {getSurahByNumber(progress.lastCompletedSurah).name} completed!
              </Typography>
              <Typography sx={{ fontSize: 11, color: textMuted }}>
                {progress.lastCompletedSurah < 114
                  ? `You are now reading Surah ${currentSurah.name}.`
                  : 'MashaAllah! You have completed the recitation of the Holy Quran!'}
              </Typography>
            </Box>
          </Box>
        )}

        {/* ── 5. AYAT POSITION SELECTOR GRID ── */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 800, color: textPrimary }}>
                Mark Your Reading Position
              </Typography>
              <Typography sx={{ fontSize: 11, color: textMuted }}>
                Tap the last Ayat you have read in this Surah:
              </Typography>
            </Box>

            <Chip
              label={`${currentAyah} / ${currentSurah.ayahCount}`}
              size="small"
              sx={{
                fontWeight: 800,
                fontSize: 11,
                bgcolor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5',
                color: '#059669',
              }}
            />
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(6, 1fr)',
                sm: 'repeat(10, 1fr)',
                md: 'repeat(12, 1fr)',
              },
              gap: 1,
              maxHeight: 280,
              overflowY: 'auto',
              p: 1.5,
              borderRadius: '16px',
              border: `1px solid ${cardBorder}`,
              bgcolor: isDark ? 'rgba(15, 23, 42, 0.3)' : '#f8fafc',
            }}
          >
            {Array.from({ length: currentSurah.ayahCount }, (_, index) => index + 1).map((ayahNumber) => {
              const isCurrent = currentAyah === ayahNumber;
              const isRecorded = ayahNumber <= currentAyah;
              const isLast = ayahNumber === currentSurah.ayahCount;

              return (
                <button
                  key={ayahNumber}
                  type="button"
                  aria-pressed={isCurrent}
                  aria-label={`Mark Ayat ${ayahNumber} as last read`}
                  onClick={() => markAyah(ayahNumber)}
                  className={[
                    'flex aspect-square min-h-9 items-center justify-center rounded-xl text-xs font-bold transition-all cursor-pointer',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 active:scale-95 shadow-xs',
                    isCurrent
                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-gray-900 scale-105'
                      : isRecorded
                      ? 'bg-emerald-100/90 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : isLast
                      ? 'border border-dashed border-emerald-400 bg-white text-emerald-700 hover:bg-emerald-50 dark:bg-slate-900 dark:text-emerald-400'
                      : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-white/5',
                  ].join(' ')}
                >
                  {ayahNumber}
                </button>
              );
            })}
          </Box>

          <Typography sx={{ fontSize: 11, color: textMuted, mt: 1.5, lineHeight: 1.4 }}>
            💡 Selecting Ayat {currentSurah.ayahCount} marks Surah {currentSurah.name} complete. A 2-minute countdown begins during which you can easily Undo if needed before automatically progressing to the next Surah.
          </Typography>
        </Box>
      </Box>

      {/* ── 6. KHATAM COMPLETION CELEBRATION (WHEN ALL 114 SURAHS COMPLETE) ── */}
      {isKhatamComplete && (
        <Box
          sx={{
            p: 3,
            borderRadius: '24px',
            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
            color: '#ffffff',
            boxShadow: '0 12px 30px rgba(5, 150, 105, 0.4)',
            textAlign: 'center',
          }}
        >
          <SparklesIcon sx={{ fontSize: 36, mb: 1 }} />
          <Typography sx={{ fontSize: 22, fontWeight: 900 }}>
            MashaAllah! Complete Quran Recitation Finished!
          </Typography>
          <Typography sx={{ fontSize: 13, mt: 0.5, opacity: 0.9 }}>
            You have completed all 114 Surahs and 6,236 Ayat. May Allah accept your recitation!
          </Typography>
        </Box>
      )}

      {/* ── 7. STREAK STATUS CARD ── */}
      <StreakCard
        goal={goal}
        onUpdateGoal={onUpdateGoal}
        logs={(goal.readingLogs || []).map((r) => ({ date: r.date, value: r.pagesRead }))}
        metricLabel="Quran recitation"
      />
    </Box>
  );
}
