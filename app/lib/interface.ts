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
  projectId?: string;
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
  dueDate?: Timestamp | Date;
  isFlexible?: boolean; // If true, appears daily without a fixed due date

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
  scheduleSummary?: string; // AI-generated schedule/action plan for the task
  // Activity log (optional)
  history?: {
    updatedAt: Date;
    changes: string[];
    by: string;
  }[];
  // Linking to goals
  linkedGoalId?: string;
  goalTitle?: string;
  goalRole?: 'contributive' | 'supportive';
  contributionAmount?: number;
  contributionUnit?: string;
  rescheduleCounts?: number;
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
  displayName: string;
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'master' | 'editor' | 'viewer' | 'guest';
  createdAt: Timestamp; // or use `Timestamp` from Firestore
  isGuest?: boolean; // Optional flag to identify guest users
  guideVisited?: boolean; // Track if the user has visited the interactive guide
  shareId?: string;
  username?: string;
  sharedWith?: { uid: string; displayName: string; shareId: string }[];
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

export interface HolderAmount {
  holderName: string;
  amount: number;
}

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

  heldBy?: { [sourceKey: string]: HolderAmount[] }; // 👈 holder balances map
  sourceOwnership?: {
    [sourceKey: string]: {
      hasOwnThisMoney: boolean;
      ownerName?: string;
      ownserName?: string;
      isLocked?: boolean;
    };
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
  goalId?: string;
  goalTitle?: string;
  createdAt: Date | Timestamp;
}

export type TransactionType =
  | 'add'
  | 'deduct'
  | 'freeze_transfer'
  | 'borrow'
  | 'lend'
  | 'transfer'; // 👈 added transfer type

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
  holderName?: string | null; // 👈 holder details for tracking
  fromHolderName?: string | null; // 👈 for transfers between holders
  toHolderName?: string | null; // 👈 for transfers between holders
  createdAt: Date | Timestamp;
}
export interface LoanRecord {
  id?: string;
  userId: string;
  amount: number;
  paidAmount?: number; // amount paid/received so far
  type: 'borrow' | 'lend'; // perspective of the user
  counterparty: string; // name/identifier of the person
  dueDate?: Date | Timestamp;
  note?: string;
  isSettled: boolean;
  createdAt: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}
export interface Liability {
  id?: string;
  type: 'lend' | 'borrowed';
  amount: number;
  personName: string;
  description?: string;
  source?: string;
  date: Date | Timestamp;
  dueDate?: Date | Timestamp;
  status: 'active' | 'settled' | 'overdue';
  settledOn?: Date | Timestamp;
  createdAt: Date | Timestamp;
  userId: string;
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
  firstName?: string;
  lastName?: string;

  // Fields with progress tracking
  nickName?: OnBoardingField<string>;
  gender?: OnBoardingField<'male' | 'female' | 'other'>;
  profession?: OnBoardingField<string>;
  professionType?: OnBoardingField<'job' | 'business'>;
  ageGroup?: OnBoardingField<string>;
  currency?: OnBoardingField<string>;
  country?: OnBoardingField<string>;
  city?: OnBoardingField<string>;
  goals?: OnBoardingField<string[]>;
  skills?: OnBoardingField<string[]>;
  hobby?: OnBoardingField<string>;
  education?: OnBoardingField<string>;
  currentLevel?: OnBoardingField<'entry' | 'intermediate' | 'pro'>;
  topPriorities?: OnBoardingField<string[]>;
  shoppingHabits?: OnBoardingField<'weekly' | 'monthly' | 'as-needed'>;
  incomeType?: OnBoardingField<'monthly' | 'weekly' | 'irregular'>;
  startOfMonth?: OnBoardingField<number>;
  startOfWeek?: OnBoardingField<number>;

  // AI Behavior
  aiTone?: OnBoardingField<'Formal' | 'Friendly' | 'Strict Coach'>;
  autoImprove?: OnBoardingField<boolean>;
  autoSuggest?: OnBoardingField<boolean>;
  smartRescheduling?: OnBoardingField<boolean>;

