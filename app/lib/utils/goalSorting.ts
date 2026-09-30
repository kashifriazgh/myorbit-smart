import { Goal } from '../interface';

export function getGoalCreationTime(g: Goal): number {
  if (!g || !g.createdAt) return 0;
  if (g.createdAt instanceof Date) return g.createdAt.getTime();
  if (typeof (g.createdAt as { toDate?: () => Date }).toDate === 'function') {
    return (g.createdAt as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof (g.createdAt as { seconds?: number }).seconds === 'number') {
    return (g.createdAt as { seconds: number }).seconds * 1000;
  }
  const d = new Date(g.createdAt as unknown as string | number);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

/**
 * Sorts goals by priorityIndex (if set).
 * If priorityIndex is not set, automatically orders by creation date (earlier created first).
 */
export function sortGoalsByPriorityIndex(goals: Goal[]): Goal[] {
  return [...goals].sort((a, b) => {
    const hasIdxA = typeof a.priorityIndex === 'number' && !isNaN(a.priorityIndex);
    const hasIdxB = typeof b.priorityIndex === 'number' && !isNaN(b.priorityIndex);

    if (hasIdxA && hasIdxB) {
      return a.priorityIndex! - b.priorityIndex!;
    }
    if (hasIdxA) return -1;
    if (hasIdxB) return 1;

    // Fallback: automatically sort by creation date
    return getGoalCreationTime(a) - getGoalCreationTime(b);
  });
}
