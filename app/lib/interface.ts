import { Timestamp } from 'firebase/firestore';

export interface IdeaHistory {
  updatedAt: Date;
  changes: string[];
  by: string; // userId or 'AI'
}

export interface Idea {
  id?: string;
  // Authorship & Sharing
  authorId: string;
  authorName?: string;
  authorizedUsers?: string[];
  createdBy?: string;
  sharedWith?: string[];
  privacy?: string;
  // Core Content
  text: string;
  localCreatedAt?: {
    seconds: number;
    nanoseconds: number;
  };
  aiTitle?: string;
  description?: string;
  tags?: string[];
  category?: string; // e.g., productivity, health, etc.
  level?: 'general' | 'super' | 'critical';
  // AI Enhancement
  improvedByAI?: boolean;
  aiModel?: 'Gemini' | 'GPT' | string;
  aiConfidence?: number; // 0–100
  enhancedAt?: Date;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  // Status & Meta
  pinned?: boolean;
  isArchived?: boolean;
  favoritedBy?: string[];
  lastViewedAt?: Date;
  // Context
  sourceType?: 'personal' | 'external' | 'ai_generated';
  language?: string; // e.g. 'en', 'ur'
  // Utility
  relatedLinks?: string[];
  color?: string; // for UI color coding, like "#E3F2FD"
  status?: 'draft' | 'reviewed' | 'published';
  priority?: 1 | 2 | 3 | 4 | 5;
  // Versioning & Log
  history?: IdeaHistory[];
  sharedVia?: string[]; // e.g., ['email', 'whatsapp']
}

export type StepStatus = 'completed' | 'in_progress' | 'hold' | 'left-over';

export interface SubStep {
  text: string;
  description: string;
  done: boolean;
  status: StepStatus;
}

export interface ToDoStep {
  text: string;
  description: string;
  done: boolean;
  status: StepStatus;
  subSteps?: SubStep[];
  assignee?: string;
  dueDate?: Timestamp | Date;
  weightPercent?: number; // 0–100, optional weighting for progress
  precedence?: 'routine' | 'urgent' | 'critical';
}

export interface Todo {
  id?: string;
  title: string;
  description?: string;
  tags?: string[];
  isImportant?: boolean;
  priority: 'routine' | 'urgent' | 'critical';
  status: 'in_progress' | 'completed' | 'hold' | 'left-over';
  // Indicates user has actively started working on the task (UI highlight)
  workStarted?: boolean;
  progressPercent: number; // 0–100
  pinned?: boolean;
  isArchived?: boolean;
  // Ownership & Sharing
  authorId: string;
  authorName?: string;
  assignedUsers: string[]; // users responsible (max 5)
  sharedWith?: string[]; // users who can view/edit
  assignee?: string; // optional primary assignee for the whole task
  // Checklist (subtasks)
  steps?: {
    text: string;
    description: string;
    done: boolean;
    status: 'in_progress' | 'completed' | 'hold' | 'left-over';
    assignee?: string;
    dueDate?: Timestamp | Date;
    weightPercent?: number;
    precedence?: 'routine' | 'urgent' | 'critical';
    subSteps?: {
      text: string;
      description: string;
      done: boolean;
      status: 'in_progress' | 'completed' | 'hold' | 'left-over';
    }[];
  }[];
  privacy?: 'private' | 'public' | 'specific';
  // Dates
  startDate?: Date;
  dueDate?: Timestamp | Date; // 👈 Allow both types

  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  reminderDate?: Date;

  // Extras
  notes?: string;
  relatedLinks?: string[];
  // Optional AI support
  improvedByAI?: boolean;
  aiSummary?: string;
  aiPrioritySuggestion?: 'low' | 'medium' | 'high' | 'critical';
  aiConfidence?: number; // 0.0 – 1.0
  // Activity log (optional)
  history?: {
    updatedAt: Date;
    changes: string[];
    by: string;
  }[];
}

export interface JournalEntry {
  id?: string;

  // Auth
  userId: string;
  authorName?: string;
  sharedWith?: string[]; // users who can view/edit

  // Mood
  mood?: {
    type: 'happy' | 'loving' | 'sad' | 'heart-broken' | 'angry';
    level: number; // 1–10
  };

  // Core Content
  title: string;
  content: string;
  productivityOfTheDay?: string; // Summary sentence or reflection
  promptAnswers?: {
    promptId: string;
    question: string;
    answer: string;
  }[];

