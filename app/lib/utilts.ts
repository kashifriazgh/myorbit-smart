export function formatCurrency(
  amount: number,
  currency: 'PKR' | 'USD'
): string {
  if (currency === 'USD') {
    return `$${amount.toFixed(2)}`; // supports cents
  }

  // Default is PKR
  return `Rs ${amount.toLocaleString('en-PK', {
    maximumFractionDigits: 0,
  })}`;
}

export function toDateSafe(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const v = value as { seconds: number; nanoseconds?: number };
    return new Date(v.seconds * 1000 + (v.nanoseconds || 0) / 1000000);
  }
  const d = new Date(value as string | number);
  return isNaN(d.getTime()) ? null : d;
}

// lib/utils/timeAnalysis.ts

export function extractHoursAndDaysFromTimestamps(timestamps: Date[]) {
  const hoursMap = new Map<number, number>();
  const daysMap = new Map<number, number>();

  timestamps.forEach((date) => {
    const hour = date.getHours(); // 0 to 23
    const day = date.getDay(); // 0 (Sun) to 6 (Sat)

    hoursMap.set(hour, (hoursMap.get(hour) || 0) + 1);
    daysMap.set(day, (daysMap.get(day) || 0) + 1);
  });

  const mostFrequent = (map: Map<number, number>) => {
    const entries = Array.from(map.entries());
    const maxCount = Math.max(...entries.map(([, count]) => count));
    return entries
      .filter(([, count]) => count === maxCount)
      .map(([key]) => key);
  };

  return {
    hourFrequency: hoursMap,
    dayFrequency: daysMap,
    mostFocusedHours: mostFrequent(hoursMap),
    mostFocusedDays: mostFrequent(daysMap),
  };
}

export const weekdayMap = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

// log focus time
import { doc, runTransaction, updateDoc, increment } from 'firebase/firestore';
import { db } from './firebase';
import moment from 'moment-timezone';

export const logFocusTime = async (userId: string) => {
  const now = moment().tz('Asia/Karachi');
  const minute = now.minute();
  let hour = now.hour();
  if (minute >= 40) hour = (hour + 1) % 24;

  const docRef = doc(db, 'pmc', userId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);

    if (!snap.exists()) {
      const focusTimeInit: Record<number, number> = {};
      for (let i = 0; i < 24; i++) {
        focusTimeInit[i] = 0;
      }
      focusTimeInit[hour] = 1; // First increment
      transaction.set(docRef, { focusTime: focusTimeInit });
    } else {
      const data = snap.data();
      const currentCount = data.focusTime?.[hour] || 0;
      transaction.update(docRef, {
        [`focusTime.${hour}`]: currentCount + 1,
      });
    }
  });
};

export function sanitizeObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (typeof obj === 'object') {
    // Check if it's a Date, Timestamp, or FieldValue
    if (obj instanceof Date) return obj;
    
    // For Firestore Timestamps and FieldValues (sentinels)
    // They usually have a custom constructor or specific method
    const constructorName = obj.constructor?.name;
    if (constructorName === 'Timestamp' || constructorName === 'FieldValueImpl' || constructorName === 'FieldValue') {
      return obj;
    }

    // Also check for toDate method which Timestamps have
    if ('toDate' in obj && typeof (obj as { toDate: unknown }).toDate === 'function') {
      return obj;
    }
    
    const out: Record<string, unknown> = {};
    const objAsRecord = obj as Record<string, unknown>;
    Object.keys(objAsRecord).forEach((k) => {
      const v = objAsRecord[k];
      if (v === undefined) return; // skip undefined fields
      out[k] = sanitizeObject(v);
    });
    return out;
  }
  return obj;
}

export const incrementTodoRescheduleCount = async (taskId: string): Promise<void> => {
  try {
    const todoRef = doc(db, 'todos', taskId);
    await updateDoc(todoRef, {
      rescheduleCounts: increment(1),
    });
    console.log(`Successfully incremented rescheduleCounts for task ${taskId}`);
  } catch (error) {
    console.error('Error incrementing rescheduleCounts:', error);
  }
};