  // Productivity
  workStyle?: OnBoardingField<string>;
  peakHours?: OnBoardingField<string[]>;
  socialPreference?: OnBoardingField<string>;
  preferredSocialTime?: OnBoardingField<string>;
  socialHourRange?: OnBoardingField<[number, number]>;

  // Notifications
  reminderBefore?: OnBoardingField<number>;
  maxNotifications?: OnBoardingField<number>;
  quitHours?: OnBoardingField<[number, number]>;

  // Planning
  activityTracking?: OnBoardingField<'Allow' | 'Limited' | 'Off'>;
  deadlineType?: OnBoardingField<'Strict' | 'Flexible'>;
  onBoardingFirstInteraction?: boolean;
}

export interface QuickNote {
  id?: string;
  userId: string;
  content: string;
  isArchived?: boolean;
  importance?: string;
  isImportant?: boolean;
  isFav?: boolean;
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
  habitType: 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly';
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
  type?: string; // e.g. Learning, Health/ fitness, work, education, family, transport, religious, events
  steps: TimeTableStep[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Schedules
export interface SchedulesProps {
  id?: string;
  userId: string;
  projectId?: string;
  date: string; // 'YYYY-MM-DD' format
  isFlexible?: boolean; // If true, appears daily in 'today' view
  title: string;
  startTime: string; // 'HH:mm' format
  endTime: string; // 'HH:mm' format
  objective?: string; // e.g. "Weight Maintain"
  duration?: number; // Minutes
  location?: string;
  status: 'pending' | 'completed' | 'cancelled';
  reminder?: {
    before: number; // minutes before
    method: 'whatsapp' | 'push' | 'notification' | 'email';
  };
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  autoGenerated?: boolean; // If true, the schedule will be generated automatically
  notes?: string;
  tags?: string[];
  linkedTaskId?: string; // id from to-do tasks item (optional)
  linkedGoalId?: string | null; // id from goals item (optional) later on
  goalTitle?: string;
  goalRole?: 'contributive' | 'supportive';
  contributionAmount?: number;
  contributionUnit?: string;
  frequencyMode?: 'daily' | 'weekly' | 'monthly';
  selectedDaysOfWeek?: number[];
  selectedDaysOfMonth?: number[];
  colorCode?: string; // for UI color coding, like "#E3F2FD"
  hasReminder?: boolean;
  reminderDate?: Timestamp | Date | string | number | null;
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

export enum GoalStepStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
  BLOCKED = 'blocked',
  DEFERRED = 'deferred',
}

export interface StepCheckIn {
  id: string;
  date: Date | Timestamp;
  value?: number;
  note?: string;
  mood?: 'great' | 'okay' | 'tough';
  evidenceUrls?: string[];
}

export interface StepCompletionRecord {
  completedAt: Date | Timestamp;
  finalValue?: number;
  finalNote?: string;
  totalCheckIns?: number;
  durationDays?: number;
}

export interface GoalStep {
  id: string;
  title: string;
  description?: string;
  order: number;
  status: GoalStepStatus;
  targetValue?: number;
  targetAmount?: number;
  actualValue?: number;
  unit?: string;
  startDate?: Date | Timestamp;
  endDate: Date | Timestamp;
  weight?: number;
  effortEstimate?: number;
  dependsOn?: string[];
  recurrence?: {
    type: 'daily' | 'weekly' | 'monthly' | 'none';
    interval?: number;
    recurrenceEndDate?: Date | Timestamp;
  };
  checkIns?: StepCheckIn[];
  linkedTodoIds?: string[];
  completionRecord?: StepCompletionRecord;
  closed?: boolean;
  role?: 'contributive' | 'supportive';
  contributionAmount?: number;
  contributionUnit?: string;
  linkedType?: 'todo' | 'schedule' | 'finance_source' | 'manual';
  linkedItemId?: string;
  progressMode?: 'binary' | 'progressive';
  direction?: 'up' | 'down';
  lastCompletedAt?: string;
  completionHistory?: string[];
}

export type GoalType =
  | 'finance'
  | 'health'
  | 'learning'
  | 'habit'
  | 'work'
  | 'personal_growth'
  | 'travel'
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
  projectId?: string;
  createdAt: Date | Timestamp;
  title: string;
  type: GoalType;
  description?: string;
  unit?: string;

  dueDate?: Timestamp | Date;
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

  // Legacy / AI fields
  deadline?: string;
  targetDate?: string;

  authorName?: string;

  // Tracker
  trackerEnabled?: boolean;
  tracker?: GoalTracker | null;

  // AI Phrasing & Suggestions
  aiNudge?: string;
  aiActivityVerb?: string;
  aiVerb?: string;
  aiSuggestedUnit?: string;

  progressMode?: 'cumulative' | 'current_value';
  direction?: 'up' | 'down' | null;
  startValue?: number | null;
  trackingMethod?: 'tracker' | 'milestones';
  goalFurnished?: boolean;
  clarifyingAnswer?: string;

  intent?: string; // e.g. 'save', 'learn', 'lose', 'gain', 'read', 'visit'
  progressTrackingType?: 'accumulative' | 'opposes';
  startingValue?: number;
  timeFrame?: string;
  linkedSourceId?: string; // custom payment head in Finance

  subcategory?: string; // e.g. 'Saving', 'Fitness', 'Travel', 'Reading', 'Build Habit', 'Career'
  measurementType?: 'qty' | 'duration' | 'frequency' | 'completion_percentage' | 'duration_of_consistency';
  recommendedMilestoneType?: 'schedule' | 'todo' | 'finance_source' | 'manual';
  aiMilestoneReason?: string;

  // Structured questionnaire fields for template pages
  questionnaireAnswers?: Record<string, unknown>;
  milestoneItems?: string[];
  currentValue?: number;
  transactions?: Array<{ date: string; amount: number; type: 'deposit' | 'withdrawal'; note?: string }>;
  expenseItems?: Array<Record<string, unknown>>;
  incomeSources?: Array<Record<string, unknown>>;
  debtRecords?: Array<Record<string, unknown>>;
  profitLogs?: Array<Record<string, unknown>>;
  exerciseItems?: Array<Record<string, unknown>>;
  nutritionItems?: Array<Record<string, unknown>>;
  weightLogs?: Array<Record<string, unknown>>;
  sleepLogs?: Array<Record<string, unknown>>;
  medicalAppointments?: Array<Record<string, unknown>>;
  medicalTests?: Array<Record<string, unknown>>;
  medicalMedicines?: Array<Record<string, unknown>>;
  medicalSchedule?: Array<Record<string, unknown>>;
  medicalFollowUps?: Array<Record<string, unknown>>;
  learningCheckpoints?: Array<{ id?: string; label: string; done: boolean }>;
  practiceSchedules?: Array<{ id?: string; activity: string; time?: string; frequencyPerWeek?: number }>;
  readingLogs?: Array<{ id?: string; date: string; pagesRead: number; chapterNote?: string }>;
  courseLessons?: Array<{ id?: string; title: string; durationMins?: number; completed: boolean; completedAt?: string }>;
  habitCheckIns?: Array<{ id?: string; date: string; completed: boolean; note?: string }>;
  habitCue?: string;
  habitReward?: string;
  quitStartDate?: string;
  relapseLogs?: Array<{ id?: string; date: string; trigger?: string; note?: string }>;
  routineItems?: Array<{ id?: string; title: string; time?: string; period?: 'morning' | 'afternoon' | 'evening' | 'night'; completed: boolean }>;
}

export interface TrackerCheckIn {
  id: string;
  period: string;           // 'D1', 'W1', 'M1', 'BW1'
  scheduledDate: string;    // YYYY-MM-DD
  value?: number;           // quantity logged (null = completion-only)
  note?: string;
  completed: boolean;
  completedAt?: string;     // YYYY-MM-DD
}

export type TrackerFrequency = 'daily' | 'every2days' | 'weekly' | 'biweekly' | 'monthly';

export interface GoalTracker {
  frequency: TrackerFrequency;
  targetPerCheckIn: number;
  unit: string;             // 'km', 'pages', 'hours', '' for completion-only
  totalTarget: number;      // 0 = completion-only
  totalCheckIns: number;
  startDate: string;        // YYYY-MM-DD
  dueDate: string;          // YYYY-MM-DD
  checkIns: TrackerCheckIn[];
  whatsappReminder: boolean;
}

export type ProjectType =
  | 'general'
  | 'learning'
  | 'freelance'
  | 'health'
  | 'personal';
export type ProjectStatus = 'active' | 'planning' | 'completed' | 'on-hold';

export type PointType =
  | 'string'
  | 'todo'
  | 'schedule'
  | 'goal'
  | 'keyvalue'
  | 'streak';

export interface Point {
  id: string;
  type: PointType;
  content?: string;
  todoId?: string;
  scheduleId?: string;
  goalId?: string;
  key?: string;
  value?: string;
  count?: number; // for streaks
  colorScheme?: 'default' | 'success' | 'warning' | 'info' | 'error' | 'grey';
  groupName?: string;
  done?: boolean;
}

export interface Agenda {
  id: string;
  title: string;
  points: Point[];
}

export interface Project {
  id?: string;
  userId: string;
  title: string;
  description?: string;
  type: ProjectType;
  status: ProjectStatus;
  budget?: number;
  estimatedCompletion?: Timestamp | Date;
  progress: number;
  assignees?: string[];
  agendas: Agenda[];
  createdAt: Timestamp | Date;
  completedAt?: Timestamp | Date | null;
}


export type OnboardingFieldValue = 
  | string 
  | number 
  | boolean 
  | string[] 
  | number[]
  | [number, number] 
  | 'job' 
  | 'business' 
  | 'male' 
  | 'female' 
  | 'other' 
  | 'Formal' 
  | 'Friendly' 
  | 'Strict Coach' 
  | 'Allow' 
  | 'Limited' 
  | 'Off' 
  | 'Strict' 
  | 'Flexible'
  | undefined;

export interface OnboardingData {
  firstName?: string;
  lastName?: string;
  mobile?: OnBoardingField<string>;
  country?: OnBoardingField<string>;
  city?: OnBoardingField<string>;
  professionType?: OnBoardingField<'job' | 'business'>;
  profession?: OnBoardingField<string>;
  skills?: OnBoardingField<string[]>;
  hobby?: OnBoardingField<string>;
  ageGroup?: OnBoardingField<string>;
  gender?: OnBoardingField<'male' | 'female' | 'other'>;
  education?: OnBoardingField<string>;
  workStyle?: OnBoardingField<string>;
  peakHours?: OnBoardingField<string[]>;
  socialPreference?: OnBoardingField<string>;
  preferredSocialTime?: OnBoardingField<string>;
  socialHourRange?: OnBoardingField<[number, number]>;
  reminderBefore?: OnBoardingField<number>;
  maxNotifications?: OnBoardingField<number>;
  quitHours?: OnBoardingField<[number, number]>;
  aiTone?: OnBoardingField<'Formal' | 'Friendly' | 'Strict Coach'>;
  autoImprove?: OnBoardingField<boolean>;
  autoSuggest?: OnBoardingField<boolean>;
  smartRescheduling?: OnBoardingField<boolean>;
  weekStart?: OnBoardingField<number>;
  monthStart?: OnBoardingField<number>;
  activityTracking?: OnBoardingField<'Allow' | 'Limited' | 'Off'>;
  deadlineType?: OnBoardingField<'Strict' | 'Flexible'>;
  onBoardingFirstInteraction?: boolean;
}