  tags?: string[];
  privacy: 'private' | 'public';

  // AI Enhancement (optional)
  aiSummary?: string;
  aiMoodAnalysis?: 'positive' | 'neutral' | 'negative';
  aiCategory?: string[];
  aiScore?: number; // 0–100

  // UX Flags
  pinned?: boolean;
  isFavorite?: boolean;
  isArchived?: boolean;

  // Date info for querying & stats
  date: string; // 'YYYY-MM-DD'
  month: string; // 'YYYY-MM'
  week: number; // ISO week number
  year: number;

  // Timestamps
  createdAt: Timestamp | Date;
  updatedAt: Date;
}

export interface ProcedureStep {
  id: string;
  title: string;
  status: 'pending' | 'complete' | 'skipped' | 'blocked';
  urgency: 'low' | 'medium' | 'high';
  importance?: 'low' | 'medium' | 'high' | 'critical';
  note?: string;
  dependsOn?: string[]; // other step IDs
}

export interface Procedure {
  id?: string;
  // Meta
  title: string;
  description?: string;
  authorId: string;
  authorName?: string;
  sharedWith?: string[]; // Max 5 user UIDs
  // Status & Timeline
  status: 'not_started' | 'in_progress' | 'completed' | 'cancelled';
  currentActiveStatus: 'idle' | 'working' | 'paused' | 'waiting' | 'review'; // Custom UI status
  progressPercent: number;
  startDate?: Date;
  dueDate?: Date;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Content
  steps: ProcedureStep[];
  notes?: string;
  tags?: string[];
  pinned?: boolean;
  isArchived?: boolean;
  // AI Enhancement (Optional)
  aiInsights?: string;
  aiScore?: number; // 0–100
  // UI Helpers (Optional)
  highlightStepId?: string; // to mark currently viewed/selected step
}

export interface Theme {
  name: string;
  primary: string;
  secondary: string;
  mode: 'light' | 'dark';
  userId?: string;
}

export interface FirestoreUser {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'master' | 'editor' | 'viewer' | 'guest';
  createdAt: Timestamp; // or use `Timestamp` from Firestore
  isGuest?: boolean; // Optional flag to identify guest users
}

// Finance
export interface BudgetSettings {
  userId: string;
  budgetStartDay: number; // 1–31
  currencySymbol?: string; // optional: 'Rs', '$', etc.
  createdAt: Date;
  updatedAt: Date;
}

// Import the shared type if it's defined elsewhere

export interface TotalCashSnapshot {
  id?: string;
  userId: string;

  // dynamic mapping of sources
  sources: {
    in_hand: number;
    easypaisa: number;
    jazzcash: number;
    other: number;
    bank: { [bankName: string]: number }; // 👈 nested object for banks
    custom: { [customName: string]: number }; // 👈 nested object for custom payment heads
  };

  totalAmount: number;
  freezeAmount: number;

  note?: string;
  effectiveDate?: Date | Timestamp;
  isFreezed?: boolean;