export interface TaskMetricsInput {
  createdAt: unknown;
  dueDate?: unknown;
  rescheduleCounts?: number;
  totalSteps?: number;
  completedSteps?: number;
  progress?: number;
  progressPercent?: number;
  status?: string;
  steps?: Array<{
    done?: boolean;
    status?: string;
  }>;
}

export interface TaskMetrics {
  pace: 'Ahead' | 'On Track' | 'Behind' | 'Overdue' | null;
  rescheduleStatus: 'Stable' | 'Minor Slippage' | 'Frequently Delayed' | 'Chronically Postponed';
  progress: number;
  progressLabel: 'Not Started' | 'Early Progress' | 'In Progress' | 'Almost Done' | 'Completed';
  staleness: 'Fresh' | 'Aging' | 'Stale' | 'Needs Review' | null;
}

export function getTaskMetrics(task: TaskMetricsInput): TaskMetrics {
  const now = new Date();
  const createdDate = toDateSafe(task.createdAt) || now;
  const dueDate = toDateSafe(task.dueDate);

  // 1. Calculate progress percent
  let progress = 0;
  if (task.totalSteps !== undefined && task.completedSteps !== undefined && task.totalSteps > 0) {
    progress = (task.completedSteps / task.totalSteps) * 100;
  } else if (task.steps && task.steps.length > 0) {
    const total = task.steps.length;
    const completed = task.steps.filter(s => s.done || s.status === 'completed').length;
    progress = (completed / total) * 100;
  } else if (task.progress !== undefined) {
    progress = task.progress;
  } else if (task.progressPercent !== undefined) {
    progress = task.progressPercent;
  } else if (task.status === 'completed') {
    progress = 100;
  }
  // Clamp progress to [0, 100] and round to nearest integer
  progress = Math.max(0, Math.min(100, Math.round(progress)));

  // 2. Determine progress label
  let progressLabel: TaskMetrics['progressLabel'];
  if (progress === 0) {
    progressLabel = 'Not Started';
  } else if (progress <= 40) {
    progressLabel = 'Early Progress';
  } else if (progress <= 80) {
    progressLabel = 'In Progress';
  } else if (progress <= 99) {
    progressLabel = 'Almost Done';
  } else {
    progressLabel = 'Completed';
  }

  // 3. Calculate pace
  let pace: TaskMetrics['pace'] = null;
  if (dueDate) {
    if (now.getTime() > dueDate.getTime()) {
      pace = 'Overdue';
    } else {
      const totalTime = dueDate.getTime() - createdDate.getTime();
      if (totalTime <= 0) {
        pace = 'On Track';
      } else {
        const elapsedTime = Math.max(0, now.getTime() - createdDate.getTime());
        const elapsedPercent = (elapsedTime / totalTime) * 100;
        const diff = progress - elapsedPercent;
        if (diff > 10) {
          pace = 'Ahead';
        } else if (diff < -10) {
          pace = 'Behind';
        } else {
          pace = 'On Track';
        }
      }
    }
  }

  // 4. Calculate reschedule status
  const rescheduleCounts = task.rescheduleCounts || 0;
  let rescheduleStatus: TaskMetrics['rescheduleStatus'];
  if (rescheduleCounts === 0) {
    rescheduleStatus = 'Stable';
  } else if (rescheduleCounts <= 2) {
    rescheduleStatus = 'Minor Slippage';
  } else if (rescheduleCounts <= 4) {
    rescheduleStatus = 'Frequently Delayed';
  } else {
    rescheduleStatus = 'Chronically Postponed';
  }

  // 5. Calculate staleness
  let staleness: TaskMetrics['staleness'] = null;
  if (!dueDate) {
    const diffTime = Math.max(0, now.getTime() - createdDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays <= 3) {
      staleness = 'Fresh';
    } else if (diffDays <= 7) {
      staleness = 'Aging';
    } else if (diffDays <= 14) {
      staleness = 'Stale';
    } else {
      staleness = 'Needs Review';
    }
  }

  return {
    progress,
    progressLabel,
    pace,
    rescheduleStatus,
    staleness,
  };
}

