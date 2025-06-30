export interface ThoughtHistory {
  updatedAt: Date;
  changes: string[];
  by: string; // userId or 'AI'
}

export interface Thought {
  id?: string;
  // Authorship & Sharing
  authorId: string;
  authorName?: string;
  authorizedUsers?: string[];
  // Core Content
  title: string;
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
  history?: ThoughtHistory[];
  sharedVia?: string[]; // e.g., ['email', 'whatsapp']
}

export interface Todo {
  id?: string;
  title: string;
  description?: string;
  tags?: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'todo' | 'in_progress' | 'done' | 'blocked';
  progressPercent: number; // 0–100
  pinned?: boolean;
  isArchived?: boolean;
  // Dates
  startDate?: Date;
  dueDate?: Date;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  reminderDate?: Date;
  // Ownership & Sharing
  authorId: string;
  authorName?: string;
  assignedUsers: string[]; // users responsible (max 5)
  sharedWith?: string[]; // users who can view/edit
  // Checklist (subtasks)
  steps?: {
    text: string;
    done: boolean;
  }[];
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
  // Content
  date: string; // 'YYYY-MM-DD' (used for grouping & querying)
  content: string;
  description?: string;
  mood?: string;
  tags?: string[];

  // AI Enhancement
  aiSummary?: string;
  aiMoodAnalysis?: 'positive' | 'neutral' | 'negative';
  aiCategory?: string[];
  aiScore?: number; // 0–100 productivity score
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  // UX Flags
  isFavorite?: boolean;
  isArchived?: boolean;
  // Time-based for analysis
  week: number;
  month: string; // 'YYYY-MM'
  year: number;
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
