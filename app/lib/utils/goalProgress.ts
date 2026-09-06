import { Goal, GoalStep, GoalStepStatus } from '../interface';

/**
 * Calculates the individual progress percentage (0–100) for a single goal step / milestone.
 */
export function getStepProgress(
  step: GoalStep,
  goal?: Goal | null,
  linkedTodos?: unknown[],
  linkedSchedules?: unknown[]
): number {
  // 1. Finance / Savings / Linked Finance Source step
  if (step.linkedType === 'finance_source' || goal?.type === 'finance') {
    const target = step.targetValue || step.targetAmount || goal?.overallTargetValue || (goal as Goal & { targetValue?: number })?.targetValue || 0;
    const current = (goal as Goal & { currentValue?: number })?.currentValue ?? step.actualValue ?? 0;
    if (target > 0) {
      return Math.min(100, Math.max(0, Math.round((current / target) * 100)));
    }
  }

  // 2. Progressive milestone with actualValue and targetValue
  if (
    step.progressMode === 'progressive' ||
    (typeof step.targetValue === 'number' && step.targetValue > 0 && typeof step.actualValue === 'number')
  ) {
    const currentVal = step.actualValue ?? 0;
    const targetVal = step.targetValue ?? 0;
    if (targetVal > 0) {
      if (step.direction === 'down') {
        return Math.min(100, Math.max(0, Math.round(((targetVal * 2 - currentVal) / targetVal) * 100)));
      }
      return Math.min(100, Math.max(0, Math.round((currentVal / targetVal) * 100)));
    }
  }

  // 3. Linked Todo
  if (step.linkedType === 'todo' && step.linkedItemId) {
    if (linkedTodos && Array.isArray(linkedTodos)) {
      const foundTodo = (linkedTodos as Array<{ id?: string; status?: string; progressPercent?: number }>).find((t) => t.id === step.linkedItemId);
      if (foundTodo) {
        if (foundTodo.status === 'completed' || foundTodo.progressPercent === 100) return 100;
        return typeof foundTodo.progressPercent === 'number' ? foundTodo.progressPercent : 0;
      }
    }
  }

  // 4. Linked Schedule
  if (step.linkedType === 'schedule' && step.linkedItemId) {
    if (linkedSchedules && Array.isArray(linkedSchedules)) {
      const foundSched = (linkedSchedules as Array<{ id?: string; status?: string }>).find((s) => s.id === step.linkedItemId);
      if (foundSched) {
        return foundSched.status === 'completed' ? 100 : 0;
      }
    }
  }

  // 5. Binary or fallback step status
  if (step.status === GoalStepStatus.COMPLETED || (step.status as string) === 'completed' || step.closed) {
    return 100;
  }

  return 0;
}

export interface ExpenseProgressItem {
  currentValue?: number;
  targetValue?: number;
  initialValue?: number;
  actionType?: string;
}

/**
 * Calculates item progress for an expense milestone item (0–100%).
 */
export function getExpenseItemProgress(item?: ExpenseProgressItem | null): number {
  if (!item) return 0;
  const current = typeof item.currentValue === 'number' ? item.currentValue : 0;
  const target = typeof item.targetValue === 'number' ? item.targetValue : 0;
  const initial = typeof item.initialValue === 'number' ? item.initialValue : (current > 0 ? current : 1);
  const actionType = item.actionType || (target === 0 ? 'eliminate' : 'reduce');

  if (actionType === 'eliminate' || target === 0) {
    if (current <= 0) return 100;
    if (initial <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round(((initial - current) / initial) * 100)));
  }

  // Reduce action (target > 0)
  if (current <= target) return 100;
  if (current >= initial) return 0;
  const reductionSpan = initial - target;
  if (reductionSpan <= 0) return 100;
  const achievedReduction = initial - current;
  return Math.max(0, Math.min(100, Math.round((achievedReduction / reductionSpan) * 100)));
}

/**
 * Calculates the overall goal progress percentage (0–100).
 * - If there are expense items, returns the mean (average) of all expense item progress values.
 * - If there are 1 or more milestones (steps), returns the mean (average) of all milestone progress values.
 * - If there is only 1 milestone, overall progress equals that milestone's progress.
 * - If there are 0 milestones, computes based on overall target / current value or goal.progress.
 */
export function calculateGoalOverallProgress(
  goal: Goal | null | undefined,
  linkedTodos?: unknown[],
  linkedSchedules?: unknown[]
): number {
  if (!goal) return 0;

  // Check if debtRecords exist
  if (Array.isArray(goal.debtRecords) && goal.debtRecords.length > 0) {
    let sum = 0;
    for (const item of goal.debtRecords as Array<{ paidAmount?: number; amount?: number }>) {
      const paid = typeof item.paidAmount === 'number' ? item.paidAmount : 0;
      const total = typeof item.amount === 'number' ? item.amount : 0;
      if (total > 0) {
        sum += Math.max(0, Math.min(100, Math.round((paid / total) * 100)));
      }
    }
    return Math.max(0, Math.min(100, Math.round(sum / goal.debtRecords.length)));
  }

  // Check if incomeSources exist
  if (Array.isArray(goal.incomeSources) && goal.incomeSources.length > 0) {
    let sum = 0;
    for (const item of goal.incomeSources as Array<{ currentAmount?: number; targetAmount?: number }>) {
      const current = typeof item.currentAmount === 'number' ? item.currentAmount : 0;
      const target = typeof item.targetAmount === 'number' ? item.targetAmount : 0;
      if (target > 0) {
        sum += Math.max(0, Math.min(100, Math.round((current / target) * 100)));
      }
    }
    return Math.max(0, Math.min(100, Math.round(sum / goal.incomeSources.length)));
  }

  // Check if expenseItems exist
  if (Array.isArray(goal.expenseItems) && goal.expenseItems.length > 0) {
    let sum = 0;
    for (const item of goal.expenseItems as ExpenseProgressItem[]) {
      sum += getExpenseItemProgress(item);
    }
    return Math.max(0, Math.min(100, Math.round(sum / goal.expenseItems.length)));
  }

  const steps = goal.steps || [];

  if (steps.length > 0) {
    let sumProgress = 0;
    for (const step of steps) {
      sumProgress += getStepProgress(step, goal, linkedTodos, linkedSchedules);
    }
    return Math.min(100, Math.max(0, Math.round(sumProgress / steps.length)));
  }

  // Fallback if no steps exist
  const target = goal.overallTargetValue || (goal as Goal & { targetValue?: number }).targetValue || 0;
  const current = (goal as Goal & { currentValue?: number }).currentValue ?? 0;
  if (target > 0) {
    return Math.min(100, Math.max(0, Math.round((current / target) * 100)));
  }

  return Math.min(100, Math.max(0, goal.progress ?? 0));
}
