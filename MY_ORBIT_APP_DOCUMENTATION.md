# My Orbit - Personal Productivity & Finance Management App

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Core Features & Pages](#core-features--pages)
5. [Component Architecture](#component-architecture)
6. [Data Models & Interfaces](#data-models--interfaces)
7. [Authentication & User Management](#authentication--user-management)
8. [Database Architecture](#database-architecture)
9. [Key Functions & Utilities](#key-functions--utilities)
10. [App Flow & User Journey](#app-flow--user-journey)

---

## Project Overview

**My Orbit** is a comprehensive personal productivity and finance management application built with Next.js 15. It serves as a centralized platform for managing tasks, finances, journaling, mood tracking, and habit building. The app is designed to help users organize their daily activities, track their financial health, and maintain personal growth through various productivity tools.

### Key Capabilities:

- **Task Management**: Create, organize, and track todos with priority levels and progress tracking
- **Financial Management**: Track income sources, expenditures, and shopping lists with detailed analytics
- **Journaling**: Personal reflection and mood tracking with AI-enhanced insights
- **Habit Building**: Streak tracking and time table management
- **Ideas Management**: Capture and organize creative ideas with AI enhancement
- **Productivity Analytics**: Comprehensive dashboard with progress tracking and insights

---

## Technology Stack

### Frontend Framework

- **Next.js 15.3.4** - React framework with App Router
- **React 19.0.0** - UI library
- **TypeScript 5** - Type safety and development experience

### UI & Styling

- **Material-UI (MUI) 7.1.2** - Component library
- **Emotion** - CSS-in-JS styling
- **Tailwind CSS 4** - Utility-first CSS framework
- **Framer Motion 12.23.12** - Animation library

### Backend & Database

- **Firebase 11.9.1** - Backend-as-a-Service
  - Firestore - NoSQL database
  - Authentication - User management
- **Dexie 4.0.11** - IndexedDB wrapper for offline storage

### Data Visualization

- **Chart.js 4.5.0** - Charting library
- **Recharts 3.1.0** - React charting library
- **React ChartJS-2 5.3.0** - Chart.js React wrapper

### Utilities

- **Moment.js 2.30.1** - Date manipulation
- **JS-Cookie 3.0.5** - Cookie management
- **Lottie React 2.4.1** - Animation components

---

## Project Structure

```
my-orbit/
├── app/                          # Next.js App Router
│   ├── components/               # Reusable UI components
│   │   ├── finance/             # Financial management components
│   │   ├── global/              # Global UI components
│   │   ├── homepage/            # Dashboard components
│   │   ├── ideas/               # Ideas management components
│   │   ├── journal/             # Journaling components
│   │   ├── streaks/             # Habit tracking components
│   │   ├── time-table/          # Schedule management components
│   │   ├── to-do/               # Task management components
│   │   └── user/                # User-related components
│   ├── lib/                     # Core utilities and configurations
│   │   ├── context/             # React Context providers
│   │   ├── functions/           # Business logic functions
│   │   └── interface.ts         # TypeScript type definitions
│   ├── finance/                 # Financial pages
│   ├── ideas/                   # Ideas management pages
│   ├── journals/                # Journaling pages
│   ├── streaks/                 # Habit tracking pages
│   ├── time-table/              # Schedule management pages
│   ├── to-do/                   # Task management pages
│   ├── user/                    # User management pages
│   ├── layout.tsx               # Root layout component
│   └── page.tsx                 # Homepage
├── public/                      # Static assets
└── middleware.ts                # Next.js middleware
```

---

## Core Features & Pages

### 1. Homepage (`/`)

**Purpose**: Central dashboard providing overview of daily activities and progress

**Key Components**:

- `DashboardHome` - Progress overview with circular progress indicator
- `FinancialCheckPoints` - Financial status and upcoming payments
- `Mood` - Daily mood tracking
- `OnGoingStreaks` - Active habit streaks
- `ImportantTasks` - High-priority tasks for today
- `OverdueTasks` - Past-due tasks
- `ExpectedExpenses` - Upcoming financial obligations
- `ExpectedIncomes` - Expected income sources
- `JournalMemory` - Recent journal entries
- `MostProductiveDay` - Productivity analytics

**Major Functions**:

- Calculates daily progress percentage based on completed tasks, payments, journal entries, and mood logs
- Displays overdue tasks and remaining activities
- Provides quick access to all major app sections
- Shows personalized welcome message with user's first name

### 2. Task Management (`/to-do`)

**Purpose**: Comprehensive task and project management system

**Key Components**:

- `todoList.tsx` - Main task listing with filtering and sorting
- `todoModal.tsx` - Task creation and editing interface
- `todoDetailPage/` - Detailed task view with steps and progress tracking
- `completedTodosList.tsx` - Archive of completed tasks
- `TodoEnhancementPanel.tsx` - AI-powered task enhancement

**Major Functions**:

- Create tasks with priority levels (routine, urgent, critical)
- Add steps and substeps to break down complex tasks
- Track progress with percentage completion
- Set due dates and reminders
- Mark tasks as completed, in-progress, on hold, or left-over
- AI enhancement for task breakdown and optimization
- Bulk operations (delete, mark complete)

### 3. Financial Management (`/finance`)

**Purpose**: Comprehensive financial tracking and budgeting system

**Key Components**:

- `TotalCashSnapshot.tsx` - Real-time cash position across all accounts
- `CashFlowChart.tsx` - Visual representation of income vs expenses
- `PaidUnPaidChart.tsx` - Payment status visualization
- `IncomeSource.tsx` - Income tracking and management
- `Expenditures.tsx` - Expense tracking and categorization
- `BuyItemModal.tsx` - Shopping list management

**Major Functions**:

- Track multiple income sources (recurring and one-time)
- Monitor expenditures with due dates and payment status
- Manage shopping lists with estimated vs actual prices
- Real-time cash position across different accounts (bank, mobile wallets, cash)
- Financial analytics and insights
- Payment history tracking
- Budget vs actual comparisons

### 4. Ideas Management (`/ideas`)

**Purpose**: Capture, organize, and enhance creative ideas

**Key Components**:

- `IdeasList.tsx` - Display and manage idea collection
- `IdeasModal.tsx` - Create and edit ideas
- `IdeaLevelButton.tsx` - Priority level management
- `LevelDrawer.tsx` - Idea categorization
- `PrivacyDrawer.tsx` - Sharing and privacy controls

**Major Functions**:

- Capture ideas with titles, descriptions, and tags
- AI-powered idea enhancement and improvement
- Categorize ideas by level (general, super, critical)
- Privacy controls (private, public, specific users)
- Idea history and version tracking
- Search and filter capabilities

### 5. Journaling (`/journals`)

**Purpose**: Personal reflection and mood tracking system

**Key Components**:

- `journalList.tsx` - Display journal entries with search
- `journalModal.tsx` - Create and edit journal entries
- `moodSelector.tsx` - Mood tracking interface

**Major Functions**:

- Create journal entries with mood tracking
- AI-powered mood analysis and insights
- Productivity reflection and daily summaries
- Search and filter journal entries by date, mood, or content
- Privacy controls for journal entries
- Integration with mood tracking system

### 6. Habit Tracking (`/streaks`)

**Purpose**: Build and maintain positive habits through streak tracking

**Key Components**:

- `StreaksList.tsx` - Display active and completed streaks
- `StreaksModal.tsx` - Create new habit streaks
- `StreakDelete.tsx` - Streak management
- `StreakMarkDone.tsx` - Mark daily progress

**Major Functions**:

- Create habits with different frequencies (daily, weekly, monthly)
- Track streak counts and attendance
- Set reminder times for habit completion
- Visual progress tracking
- Category-based organization (Health, Study, Spiritual, etc.)
- Privacy controls for habit sharing

### 7. Time Table Management (`/time-table`)

**Purpose**: Schedule and time management system

**Key Components**:

- `TimeTableList.tsx` - Display created time tables
- `TimeTableModal.tsx` - Create and edit schedules

**Major Functions**:

- Create time tables with specific time slots
- Organize daily, weekly, or custom schedules
- Time slot management with start and end times
- Schedule notifications and reminders

### 8. User Management (`/user`)

**Purpose**: User authentication, profile management, and settings

**Key Components**:

- `login/page.tsx` - User authentication
- `signup/page.tsx` - New user registration
- `dashboard/page.tsx` - User profile and settings
- `manage/page.tsx` - User management (admin)
- `theme/page.tsx` - Theme customization

**Major Functions**:

- Firebase Authentication integration
- User profile management (name, email, role)
- Role-based access control (master, editor, viewer)
- Theme customization (light/dark mode)
- User data management and settings

---

## Component Architecture

### Global Components (`/components/global/`)

#### `AppBarTop.tsx`

- **Purpose**: Top navigation bar with user info and quick actions
- **Functions**: User authentication status, navigation links, theme toggle

#### `Navbar.tsx`

- **Purpose**: Main navigation menu
- **Functions**: Route navigation, active state management, responsive design

#### `ClientThemeProvider.tsx`

- **Purpose**: Theme context provider for light/dark mode
- **Functions**: Theme state management, persistence, Material-UI theme integration

#### `AIModal.tsx`

- **Purpose**: AI-powered assistance modal
- **Functions**: AI integration, content enhancement, user interaction

#### Onboarding Components (`/components/global/initial-on-boarding/`)

- **Purpose**: New user onboarding flow
- **Components**: Age/Gender selection, profession setup, currency selection, goal setting
- **Functions**: Progressive data collection, user preference setup, initial configuration

### Finance Components (`/components/finance/`)

#### `FinancialCheckPoints.tsx`

- **Purpose**: Financial overview and upcoming payment alerts
- **Functions**:
  - Calculate upcoming income and expenses
  - Display payment status and due dates
  - Provide quick access to financial actions
  - Show financial health indicators

#### `TotalCashSnapshot.tsx`

- **Purpose**: Real-time cash position across all accounts
- **Functions**:
  - Aggregate cash from multiple sources (bank, mobile wallets, cash)
  - Track frozen/available amounts
  - Display account breakdown
  - Handle money transfers between accounts

#### `CashFlowChart.tsx`

- **Purpose**: Visual representation of financial flow
- **Functions**: Income vs expense visualization, trend analysis, period comparisons

#### `IncomeSource.tsx` & `Expenditures.tsx`

- **Purpose**: Manage income sources and expenses
- **Functions**: CRUD operations, recurring payment management, payment status tracking

### Homepage Components (`/components/homepage/`)

#### `Opener.tsx` (DashboardHome)

- **Purpose**: Main dashboard with daily progress overview
- **Functions**:
  - Calculate daily completion percentage
  - Display remaining tasks and payments
  - Show overdue items
  - Provide motivational messages based on progress

#### `Mood.tsx`

- **Purpose**: Daily mood tracking interface
- **Functions**: Mood selection, level rating, mood history, integration with journal

#### `ImportantTasks.tsx` & `OverdueTasks.tsx`

- **Purpose**: Task prioritization and management
- **Functions**: Display high-priority tasks, overdue task alerts, quick task actions

#### `ExpectedExpenses.tsx` & `ExpectedIncomes.tsx`

- **Purpose**: Financial planning and awareness
- **Functions**: Show upcoming payments, expected income, financial planning

---

## Data Models & Interfaces

### Core Data Types

#### `Todo` Interface

```typescript
interface Todo {
  id?: string;
  title: string;
  description?: string;
  priority: 'routine' | 'urgent' | 'critical';
  status: 'in_progress' | 'completed' | 'hold' | 'left-over';
  progressPercent: number;
  authorId: string;
  dueDate?: Timestamp | Date;
  steps?: ToDoStep[];
  // ... additional fields
}
```

#### `IncomeSource` Interface

```typescript
interface IncomeSource {
  id?: string;
  userId: string;
  title: string;
  type: 'one-time' | 'recurring';
  frequency: 'monthly' | 'weekly' | 'daily' | 'one_time';
  amount: number;
  expectedDate?: Date | Timestamp;
  isReceived?: boolean;
  lastReceivedDate?: Date | Timestamp;
  // ... additional fields
}
```

#### `Expenditure` Interface

```typescript
interface Expenditure {
  id?: string;
  userId: string;
  title: string;
  type: 'one-time' | 'recurring';
  frequency: 'monthly' | 'weekly' | 'daily' | 'one_time';
  amount: number;
  dueDate?: Date | Timestamp;
  isPaid?: boolean;
  lastPaidDate?: Date | Timestamp;
  // ... additional fields
}
```

#### `JournalEntry` Interface

```typescript
interface JournalEntry {
  id?: string;
  authorId: string;
  title: string;
  content: string;
  mood?: {
    type: 'happy' | 'loving' | 'sad' | 'heart-broken' | 'angry';
    level: number;
  };
  privacy: 'private' | 'public';
  date: string;
  // ... additional fields
}
```

#### `StreakProps` Interface

```typescript
interface StreakProps {
  id?: string;
  userId: string;
  title: string;
  habitType: 'daily' | 'weekly' | 'monthly';
  startDate: Timestamp;
  attendance: { date: Timestamp; day: string; progress?: string }[];
  streaksCount: number;
  // ... additional fields
}
```

### Financial Data Models

#### `TotalCashSnapshot` Interface

```typescript
interface TotalCashSnapshot {
  id?: string;
  userId: string;
  sources: {
    in_hand: number;
    easypaisa: number;
    jazzcash: number;
    other: number;
    bank: { [bankName: string]: number };
  };
  totalAmount: number;
  freezeAmount: number;
  // ... additional fields
}
```

#### `CashTransaction` Interface

```typescript
interface CashTransaction {
  id?: string;
  userId: string;
  amount: number;
  type: 'add' | 'deduct' | 'freeze_transfer' | 'borrow' | 'lend';
  source: 'in_hand' | 'bank' | 'easypaisa' | 'jazzcash' | 'other';
  category:
    | 'income'
    | 'expenditure'
    | 'shopping'
    | 'manual'
    | 'transfer'
    | 'loan';
  // ... additional fields
}
```

---

## Authentication & User Management

### Firebase Authentication Integration

- **Provider**: Firebase Auth with email/password authentication
- **Context**: `UserContext` provides user state throughout the app
- **User Roles**: master, editor, viewer with different permission levels
- **Session Management**: Cookie-based session persistence

### User Context (`/lib/context/userContext.tsx`)

**Functions**:

- Monitor authentication state changes
- Fetch user data from Firestore
- Provide user information to components
- Handle authentication errors and edge cases

### User Management Features

- **Profile Management**: Update name, email, and personal information
- **Role-based Access**: Different permission levels for different users
- **Theme Preferences**: User-specific theme settings
- **Data Privacy**: User data isolation and privacy controls

---

## Database Architecture

### Firebase Firestore Collections

#### `users` Collection

- **Purpose**: User profile and authentication data
- **Fields**: uid, email, firstName, lastName, role, createdAt
- **Security**: User can only access their own document

#### `todos` Collection

- **Purpose**: Task and project management
- **Fields**: title, description, priority, status, progressPercent, authorId, dueDate, steps
- **Security**: User can only access their own todos

#### `incomeSources` Collection

- **Purpose**: Income tracking and management
- **Fields**: title, type, frequency, amount, expectedDate, isReceived, userId
- **Security**: User can only access their own income sources

#### `expenditures` Collection

- **Purpose**: Expense tracking and management
- **Fields**: title, type, frequency, amount, dueDate, isPaid, userId
- **Security**: User can only access their own expenditures

#### `journals` Collection

- **Purpose**: Personal journaling and reflection
- **Fields**: title, content, mood, authorId, date, privacy
- **Security**: User can only access their own journals

#### `streaks` Collection

- **Purpose**: Habit tracking and streak management
- **Fields**: title, habitType, startDate, attendance, streaksCount, userId
- **Security**: User can only access their own streaks

#### `ideas` Collection

- **Purpose**: Creative idea management
- **Fields**: text, title, description, level, authorId, privacy, tags
- **Security**: User can only access their own ideas

#### `buyItems` Collection

- **Purpose**: Shopping list management
- **Fields**: title, items, userId, budgetLimit, archived, pinned
- **Security**: User can only access their own shopping lists

#### `pmc` Collection (Productivity Monitoring Cell)

- **Purpose**: Daily productivity analytics and insights
- **Fields**: userId, date, focusTime, moodSummary, productivityScore
- **Security**: User can only access their own PMC data

### Offline Storage (Dexie/IndexedDB)

- **Purpose**: Local caching and offline functionality
- **Collections**: Memories, temporary data, offline journal entries
- **Sync**: Automatic sync with Firestore when online

---

## Key Functions & Utilities

### Financial Utilities (`/lib/utilts.ts`)

#### `formatCurrency(amount, currency)`

- **Purpose**: Format monetary values with proper currency symbols
- **Parameters**: amount (number), currency ('PKR' | 'USD')
- **Returns**: Formatted currency string (e.g., "Rs 1,000" or "$10.00")

#### `extractHoursAndDaysFromTimestamps(timestamps)`

- **Purpose**: Analyze time patterns from timestamp arrays
- **Parameters**: Array of Date objects
- **Returns**: Object with hour/day frequency maps and most active periods

#### `logFocusTime(userId)`

- **Purpose**: Track user focus time for productivity analytics
- **Parameters**: userId (string)
- **Functions**: Updates PMC collection with focus time data

### Firebase Utilities (`/lib/firebase.ts`)

- **Purpose**: Firebase configuration and initialization
- **Exports**: app, db (Firestore), auth (Authentication)
- **Configuration**: Environment-based Firebase config

### Database Utilities (`/lib/dexieDB.ts`)

- **Purpose**: IndexedDB wrapper for offline storage
- **Collections**: memories (journal text, AI reflections, date-based data)
- **Functions**: Local data persistence and retrieval

### Context Providers

#### `UserContext` (`/lib/context/userContext.tsx`)

- **Purpose**: Global user state management
- **Functions**: Authentication state, user data fetching, session management

#### `ThemeContext` (`/lib/context/themeContext.tsx`)

- **Purpose**: Theme state management
- **Functions**: Light/dark mode switching, theme persistence

#### `TodoContext` (`/lib/context/todoContext.tsx`)

- **Purpose**: Task management state
- **Functions**: Todo CRUD operations, state synchronization

#### `IncomeSourcesContext` (`/lib/context/IncomeSourcesContext.tsx`)

- **Purpose**: Income management state
- **Functions**: Income source management, payment tracking

#### `ExpendituresContext` (`/lib/context/ExpendituresContext.tsx`)

- **Purpose**: Expense management state
- **Functions**: Expense tracking, payment status management

---

## App Flow & User Journey

### 1. Authentication Flow

1. **Login/Signup**: User authenticates via Firebase Auth
2. **Profile Setup**: New users complete onboarding process
3. **Dashboard Access**: Authenticated users access main dashboard

### 2. Daily Usage Flow

1. **Dashboard Overview**: User sees daily progress and remaining tasks
2. **Task Management**: Create, update, and complete tasks
3. **Financial Tracking**: Log income, expenses, and payments
4. **Journaling**: Record daily reflections and mood
5. **Habit Tracking**: Mark habit completion and track streaks

### 3. Weekly/Monthly Review Flow

1. **Analytics Review**: Check productivity and financial analytics
2. **Goal Assessment**: Review progress toward personal goals
3. **Planning**: Set new tasks and financial goals
4. **Reflection**: Journal about achievements and challenges

### 4. Data Flow Architecture

1. **User Input**: Data entered through UI components
2. **Context Management**: State managed through React Context
3. **Firebase Sync**: Data synchronized with Firestore
4. **Local Storage**: Critical data cached in IndexedDB
5. **Real-time Updates**: Live data updates across components

### 5. Error Handling & Recovery

1. **Network Issues**: Offline mode with local storage
2. **Authentication Errors**: Automatic re-authentication
3. **Data Conflicts**: Last-write-wins with user notification
4. **Validation Errors**: Client-side validation with user feedback

---

## Key Features Summary

### Productivity Features

- ✅ **Task Management**: Comprehensive todo system with priorities and progress tracking
- ✅ **Habit Tracking**: Streak-based habit building with reminders
- ✅ **Time Management**: Schedule creation and time table management
- ✅ **Journaling**: Personal reflection with mood tracking
- ✅ **Ideas Management**: Creative idea capture with AI enhancement

### Financial Features

- ✅ **Income Tracking**: Multiple income sources with recurring payment management
- ✅ **Expense Management**: Comprehensive expense tracking with due dates
- ✅ **Shopping Lists**: Purchase planning with budget tracking
- ✅ **Cash Management**: Multi-account cash position tracking
- ✅ **Financial Analytics**: Visual charts and insights

### User Experience Features

- ✅ **Responsive Design**: Mobile-first design with Material-UI components
- ✅ **Dark/Light Theme**: User preference-based theme switching
- ✅ **Real-time Updates**: Live data synchronization across devices
- ✅ **Offline Support**: Local storage for offline functionality
- ✅ **AI Integration**: AI-powered insights and enhancements

### Analytics & Insights

- ✅ **Progress Tracking**: Daily completion percentage and goal tracking
- ✅ **Productivity Analytics**: Focus time and productivity pattern analysis
- ✅ **Financial Insights**: Spending patterns and budget analysis
- ✅ **Mood Tracking**: Emotional state monitoring and trends
- ✅ **Habit Analytics**: Streak tracking and habit formation insights

---

This documentation provides a comprehensive overview of the My Orbit application, covering all major components, features, and technical architecture. The app serves as a complete personal productivity and finance management solution with modern web technologies and user-centric design principles.