export interface TodoAggregateStats {
  totalActive: number;
  totalCompleted: number;
  completionRate: number;
  averageProgress: number;
  paceDistribution: {
    Ahead: number;
    OnTrack: number;
    Behind: number;
    Overdue: number;
    noDueDate: number;
  };
  rescheduleDistribution: {
    Stable: number;
    MinorSlippage: number;
    FrequentlyDelayed: number;
    ChronicallyPostponed: number;
  };
  stalenessDistribution: {
    Fresh: number;
    Aging: number;
    Stale: number;
    NeedsReview: number;
    withDueDate: number;
  };
  trendStatement: string;
}

export function generateTodoAnalysisSummary(
  activeTasks: TaskMetricsInput[],
  completedCount: number
): TodoAggregateStats {
  const totalActive = activeTasks.length;
  const totalTasks = totalActive + completedCount;
  const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  let totalProgress = 0;
  const paceDistribution = { Ahead: 0, OnTrack: 0, Behind: 0, Overdue: 0, noDueDate: 0 };
  const rescheduleDistribution = { Stable: 0, MinorSlippage: 0, FrequentlyDelayed: 0, ChronicallyPostponed: 0 };
  const stalenessDistribution = { Fresh: 0, Aging: 0, Stale: 0, NeedsReview: 0, withDueDate: 0 };

  activeTasks.forEach(task => {
    const metrics = getTaskMetrics(task);
    totalProgress += metrics.progress;

    if (metrics.pace === 'Ahead') paceDistribution.Ahead++;
    else if (metrics.pace === 'On Track') paceDistribution.OnTrack++;
    else if (metrics.pace === 'Behind') paceDistribution.Behind++;
    else if (metrics.pace === 'Overdue') paceDistribution.Overdue++;
    else paceDistribution.noDueDate++;

    if (metrics.rescheduleStatus === 'Stable') rescheduleDistribution.Stable++;
    else if (metrics.rescheduleStatus === 'Minor Slippage') rescheduleDistribution.MinorSlippage++;
    else if (metrics.rescheduleStatus === 'Frequently Delayed') rescheduleDistribution.FrequentlyDelayed++;
    else rescheduleDistribution.ChronicallyPostponed++;

    if (metrics.staleness === 'Fresh') stalenessDistribution.Fresh++;
    else if (metrics.staleness === 'Aging') stalenessDistribution.Aging++;
    else if (metrics.staleness === 'Stale') stalenessDistribution.Stale++;
    else if (metrics.staleness === 'Needs Review') stalenessDistribution.NeedsReview++;
    else stalenessDistribution.withDueDate++;
  });

  const averageProgress = totalActive > 0 ? Math.round(totalProgress / totalActive) : 0;

  // Compile trend Statement
  let trendStatement = '';
  if (totalActive === 0) {
    trendStatement = "All tasks are completed! You have zero active tasks left, reflecting maximum efficiency and complete closure of your plans.";
  } else {
    const overdueOrBehind = paceDistribution.Overdue + paceDistribution.Behind;
    const delayedOrPostponed = rescheduleDistribution.FrequentlyDelayed + rescheduleDistribution.ChronicallyPostponed;
    const staleOrReview = stalenessDistribution.Stale + stalenessDistribution.NeedsReview;

    if (overdueOrBehind > totalActive * 0.4) {
      trendStatement = `Falling Behind: ${Math.round((overdueOrBehind / totalActive) * 100)}% of your active tasks are overdue or lagging behind schedule. Consider prioritizing urgent tasks or trimming down deliverables.`;
    } else if (delayedOrPostponed > totalActive * 0.35) {
      trendStatement = `Planning Friction: Frequent rescheduling suggests that you are encountering bottlenecks or overestimating daily capacity. Try breaking tasks into smaller steps.`;
    } else if (staleOrReview > totalActive * 0.4) {
      trendStatement = `Stagnant Phase: Nearly half of your tasks have been sitting idle without progress for over a week. A review and cleanup of stale plans is highly recommended.`;
    } else if (paceDistribution.Ahead > totalActive * 0.3) {
      trendStatement = `Strong Momentum: You are highly proactive! A significant portion of your active tasks are ahead of schedule with an average active progress of ${averageProgress}%.`;
    } else if (completionRate >= 70 && averageProgress > 50) {
      trendStatement = `Highly Consistent: Excellent trajectory. With a ${completionRate}% task completion rate and steady progress on remaining items, you are moving forward smoothly.`;
    } else {
      trendStatement = `Steady & Balanced: Your workflow is stable. Tasks are moving forward with a healthy average progress of ${averageProgress}%, and rescheduling remains under control.`;
    }
  }

  return {
    totalActive,
    totalCompleted: completedCount,
    completionRate,
    averageProgress,
    paceDistribution,
    rescheduleDistribution,
    stalenessDistribution,
    trendStatement,
  };
}

