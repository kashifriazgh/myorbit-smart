'use client';

import React, { useMemo, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  IconButton,
  TextField,
  Paper,
  Stack,
  CircularProgress,
} from '@mui/material';
import {
  Check as CheckIcon,
  ChevronLeft,
  ChevronRight,
  Close as CloseIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { Goal } from '@/app/lib/interface';
import { useGoals } from '@/app/lib/context/GoalsContext';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { doc, updateDoc, Timestamp, getDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

export interface PendingCheckItem {
  goalId: string;
  goal: Goal;
  category: string;
  subcategory: string;
  title: string;
  color: string;
  emoji: string;
  timeWindowLabel: string; // e.g. "Night action", "Morning action", "Flexible"
  isTimeWindowActive: boolean;
  promptText: string;
  quickActionLabel: string;
  actionType:
    | 'saving_deposit'
    | 'fitness_workout'
    | 'nutrition_log'
    | 'weight_log'
    | 'sleep_log'
    | 'medical_action'
    | 'reading_log'
    | 'course_unit'
    | 'daily_routine';
  suggestedQty?: number;
  unitLabel?: string;
  exerciseId?: string;
  exerciseName?: string;
}

function getExerciseEmoji(name: string): string {
  const n = (name || '').toLowerCase();
  if (n.includes('walk')) return '🚶';
  if (n.includes('run')) return '🏃';
  if (n.includes('cycl') || n.includes('bike')) return '🚴';
  if (n.includes('gym') || n.includes('workout')) return '🏋️';
  if (n.includes('push')) return '🤸';
  if (n.includes('squat')) return '🦵';
  if (n.includes('yoga') || n.includes('stretch')) return '🧘';
  if (n.includes('swim')) return '🏊';
  return '🏃';
}

function getNutritionEmoji(item: string): string {
  const n = (item || '').toLowerCase();
  if (n.includes('water') || n.includes('drink')) return '💧';
  if (n.includes('protein') || n.includes('meat')) return '🥩';
  if (n.includes('calor') || n.includes('burn')) return '🔥';
  if (n.includes('sugar') || n.includes('sweet')) return '🍬';
  if (n.includes('soft') || n.includes('soda')) return '🥤';
  if (n.includes('fast') || n.includes('burger')) return '🍔';
  if (n.includes('meal') || n.includes('salad')) return '🥗';
  if (n.includes('supple') || n.includes('vitamin')) return '💊';
  return '🥗';
}

export default function DailyChecks() {
  const { goals, updateGoal } = useGoals();
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const currentHour = useMemo(() => new Date().getHours() + new Date().getMinutes() / 60, []);

  // Inline input state for custom quantities (e.g. custom deposit amount or weight)
  const [customValueInputs, setCustomValueInputs] = useState<Record<string, number | string>>({});
  const [activeCustomInputs, setActiveCustomInputs] = useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [dismissedCardIds, setDismissedCardIds] = useState<Record<string, boolean>>({});
  const [activeCardIndex, setActiveCardIndex] = useState(0);

  const handleDismissCard = (checkId: string) => {
    setDismissedCardIds((prev) => ({ ...prev, [checkId]: true }));
  };

  // Time-window helper: determines if current hour matches preferred time
  const isTimeWindowMatching = useCallback((preferredTimeStr?: string): { active: boolean; label: string } => {
    if (!preferredTimeStr) return { active: true, label: 'Anytime' };
    const p = preferredTimeStr.toLowerCase();
    if (p.includes('morning') || p.includes('06:') || p.includes('07:') || p.includes('08:')) {
      return { active: currentHour >= 5 && currentHour < 12, label: 'Morning Action (6 AM - 12 PM)' };
    }
    if (p.includes('afternoon') || p.includes('12:') || p.includes('13:') || p.includes('14:')) {
      return { active: currentHour >= 12 && currentHour < 17, label: 'Afternoon Action (12 PM - 5 PM)' };
    }
    if (p.includes('evening') || p.includes('17:') || p.includes('18:') || p.includes('19:') || p.includes('20:')) {
      return { active: currentHour >= 17 && currentHour < 21, label: 'Evening Action (5 PM - 9 PM)' };
    }
    if (p.includes('night') || p.includes('21:') || p.includes('22:') || p.includes('23:')) {
      return { active: currentHour >= 20 || currentHour < 5, label: 'Night Action (9 PM - 5 AM)' };
    }
    return { active: true, label: 'Flexible' };
  }, [currentHour]);

  // Evaluate pending check items for all active goals
  const pendingChecks = useMemo(() => {
    if (!user?.uid || !Array.isArray(goals)) return [];

    const list: PendingCheckItem[] = [];

    userGoalsLoop: for (const g of goals) {
      if (!g.id || g.userId !== user.uid || g.status === 'Completed' || g.isArchived) {
        continue;
      }

      const cat = (g.type || 'finance').toLowerCase();
      const subcat = (g.subcategory || '').toLowerCase();
      const ans = g.questionnaireAnswers || {};

      // EXCLUDE Expense and Income as requested
      if (subcat.includes('expense') || subcat.includes('income')) {
        continue;
      }

      // ── 1. FINANCE - SAVINGS ──
      if (cat === 'finance' && (subcat.includes('saving') || subcat.includes('fund'))) {
        const txns = Array.isArray(g.transactions) ? g.transactions : [];
        const monthlyTarget = Number(g.overallTargetValue || 0);
        const hasDepositedThisMonth = txns.some((t) => {
          const tDate = String(t.date || '');
          return tDate.startsWith(todayStr.slice(0, 7));
        });

        if (!hasDepositedThisMonth) {
          const suggestedAmount = monthlyTarget > 0 ? Math.round(monthlyTarget / 3) : 5000;
          list.push({
            goalId: g.id,
            goal: g,
            category: 'Finance',
            subcategory: 'Saving',
            title: g.title,
            color: '#10B981',
            emoji: '💰',
            timeWindowLabel: 'Monthly Deposit Check',
            isTimeWindowActive: true,
            promptText: `Have you deposited savings for '${g.title}' this month?`,
            quickActionLabel: `Yes, Deposited PKR ${suggestedAmount.toLocaleString()}`,
            actionType: 'saving_deposit',
            suggestedQty: suggestedAmount,
            unitLabel: 'PKR',
          });
        }
      }

      // ── 2. HEALTH - FITNESS ──
      else if (cat === 'health' && (subcat.includes('fitness') || subcat.includes('walking'))) {
        const exercises = Array.isArray(g.exerciseItems)
          ? (g.exerciseItems as Array<{ id?: string; name: string; targetValue?: number; currentValue?: number; unit?: string; scheduleTime?: string }>)
          : [];

        if (exercises.length > 0) {
          exercises.forEach((ex, idx) => {
            const exName = ex.name || `Exercise #${idx + 1}`;
            const exTarget = ex.targetValue || 30;
            const exUnit = ex.unit || 'mins';
            const exCurrent = ex.currentValue || 0;
            const prefTime = String(ex.scheduleTime || ans.preferred_time || ans.scheduleTime || '');
            const tw = isTimeWindowMatching(prefTime);

            const isCompleted = exTarget > 0 && exCurrent >= exTarget;
            if (!isCompleted) {
              list.push({
                goalId: `${g.id}_ex_${ex.id || idx}`,
                goal: g,
                category: 'Health',
                subcategory: 'Fitness',
                title: `${g.title} · ${exName}`,
                color: '#F59E0B',
                emoji: getExerciseEmoji(exName),
                timeWindowLabel: tw.label,
                isTimeWindowActive: tw.active,
                promptText: `Did you complete today's ${exName} session (${exTarget} ${exUnit})?`,
                quickActionLabel: `Yes, Log ${exTarget} ${exUnit}!`,
                actionType: 'fitness_workout',
                suggestedQty: exTarget,
                unitLabel: exUnit,
                exerciseId: ex.id || String(idx),
                exerciseName: exName,
              });
            }
          });
        } else {
          const prefTime = String(ans.preferred_time || '');
          const tw = isTimeWindowMatching(prefTime);
          list.push({
            goalId: g.id!,
            goal: g,
            category: 'Health',
            subcategory: 'Fitness',
            title: g.title,
            color: '#F59E0B',
            emoji: '🏃',
            timeWindowLabel: tw.label,
            isTimeWindowActive: tw.active,
            promptText: `Did you complete today's workout session?`,
            quickActionLabel: `Yes, Completed Workout!`,
            actionType: 'fitness_workout',
            suggestedQty: 30,
            unitLabel: 'mins',
          });
        }
      }

      // ── 3. HEALTH - NUTRITION ──
      else if (cat === 'health' && (subcat.includes('nutrition') || subcat.includes('diet'))) {
        const logs = Array.isArray(g.nutritionLogs) ? (g.nutritionLogs as Array<{ date: string }>) : [];
        const loggedToday = logs.some((l) => l.date === todayStr);

        if (!loggedToday) {
          const rawType = String(
            ans.track_item ||
            ans.track_item_custom ||
            ans.nutrition_type ||
            ans.item_type ||
            ans.track_item_other ||
            g.title ||
            'Nutrition'
          ).trim();

          let cleanType = rawType;
          if (cleanType.toLowerCase() === 'nutrition goal' || cleanType.toLowerCase() === 'nutrition') {
            cleanType = 'Nutrition';
          }

          if (cleanType.toLowerCase().endsWith('intake')) {
            cleanType = cleanType.substring(0, cleanType.length - 6).trim();
          }

          const unit = String(g.unit || ans.unit_water || ans.unit_protein || ans.unit_calories || 'servings');
          const prefTime = String(ans.preferred_time || '');
          const tw = isTimeWindowMatching(prefTime);
          const emoji = getNutritionEmoji(cleanType);

          const targetQty = Number(g.overallTargetValue || ans.target_amount || 1);

          list.push({
            goalId: g.id!,
            goal: g,
            category: 'Health',
            subcategory: 'Nutrition',
            title: `${g.title} · ${cleanType}`,
            color: '#10B981',
            emoji: emoji,
            timeWindowLabel: tw.label,
            isTimeWindowActive: tw.active,
            promptText: `Have you logged your ${cleanType} intake for today (${targetQty} ${unit})?`,
            quickActionLabel: `Yes, Logged ${targetQty} ${unit}!`,
            actionType: 'nutrition_log',
            suggestedQty: targetQty,
            unitLabel: unit,
          });
        }
      }

      // ── 4. HEALTH - WEIGHT ──
      else if (cat === 'health' && subcat.includes('weight')) {
        const logs = Array.isArray(g.weightLogs) ? (g.weightLogs as Array<{ date: string }>) : [];
        const loggedThisWeek = logs.some((l) => {
          const lDate = new Date(l.date);
          const diffDays = Math.abs((new Date().getTime() - lDate.getTime()) / (1000 * 3600 * 24));
          return diffDays <= 6;
        });

        if (!loggedThisWeek) {
          const targetKg = Number(g.overallTargetValue || 70);
          list.push({
            goalId: g.id,
            goal: g,
            category: 'Health',
            subcategory: 'Weight',
            title: g.title,
            color: '#EC4899',
            emoji: '⚖️',
            timeWindowLabel: 'Weekly Weight Check',
            isTimeWindowActive: true,
            promptText: `Have you logged your current weight for this week?`,
            quickActionLabel: `Log Current Weight`,
            actionType: 'weight_log',
            suggestedQty: targetKg,
            unitLabel: 'kg',
          });
        }
      }

      // ── 5. HEALTH - SLEEP ──
      else if (cat === 'health' && subcat.includes('sleep')) {
        const logs = Array.isArray(g.sleepLogs) ? (g.sleepLogs as Array<{ date: string }>) : [];
        const loggedToday = logs.some((l) => l.date === todayStr);

        if (!loggedToday) {
          const tw = isTimeWindowMatching('morning'); // Sleep check asked in morning
          list.push({
            goalId: g.id,
            goal: g,
            category: 'Health',
            subcategory: 'Sleep',
            title: g.title,
            color: '#6366F1',
            emoji: '😴',
            timeWindowLabel: tw.label,
            isTimeWindowActive: tw.active,
            promptText: `Did you get 7+ hours of sleep last night?`,
            quickActionLabel: `Yes, Slept 7.5 Hours`,
            actionType: 'sleep_log',
            suggestedQty: 7.5,
            unitLabel: 'hours',
          });
        }
      }

      // ── 6. HEALTH - MEDICAL CARE PLAN ──
      else if (cat === 'health' && subcat.includes('medical')) {
        const appts = Array.isArray(g.medicalAppointments) ? (g.medicalAppointments as Array<{ id?: string; doctorName?: string; hospitalName?: string; date?: string; completed?: boolean }>) : [];
        const pendingAppt = appts.find((a) => !a.completed && a.date && a.date <= todayStr);

        if (pendingAppt) {
          const name = pendingAppt.doctorName || pendingAppt.hospitalName || 'Doctor';
          list.push({
            goalId: g.id,
            goal: g,
            category: 'Health',
            subcategory: 'Medical Care',
            title: g.title,
            color: '#EF4444',
            emoji: '🩺',
            timeWindowLabel: 'Appointment Scheduled Today',
            isTimeWindowActive: true,
            promptText: `Have you visited ${name} today?`,
            quickActionLabel: `Yes, Visited ${name}`,
            actionType: 'medical_action',
          });
        }
      }

      // ── 7. LEARNING - READING ──
      else if (cat === 'learning' && subcat.includes('reading')) {
        const logs = Array.isArray(g.readingLogs) ? (g.readingLogs as Array<{ date: string }>) : [];
        const loggedToday = logs.some((l) => l.date === todayStr);

        if (!loggedToday) {
          const trackBy = String(ans.track_by || 'pages').toLowerCase();
          const targetQty = Number(ans.daily_target_qty || (trackBy.includes('chapter') ? 1 : 10));
          const prefTime = String(ans.preferred_time || '');
          const tw = isTimeWindowMatching(prefTime);
          const materialName = String(ans.material_name || ans.reading_title || g.title);

          list.push({
            goalId: g.id,
            goal: g,
            category: 'Learning',
            subcategory: 'Reading',
            title: g.title,
            color: '#3B82F6',
            emoji: '📖',
            timeWindowLabel: tw.label,
            isTimeWindowActive: tw.active,
            promptText: `Have you read ${targetQty} ${trackBy} today for '${materialName}'?`,
            quickActionLabel: `Yes, Read ${targetQty} ${trackBy}`,
            actionType: 'reading_log',
            suggestedQty: targetQty,
            unitLabel: trackBy,
          });
        }
      }

      // ── 8. LEARNING - COURSES ──
      else if (cat === 'learning' && subcat.includes('courses')) {
        const lessons = Array.isArray(g.courseLessons) ? (g.courseLessons as Array<{ completed?: boolean; completedAt?: string }>) : [];
        const loggedToday = lessons.some((l) => l.completed && l.completedAt?.startsWith(todayStr));

        if (!loggedToday) {
          const unitTerm = String(ans.unit_name || 'lesson').toLowerCase();
          const verb = unitTerm.includes('video') ? 'watched' : unitTerm.includes('lecture') || unitTerm.includes('session') ? 'attended' : 'completed';
          const courseTitle = String(ans.course_name || g.title);

          list.push({
            goalId: g.id,
            goal: g,
            category: 'Learning',
            subcategory: 'Courses',
            title: g.title,
            color: '#06B6D4',
            emoji: '💻',
            timeWindowLabel: 'Daily Course Unit',
            isTimeWindowActive: true,
            promptText: `Have you ${verb} today's ${unitTerm} for '${courseTitle}'?`,
            quickActionLabel: `Yes, ${verb.charAt(0).toUpperCase() + verb.slice(1)} Today's Unit`,
            actionType: 'course_unit',
          });
        }
      }

      // ── 9. HABIT - DAILY ROUTINE ──
      else if (cat === 'habit' && subcat.includes('routine')) {
        const logs = Array.isArray((g as unknown as Record<string, unknown>).routineLogs) ? ((g as unknown as Record<string, unknown>).routineLogs as Array<{ date: string }>) : [];
        const loggedToday = logs.some((l) => l.date === todayStr);

        if (!loggedToday) {
          const items = Array.isArray(g.routineItems) ? g.routineItems : [];
          const checkedCnt = items.filter((i) => (i as { completed?: boolean; checked?: boolean }).completed || (i as { checked?: boolean }).checked).length;
          const totalCnt = items.length || 1;

          list.push({
            goalId: g.id,
            goal: g,
            category: 'Habit',
            subcategory: 'Daily Routine',
            title: g.title,
            color: '#8B5CF6',
            emoji: '🎯',
            timeWindowLabel: 'Daily Routine Check',
            isTimeWindowActive: true,
            promptText: `Have you followed all routines for today (${checkedCnt}/${totalCnt} steps ready)?`,
            quickActionLabel: `Log 100% Routine Streak 🔥`,
            actionType: 'daily_routine',
          });
        }
      }
    }

    // Filter out dismissed cards and sort active time-window actions first
    return list
      .filter((item) => !dismissedCardIds[item.goalId])
      .sort((a, b) => (b.isTimeWindowActive ? 1 : 0) - (a.isTimeWindowActive ? 1 : 0));
  }, [goals, user?.uid, todayStr, isTimeWindowMatching, dismissedCardIds]);

  // Execute Quick Action directly
  const handleExecuteAction = async (item: PendingCheckItem, customValOverride?: number) => {
    if (!item.goalId || !user?.uid) return;

    setActionLoading((prev) => ({ ...prev, [item.goalId]: true }));
    try {
      const g = item.goal;
      const qty = customValOverride !== undefined ? customValOverride : (item.suggestedQty || 1);

      if (item.actionType === 'saving_deposit') {
        const nowTs = Timestamp.now();
        const txns = Array.isArray(g.transactions) ? [...g.transactions] : [];
        txns.push({ date: todayStr, amount: qty, type: 'deposit', note: 'DailyChecks Quick Deposit' });

        const newProgress = Math.min(100, Math.round(((g.progress || 0) * (g.overallTargetValue || 1) + qty) / (g.overallTargetValue || 1)));

        await updateGoal(g.id!, {
          transactions: txns,
          currentValue: (g.currentValue || 0) + qty,
          progress: newProgress,
          updatedAt: nowTs,
        });

        // Sync with Finance Total Cash Snapshot custom source
        const snapRef = doc(db, 'totalCashSnapshots', user.uid);
        const snap = await getDoc(snapRef);
        if (snap.exists()) {
          const data = snap.data();
          const customSources = typeof data?.sources?.custom === 'object' ? { ...data.sources.custom } : {};
          customSources[g.title] = (customSources[g.title] || 0) + qty;
          await updateDoc(snapRef, { 'sources.custom': customSources, updatedAt: new Date() });
        }
      } else if (item.actionType === 'reading_log') {
        const logs = Array.isArray(g.readingLogs) ? [...g.readingLogs] : [];
        logs.push({ id: String(Date.now()), date: todayStr, pagesRead: qty });

        let computedProgress = g.progress || 0;
        const totalTarget = Number(g.overallTargetValue || 0);
        if (totalTarget > 0) {
          const totalPagesRead = logs.reduce((acc, l) => acc + (l.pagesRead || 0), 0);
          computedProgress = Math.min(100, Math.round((totalPagesRead / totalTarget) * 100));
        } else {
          const boost = item.unitLabel?.includes('chapter') ? 8.66 : 3.0;
          computedProgress = Math.min(100, Math.round(computedProgress + boost));
        }

        await updateGoal(g.id!, {
          readingLogs: logs,
          currentValue: (g.currentValue || 0) + qty,
          progress: computedProgress,
          updatedAt: Timestamp.now(),
        });
      } else if (item.actionType === 'course_unit') {
        const lessons = Array.isArray(g.courseLessons) ? [...g.courseLessons] : [];
        if (lessons.length > 0) {
          const firstUndone = lessons.find((l) => !l.completed);
          if (firstUndone) {
            firstUndone.completed = true;
            firstUndone.completedAt = new Date().toISOString();
          } else {
            lessons.push({ id: String(Date.now()), title: `Unit ${lessons.length + 1}`, completed: true, completedAt: new Date().toISOString() });
          }
        } else {
          lessons.push({ id: String(Date.now()), title: 'Daily Course Unit', completed: true, completedAt: new Date().toISOString() });
        }

        const doneCnt = lessons.filter((l) => l.completed).length;
        const totalTarget = Number(g.overallTargetValue || lessons.length || 1);
        const computedProgress = Math.min(100, Math.round((doneCnt / Math.max(1, totalTarget)) * 100));

        await updateGoal(g.id!, {
          courseLessons: lessons,
          currentValue: doneCnt,
          progress: computedProgress,
          updatedAt: Timestamp.now(),
        });
      } else if (item.actionType === 'daily_routine') {
        const logs = Array.isArray((g as unknown as Record<string, unknown>).routineLogs) ? [...((g as unknown as Record<string, unknown>).routineLogs as Array<{ id: string; date: string; checkedCount: number; totalItems: number; fullStreak: boolean }>)] : [];
        const items = Array.isArray(g.routineItems) ? g.routineItems : [];
        const totalCnt = items.length || 1;

        logs.push({ id: String(Date.now()), date: todayStr, checkedCount: totalCnt, totalItems: totalCnt, fullStreak: true });

        const fullStreakDays = logs.filter((l) => l.fullStreak).length;
        const targetDays = Number(g.overallTargetValue || 30);
        const computedProgress = Math.min(100, Math.round((fullStreakDays / targetDays) * 100));

        await updateGoal(g.id!, {
          routineLogs: logs as unknown as Goal['routineLogs'],
          currentValue: fullStreakDays,
          progress: computedProgress,
          updatedAt: Timestamp.now(),
        });
      } else if (item.actionType === 'fitness_workout') {
        const exercises = Array.isArray(g.exerciseItems) ? [...g.exerciseItems] : [];
        if (exercises.length > 0) {
          const targetExIndex = exercises.findIndex(
            (e: { id?: string; name?: string }) => e.id === item.exerciseId || e.name === item.exerciseName
          );
          const exIndex = targetExIndex >= 0 ? targetExIndex : 0;
          const ex = { ...(exercises[exIndex] as { id?: string; name?: string; targetValue?: number; currentValue?: number }) };
          ex.currentValue = (ex.currentValue || 0) + qty;
          exercises[exIndex] = ex;

          // Re-calculate mean progress across all exercise items
          let sum = 0;
          for (const itemEx of exercises as Array<{ targetValue?: number; currentValue?: number }>) {
            const tVal = itemEx.targetValue || 0;
            const cVal = itemEx.currentValue || 0;
            if (tVal > 0) {
              sum += Math.max(0, Math.min(100, Math.round((cVal / tVal) * 100)));
            }
          }
          const newMeanProgress = Math.max(0, Math.min(100, Math.round(sum / exercises.length)));

          await updateGoal(g.id!, {
            exerciseItems: exercises,
            currentValue: (g.currentValue || 0) + qty,
            progress: newMeanProgress,
            updatedAt: Timestamp.now(),
          });
        }
      } else if (item.actionType === 'weight_log') {
        const logs = Array.isArray(g.weightLogs) ? [...g.weightLogs] : [];
        logs.push({ id: String(Date.now()), date: todayStr, weight: qty } as unknown as { date: string });

        await updateGoal(g.id!, {
          weightLogs: logs,
          currentValue: qty,
          updatedAt: Timestamp.now(),
        });
      } else if (item.actionType === 'sleep_log') {
        const logs = Array.isArray(g.sleepLogs) ? [...g.sleepLogs] : [];
        logs.push({ id: String(Date.now()), date: todayStr, hours: qty } as unknown as { date: string });

        await updateGoal(g.id!, {
          sleepLogs: logs,
          currentValue: qty,
          updatedAt: Timestamp.now(),
        });
      } else if (item.actionType === 'medical_action') {
        const appts = Array.isArray(g.medicalAppointments) ? [...g.medicalAppointments] : [];
        const appt = appts.find((a) => !(a as { completed?: boolean }).completed);
        if (appt) {
          (appt as { completed?: boolean }).completed = true;
        }

        await updateGoal(g.id!, {
          medicalAppointments: appts,
          updatedAt: Timestamp.now(),
        });
      } else if (item.actionType === 'nutrition_log') {
        const logs = Array.isArray(g.nutritionLogs) ? [...g.nutritionLogs] : [];
        logs.push({ id: String(Date.now()), date: todayStr, qty: qty, itemType: item.title } as unknown as { date: string });

        await updateGoal(g.id!, {
          nutritionLogs: logs,
          currentValue: (g.currentValue || 0) + qty,
          updatedAt: Timestamp.now(),
        });
      }
    } catch (err) {
      console.error('Failed to execute daily check action:', err);
    } finally {
      setActionLoading((prev) => ({ ...prev, [item.goalId]: false }));
    }
  };

  if (pendingChecks.length === 0) {
    return null; // All daily actions for active goals completed!
  }

  const currentCard = pendingChecks[Math.min(activeCardIndex, pendingChecks.length - 1)];

  return (
    <Box sx={{ width: '100%', mb: 3 }}>
      <Paper
        elevation={0}
        sx={{
          borderRadius: '24px',
          border: `1.5px solid ${currentCard.color}40`,
          bgcolor: isDark ? 'rgba(15, 23, 42, 0.75)' : '#ffffff',
          boxShadow: isDark
            ? '0 12px 32px -8px rgba(0,0,0,0.5)'
            : '0 12px 32px -8px rgba(15, 23, 42, 0.08)',
          p: { xs: 2.25, sm: 3 },
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Top Header Row */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '10px',
                bgcolor: `${currentCard.color}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
              }}
            >
              {currentCard.emoji}
            </Box>

            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 900,
                color: currentCard.color,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Daily Check ({activeCardIndex + 1} of {pendingChecks.length})
            </Typography>
          </Stack>

          {/* Time Window Badge */}
          <Stack direction="row" alignItems="center" spacing={1}>
            <Chip
              label={currentCard.timeWindowLabel}
              size="small"
              sx={{
                fontWeight: 800,
                fontSize: 10.5,
                bgcolor: currentCard.isTimeWindowActive
                  ? `${currentCard.color}18`
                  : isDark ? '#334155' : '#f1f5f9',
                color: currentCard.isTimeWindowActive ? currentCard.color : isDark ? '#94a3b8' : '#64748b',
              }}
            />

            {pendingChecks.length > 1 && (
              <Stack direction="row" spacing={0.5}>
                <IconButton
                  size="small"
                  disabled={activeCardIndex === 0}
                  onClick={() => setActiveCardIndex((prev) => Math.max(0, prev - 1))}
                  sx={{ p: 0.5 }}
                >
                  <ChevronLeft fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  disabled={activeCardIndex === pendingChecks.length - 1}
                  onClick={() => setActiveCardIndex((prev) => Math.min(pendingChecks.length - 1, prev + 1))}
                  sx={{ p: 0.5 }}
                >
                  <ChevronRight fontSize="small" />
                </IconButton>
              </Stack>
            )}
          </Stack>
        </Stack>

        {/* Prompt Body */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentCard.goalId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <Typography
              variant="h6"
              sx={{
                fontWeight: 900,
                color: isDark ? '#f1f5f9' : '#0f172a',
                fontSize: { xs: '1.05rem', sm: '1.2rem' },
                lineHeight: 1.3,
                mb: 2,
              }}
            >
              {currentCard.promptText}
            </Typography>

            {/* Quick Action Button & Custom Input Toggle */}
            <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.5}>
              <Button
                variant="contained"
                disabled={!!actionLoading[currentCard.goalId]}
                onClick={() => {
                  const custVal = customValueInputs[currentCard.goalId];
                  const numOverride = typeof custVal === 'number' ? custVal : typeof custVal === 'string' && /^\d+(\.\d+)?$/.test(custVal) ? Number(custVal) : undefined;
                  handleExecuteAction(currentCard, numOverride);
                }}
                startIcon={
                  actionLoading[currentCard.goalId] ? (
                    <CircularProgress size={16} sx={{ color: '#fff' }} />
                  ) : (
                    <CheckIcon />
                  )
                }
                sx={{
                  borderRadius: '16px',
                  bgcolor: currentCard.color,
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: 13.5,
                  px: 3,
                  py: 1.15,
                  textTransform: 'none',
                  boxShadow: `0 4px 14px ${currentCard.color}40`,
                  '&:hover': {
                    bgcolor: currentCard.color,
                    opacity: 0.9,
                  },
                }}
              >
                {currentCard.quickActionLabel}
              </Button>

              <Button
                variant="outlined"
                onClick={() => handleDismissCard(currentCard.goalId)}
                startIcon={<CloseIcon />}
                sx={{
                  borderRadius: '16px',
                  borderColor: isDark ? '#334155' : '#cbd5e1',
                  color: isDark ? '#94a3b8' : '#64748b',
                  fontWeight: 800,
                  fontSize: 13,
                  px: 2.5,
                  py: 1.15,
                  textTransform: 'none',
                  '&:hover': {
                    borderColor: isDark ? '#475569' : '#94a3b8',
                    bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc',
                  },
                }}
              >
                Not Today
              </Button>

              {/* Custom Value Toggle Input for Savings or Custom Quantities */}
              {currentCard.actionType === 'saving_deposit' || currentCard.actionType === 'weight_log' ? (
                <Stack direction="row" alignItems="center" spacing={1}>
                  {!activeCustomInputs[currentCard.goalId] ? (
                    <Button
                      size="small"
                      onClick={() => setActiveCustomInputs((prev) => ({ ...prev, [currentCard.goalId]: true }))}
                      sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12, color: currentCard.color }}
                    >
                      + Enter Custom Amount
                    </Button>
                  ) : (
                    <TextField
                      size="small"
                      placeholder={`Enter custom ${currentCard.unitLabel || 'value'}`}
                      type="number"
                      value={customValueInputs[currentCard.goalId] || ''}
                      onChange={(e) => setCustomValueInputs((prev) => ({ ...prev, [currentCard.goalId]: e.target.value }))}
                      sx={{
                        width: 170,
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '12px',
                          fontSize: 12,
                          fontWeight: 700,
                        },
                      }}
                    />
                  )}
                </Stack>
              ) : null}
            </Stack>
          </motion.div>
        </AnimatePresence>
      </Paper>
    </Box>
  );
}