  createdAt: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

export interface Bank {
  id?: string;
  userId: string;
  name: string;
  createdAt: Date | Timestamp;
}

export interface CustomPaymentHead {
  id?: string;
  userId: string;
  name: string;
  createdAt: Date | Timestamp;
}

export type TransactionType =
  | 'add'
  | 'deduct'
  | 'freeze_transfer'
  | 'borrow'
  | 'lend';
export type TransactionSource =
  | 'in_hand'
  | 'bank'
  | 'easypaisa'
  | 'jazzcash'
  | 'other'
  | 'custom';
export type TransactionCategory =
  | 'income'
  | 'expenditure'
  | 'shopping'
  | 'manual'
  | 'transfer'
  | 'loan';

export interface CashTransaction {
  id?: string;
  userId: string;
  amount: number;
  type: TransactionType;
  source: TransactionSource;
  category: TransactionCategory;
  note?: string;
  referenceId?: string;
  bankId?: string;
  BankName?: string;
  customPaymentHeadId?: string;
  customPaymentHeadName?: string;
  createdAt: Date | Timestamp;
}
export interface LoanRecord {
  id?: string;
  userId: string;
  amount: number;
  type: 'borrow' | 'lend'; // perspective of the user
  counterparty: string; // name/identifier of the person
  dueDate?: Date | Timestamp;
  note?: string;
  isSettled: boolean;
  createdAt: Date | Timestamp;
}
export interface IncomeSource {
  id?: string;
  userId: string;
  title: string;
  type: 'one-time' | 'recurring';
  frequency: 'monthly' | 'weekly' | 'daily' | 'one_time';
  amount: number;
  expectedDate?: Date | Timestamp;
  effectiveFromDate?: Date | Timestamp; // <-- NEW: when recurring income should start
  dayOfWeek?: number; // 0 = Sunday, 6 = Saturday
  dayOfMonth?: number; // 1 - 30
  isReceived?: boolean;
  lastReceivedDate?: Date | Timestamp; // <-- NEW: track when last marked received
  paymentHistory?: { date: Date | Timestamp; amount: number }[]; // <-- NEW: track all payments
  category?: string;
  notes?: string;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

export interface Expenditure {
  id?: string;
  userId: string;
  title: string;
  type: 'one-time' | 'recurring';
  frequency: 'monthly' | 'weekly' | 'daily' | 'one_time';
  amount: number;
  dueDate?: Date | Timestamp;
  effectiveFromDate?: Date | Timestamp; // <-- NEW: when recurring expenditure should start
  isPaid?: boolean;
  dayOfWeek?: number; // 0 = Sunday, 6 = Saturday
  dayOfMonth?: number; // 1 - 30
  lastPaidDate?: Date | Timestamp; // <-- NEW: track when last marked received
  paymentHistory?: { date: Date | Timestamp; amount: number }[]; // <-- NEW: track all payments
  category?: string;
  notes?: string;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

export interface BuyItem {
  id?: string;
  userId: string;
  title: string; // Title of the shopping plan (e.g., "Eid Shopping")
  items: {
    estimatedPrice: number;
    purchasedPrice?: number;
    title: string;
    isPurchased: boolean;
    priority?: 'optional' | 'needed' | 'urgent';
    notes?: string;
  }[];
  archived: boolean;
  pinned: boolean;
  sharedWith: string[];
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  budgetLimit: number;
}

export interface PriceComparisonEntry {
  id?: string;
  userId: string;
  productName: string;
  shopEntries: {
    shopName: string;
    quotedPrice: number;
    location?: string;
    comment?: string;
    addedAt: Date;
  }[];
  bestPriceIndex?: number; // index of lowest price in shopEntries
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface FinanceSummary {
  id?: string;
  userId: string;
  period: {
    start: Date;
    end: Date;
  };
  totalEarned: number;
  totalSpent: number;
  totalSaved: number;
  donations?: number;
  extraIncome?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface PlannedVsActualComparison {
  id?: string;
  userId: string;
  month: string; // '2025-07'
  plannedIncome: number;
  actualIncome: number;
  plannedExpenses: number;
  actualExpenses: number;
  savingsGoal?: number;
  actualSavings?: number;
  overspent?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface AiFinanceInsight {
  id?: string;
  userId: string;
  month: string; // e.g., '2025-07'
  aiSummary: string; // overall insight
  spendingSuggestions: string[];
  riskAlerts?: string[]; // e.g., "You are overspending on food"
  savingTips?: string[];
  aiConfidence?: number; // 0–100
  modelUsed?: 'GPT' | 'Gemini' | string;
  createdAt: Date | Timestamp;
}

// pmc - Productivity Monitoring Cell
export interface PMC {
  id?: string; // e.g. "uid_2025-07-14"
  userId: string;
  date: string; // 'YYYY-MM-DD'

  // 🔹 New focusTime field (0–23 hours)
  focusTime?: {
    [hour: number]: number; // key: hour (0–23), value: count of events
  };

  moodSummary?: {
    averageMoodLevel: number;
    dominantMood:
      | 'happy'
      | 'loving'
      | 'sad'
      | 'angry'
      | 'neutral'
      | 'heart-broken';
    lastMoodTimestamp?: Date;
    moodChangeFromYesterday?: number;
  };

  priorityAlignment?: {
    totalTasks: number;
    highPriorityTasks: number;
    highPriorityTasksCompletedOnTime: number;
    percentageAligned?: number;
    appUsageScore?: number;
  };

  focusMoments?: {
    focusAnswers?: string[];
    mostActiveHours: string[];
  };

  satisfactionScore: {
    questionnaireAnswer?: string;
    score?: number;
    trendFromYesterday?: number;
  };

  productivityScore?: {
    questionnaireAnswer?: string;
    tasksCompleted: number;
    goalsCompleted?: number;
    ideasImplemented?: number;
    score?: number;
  };

  streaks?: {
    currentStreak: number;
    longestStreak: number;
    lastActive: Date;
    contributingActions: {
      ideasCreated: number;
      tasksCreated: number;
      journalsWritten: number;
    };
  };

  financeOverview?: {
    totalEarned: number;
    totalSpent: number;
    netBalance: number;
    status: 'stable' | 'overspending' | 'saving';
    breakdown?: {
      incomeSourcesCount: number;
      expenditureItemsCount: number;
      shoppingTotal: number;
      recurringExpenses: number;
      oneTimeExpenses: number;
    };
    aiInsight?: {
      summary: string;
      savingTips?: string[];
      overspendingAlerts?: string[];
      confidence?: number;
    };
  };

  mostProductiveDay?: {
    date: string; // e.g., "2025-07-17"
    weekday: string; // e.g., "Wednesday"
    productivityScore: number; // 0–100 scale
    journalsCount: number;
    ideasCreated: number;
    tasksCreated: number;
    tasksCompleted: number;
    incomesReceived: number;
    summaryText?: string;
    contributingJournals?: {
      id: string;
      title?: string;
    }[];
    contributingIdeas?: string[];
    contributingTasks?: string[];
    contributingIncomes?: string[];
    aiInsight?: {
      text: string;
      encouragement?: string;
      suggestions?: string[];
      confidence?: number;
    };
  };

  aiSummary?: {
    text: string;
    suggestions?: string[];
    encouragement?: string;
    confidence?: number;
  };

  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Firestore: moods/{auto-id}
export interface MoodEntry {
  id?: string;
  userId: string;
  mood: 'happy' | 'loving' | 'sad' | 'heart-broken' | 'angry';
  level: number; // 1–10
  source?: 'manual' | 'ai' | 'journal'; // where this mood entry came from
  recordedAt: Date | Timestamp; // exact time of entry
  createdAt: Date | Timestamp;
}

export const moodOptions = [
  'happy',
  'neutral',
  'sad',
  'excited',
  'angry',
  'calm',
] as const;

export type MoodType = (typeof moodOptions)[number];

export interface initialOnBoarding {
  userId;
  fullName?: string;
  nickName?: string;
  gender?: string;
  profession?: string;
  ageGroup?: string;
  currency?: string;
  country?: string;
  goals?: string[];
  currentLevel?: string | 'entry level';
  TopPriorities?: string[]; // e.g. learning, creativity, health
  shoppingHabits?: string; // e.g weekly , monthly, as needed
  incomeType?: string; // e.g. monthly, weekly
  startOfMonth?: number; // e.g. 01 or 05
  startOfWeek?: number;
  preferredTheme?: 'light' | 'dark' | 'auto';
}

// Initial On Boarding
export interface OnBoardingField<T> {
  filled: boolean;
  value: T;
}

export interface InitialOnBoarding {
  userId: string; // Always required

  // This will still come from users collection, so not nested:
  fullName?: string;

  // Fields with progress tracking
  nickName?: OnBoardingField<string>;
  gender?: OnBoardingField<'male' | 'female' | 'other'>;
  profession?: OnBoardingField<string>;
  ageGroup?: OnBoardingField<'teen' | '20s' | '30s' | '40s' | '50+'>;
  currency?: OnBoardingField<string>; // e.g. 'PKR', 'USD'
  country?: OnBoardingField<string>;
  goals?: OnBoardingField<string[]>; // e.g. ["Build habits", "Start business"]
  currentLevel?: OnBoardingField<'entry' | 'intermediate' | 'pro'>;
  topPriorities?: OnBoardingField<string[]>; // e.g. ['learning', 'fitness']
  shoppingHabits?: OnBoardingField<'weekly' | 'monthly' | 'as-needed'>;
  incomeType?: OnBoardingField<'monthly' | 'weekly' | 'irregular'>;
  startOfMonth?: OnBoardingField<number>; // Day of month: 1–31
  startOfWeek?: OnBoardingField<number>; // Day of week: 0 = Sunday, 1 = Monday, etc.
}

export interface QuickNote {
  id?: string;
  userId: string;
  content: string;
  isArchived?: boolean;
  importance?: string;
  createdAt: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

export interface DailyCheckout {
  id?: string;
  userId: string;
  title: string; // required
  dayOrDate: string; // required - can be day name (e.g., "Sunday", "Monday") or date string (e.g., "2025-01-29")
  category?: string; // optional but recommended
  time?: string; // optional but recommended - format: "HH:mm" (e.g., "09:00", "14:30")
  duration?: string; // optional - e.g., "30 mins", "1 hour"
  done: boolean; // default false
  createdAt: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

export interface StreakProps {
  id?: string; // Firestore doc ID
  userId: string; // linked to auth user
  title: string; // e.g. "Morning Walk"
  description?: string; // optional details
  category?: string; // Health, Study, Spiritual, etc.
  habitType: 'daily' | 'weekly' | 'monthly';
  target?: string; // e.g. "30 mins" / "10 pages"
  startDate: Timestamp;
  reminderTime?: string; // e.g. "06:00" in 24h format
  privacy: 'private' | 'public';
  lastChecked?: Timestamp; // last time user marked it done
  attendance: { date: Timestamp; day: string; progress?: string }[];
  streaksCount: number;

  reminder: {
    time: string;
  };
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  currentProgress?: string;
}

// Time Table
export interface TimeTableStep {
  field1: string;
  startTime: string;
  endTime: string;
}

export interface TimeTableProps {
  id?: string;
  userId: string;
  title: string;
  description?: string;
  steps: TimeTableStep[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Schedules
export interface SchedulesProps {
  id?: string;
  userId: string;
  date: string; // 'YYYY-MM-DD' format
  title: string;
  startTime: string; // 'HH:mm' format
  endTime: string; // 'HH:mm' format
  objective?: string; // e.g. "Weight Maintain"
  duration?: number; // Minutes
  location?: string;
  status: 'pending' | 'completed' | 'cancelled';
  reminder?: {
    before: number; // minutes before
    method: 'whatsapp' | 'notification' | 'email';
  };
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  autoGenerated?: boolean; // If true, the schedule will be generated automatically
  notes?: string;
  tags?: string[];
  linkedTaskId?: string; // id from to-do tasks item (optional)
  linkedGoalId?: string | null; // id from goals item (optional) later on
  colorCode?: string; // for UI color coding, like "#E3F2FD"
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

// Shopping List for Current Month
export interface ShoppingListItem {
  id?: string;
  userId: string;
  title: string; // e.g. "Wooden Bars"
  qty: string; // e.g. "6 x bars"
  proposedPrice: number; // budget/estimated price
  icon?: string; // emoji or icon
  dateOfBuy?: Date | Timestamp; // when to buy
  purchased: boolean; // default false
  purchasedPrice: number; // actual price paid, default 0
  archived?: boolean; // when true, hidden from UI but included in totals
  movedToPlanId?: string | null; // when set, item was moved to a shopping plan
  month: string; // 'YYYY-MM' format for filtering
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

// Goals Feature — Simplified Version

export interface GoalStep {
  id: string;
  title: string;
  description?: string;
  targetValue?: number;
  completed: boolean;
  skipped?: boolean;
  actualValue?: number;
  startDate?: Date | Timestamp;
  endDate: Date | Timestamp;
}

export type GoalType =
  | 'finance'
  | 'health'
  | 'learning'
  | 'habit'
  | 'work'
  | 'lifestyle'
  | 'custom';

export type GoalPriority = 'Low' | 'Medium' | 'High';

export type GoalStatus =
  | 'Not Started'
  | 'In Progress'
  | 'Completed'
  | 'On Track'
  | 'At Risk'
  | 'Off Track';

export interface Goal {
  id?: string;
  createdAt: Date | Timestamp;
  title: string;
  type: GoalType;
  description?: string;
  unit?: string;

  dueDate: Timestamp | Date;
  progress: number; // 0–100

  priority: GoalPriority;
  status: GoalStatus;

  steps: GoalStep[];

  // metrics (flattened)
  overallTargetValue?: number;
  overallTargetUnit?: string; // e.g. "Rs", "kg", "hours"

  userId: string;

  sharedWith?: string[];
  privacy?: 'private' | 'public' | 'specific';

  pinned?: boolean;
  isArchived?: boolean;

  updatedAt?: Timestamp | Date;
  completedAt?: Timestamp | Date | null;

  notes?: string;
  tags?: string[];

  authorName?: string;
}