// Configurable threshold constants for daily schedule workload duration
const THRESHOLD_LIGHT = 90;      // <90min = Light
const THRESHOLD_BALANCED = 180;  // 90-180min = Balanced
const THRESHOLD_BUSY = 300;      // 181-300min = Busy

export interface WeeklyBreakdownItem {
  weekIndex: number; // 1 to 4
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  avgScheduleCount: number;
  avgDuration: number;
  loadLabel: 'Light' | 'Balanced' | 'Busy' | 'Overloaded';
}

export interface PreferredTimeSpan {
  preferredSpan: 'Morning' | 'Afternoon' | 'Evening' | 'Night';
  breakdown: {
    Morning: number;
    Afternoon: number;
    Evening: number;
    Night: number;
  };
}

export interface ScheduleMetrics {
  dailyAverageCount: number;
  dailyAverageDuration: number;
  weeklyBreakdown: WeeklyBreakdownItem[];
  preferredTimeSpan: PreferredTimeSpan;
}

export function getScheduleMetrics(schedules: Array<{
  date: string;
  isFlexible?: boolean;
  startTime: string;
  endTime: string;
  duration?: number;
  status: string;
  createdAt?: unknown;
}>): ScheduleMetrics {
  const now = new Date();
  
  // 30 days window boundaries
  const startOfWindow = new Date(now);
  startOfWindow.setDate(now.getDate() - 29);
  startOfWindow.setHours(0, 0, 0, 0);
  
  const endOfWindow = new Date(now);
  endOfWindow.setHours(23, 59, 59, 999);

  // Helper to parse "HH:mm" to minutes
  const parseTimeToMinutes = (timeStr: string): number | null => {
    if (!timeStr) return null;
    const parts = timeStr.split(':');
    if (parts.length !== 2) return null;
    const hrs = parseInt(parts[0], 10);
    const mins = parseInt(parts[1], 10);
    if (isNaN(hrs) || isNaN(mins)) return null;
    return hrs * 60 + mins;
  };

  // Helper to calculate duration of a schedule
  const getDuration = (s: { duration?: number; startTime: string; endTime: string }): number => {
    if (s.duration !== undefined && typeof s.duration === 'number' && s.duration > 0) {
      return s.duration;
    }
    if (s.startTime && s.endTime) {
      const startMins = parseTimeToMinutes(s.startTime);
      const endMins = parseTimeToMinutes(s.endTime);
      if (startMins !== null && endMins !== null) {
        let diff = endMins - startMins;
        if (diff < 0) diff += 24 * 60; // Overnight wrap-around
        if (diff > 0) return diff;
      }
    }
    return 30; // Default to 30 minutes
  };

  // Filter schedules that are active and not cancelled in the 30-day window
  const activeSchedules = schedules.filter(s => s.status !== 'cancelled');
  
  const schedulesInWindow = activeSchedules.filter(s => {
    if (s.isFlexible) {
      const createdDate = toDateSafe(s.createdAt) || now;
      return createdDate <= endOfWindow;
    } else {
      if (!s.date) return false;
      const sDate = new Date(s.date);
      return sDate >= startOfWindow && sDate <= endOfWindow;
    }
  });

  // Calculate dailyAverageCount and dailyAverageDuration
  let totalCount = 0;
  let totalDuration = 0;

  schedulesInWindow.forEach(s => {
    const duration = getDuration(s);
    totalCount += 1;
    totalDuration += duration;
  });

  const dailyAverageCount = parseFloat((totalCount / 30).toFixed(2));
  const dailyAverageDuration = parseFloat((totalDuration / 30).toFixed(1));

  // Weekly breakdown (4 weeks of 7 days)
  const weeklyBreakdown: WeeklyBreakdownItem[] = [];
  
  for (let w = 0; w < 4; w++) {
    const weekIndex = w + 1;
    const endOffsetDays = (4 - weekIndex) * 7;
    const startOffsetDays = endOffsetDays + 6;

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - startOffsetDays);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() - endOffsetDays);
    endOfWeek.setHours(23, 59, 59, 999);

    let weekCount = 0;
    let weekDuration = 0;

    schedulesInWindow.forEach(s => {
      const duration = getDuration(s);
      if (s.isFlexible) {
        const createdDate = toDateSafe(s.createdAt) || now;
        if (createdDate <= endOfWeek) {
          weekCount += 1;
          weekDuration += duration;
        }
      } else {
        const sDate = new Date(s.date);
        if (sDate >= startOfWeek && sDate <= endOfWeek) {
          weekCount += 1;
          weekDuration += duration;
        }
      }
    });

    const avgScheduleCount = parseFloat((weekCount / 7).toFixed(2));
    const avgDuration = parseFloat((weekDuration / 7).toFixed(1));

    let loadLabel: WeeklyBreakdownItem['loadLabel'] = 'Light';
    if (avgDuration < THRESHOLD_LIGHT) {
      loadLabel = 'Light';
    } else if (avgDuration <= THRESHOLD_BALANCED) {
      loadLabel = 'Balanced';
    } else if (avgDuration <= THRESHOLD_BUSY) {
      loadLabel = 'Busy';
    } else {
      loadLabel = 'Overloaded';
    }

    weeklyBreakdown.push({
      weekIndex,
      startDate: startOfWeek.toISOString().split('T')[0],
      endDate: endOfWeek.toISOString().split('T')[0],
      avgScheduleCount,
      avgDuration,
      loadLabel,
    });
  }

  // Preferred time span analysis
  const timeCounts = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };
  
  schedulesInWindow.forEach(s => {
    if (s.startTime) {
      const parts = s.startTime.split(':');
      if (parts.length > 0) {
        const hr = parseInt(parts[0], 10);
        if (!isNaN(hr)) {
          if (hr >= 5 && hr < 12) {
            timeCounts.Morning++;
          } else if (hr >= 12 && hr < 17) {
            timeCounts.Afternoon++;
          } else if (hr >= 17 && hr < 21) {
            timeCounts.Evening++;
          } else {
            timeCounts.Night++;
          }
        }
      }
    }
  });

  let preferredSpan: PreferredTimeSpan['preferredSpan'] = 'Morning';
  let maxCount = -1;
  Object.entries(timeCounts).forEach(([span, count]) => {
    if (count > maxCount) {
      maxCount = count;
      preferredSpan = span as PreferredTimeSpan['preferredSpan'];
    }
  });

  return {
    dailyAverageCount,
    dailyAverageDuration,
    weeklyBreakdown,
    preferredTimeSpan: {
      preferredSpan,
      breakdown: timeCounts,
    },
  };
}
