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

export interface Todo {
  id?: string;
  title: string;
  description?: string;
  tags?: string[];
  priority: 'routine' | 'urgent' | 'critical';
  status: 'in_progress' | 'completed' | 'hold' | 'left-over';
  progressPercent: number; // 0–100
  pinned?: boolean;
  isArchived?: boolean;
  // Ownership & Sharing
  authorId: string;
  authorName?: string;
  assignedUsers: string[]; // users responsible (max 5)
  sharedWith?: string[]; // users who can view/edit
  // Checklist (subtasks)
  steps?: {
    text: string;
    done: boolean;
    status: 'in_progress' | 'completed' | 'hold' | 'left-over';
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
  authorId: string;
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
}

export interface FirestoreUser {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'master' | 'editor' | 'viewer';
  createdAt: Timestamp; // or use `Timestamp` from Firestore
}

// Finance
export interface BudgetSettings {
  userId: string;
  budgetStartDay: number; // 1–31
  currencySymbol?: string; // optional: 'Rs', '$', etc.
  createdAt: Date;
  updatedAt: Date;
}

export type CashType = 'in_hand' | 'bank' | 'easypaisa' | 'jazzcash' | 'other';
export interface TotalCashSnapshot {
  id?: string;
  userId: string;
  inHand: number;
  bank: number;
  easypaisa?: number;
  jazzcash?: number;
  otherWallets?: {
    name: string;
    amount: number;
  }[];
  note?: string;
  effectiveDate: Date | Timestamp;
  createdAt: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

export interface IncomeSource {
  id?: string;
  userId: string;
  title: string; // e.g., "Salary", "Freelance", "Rent"
  amount: number;
  frequency: 'monthly' | 'weekly' | 'daily' | 'one_time';
  nextExpectedDate?: Date; // optional
  startDate?: Date;
  isRecurring: boolean;
  notes?: string;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}
export interface Expenditure {
  id?: string;
  userId: string;
  title: string;
  type: 'fixed' | 'variable';
  amount: number;
  dueDate?: Date; // for future bills
  isRecurring?: boolean;
  isPaid?: boolean;
  category?: string; // e.g., food, rent, utility
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface BuyItem {
  id?: string;
  userId: string;
  title: string;
  estimatedPrice: number;
  purchasedPrice?: number;
  isPurchased: boolean;
  priority?: 'optional' | 'needed' | 'urgent';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
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
