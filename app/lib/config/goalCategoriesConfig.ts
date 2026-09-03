import { GoalType } from '../interface';

export type MeasurementType =
  | 'qty'
  | 'duration'
  | 'frequency'
  | 'completion_percentage'
  | 'duration_of_consistency';

export interface SubcategoryConfig {
  id: string;
  name: string;
  units: string[];
  unitMeasurementTypes: Record<string, MeasurementType>;
  examples?: string[];
}

export interface CategoryConfig {
  id: GoalType;
  name: string;
  emoji: string;
  color: string;
  lightBg: string;
  darkBg: string;
  description: string;
  subcategories: SubcategoryConfig[];
  allUnits: string[];
}

export const MEASUREMENT_TYPE_META: Record<
  MeasurementType,
  { label: string; formula: string; icon: string; badgeColor: string }
> = {
  qty: {
    label: 'Quantity / Target',
    formula: 'current value / target value',
    icon: '🔢',
    badgeColor: '#10B981',
  },
  duration: {
    label: 'Duration',
    formula: 'accumulated time / target time',
    icon: '⏱️',
    badgeColor: '#3B82F6',
  },
  frequency: {
    label: 'Frequency',
    formula: 'completed occurrences / target occurrences',
    icon: '🔁',
    badgeColor: '#8B5CF6',
  },
  completion_percentage: {
    label: 'Percentage',
    formula: 'completion percentage directly',
    icon: '📊',
    badgeColor: '#F59E0B',
  },
  duration_of_consistency: {
    label: 'Consistency Duration',
    formula: 'achieved consistent duration / target duration',
    icon: '🔥',
    badgeColor: '#EC4899',
  },
};

export const GOAL_CATEGORIES_CONFIG: Record<string, CategoryConfig> = {
  finance: {
    id: 'finance',
    name: 'Finance',
    emoji: '💰',
    color: '#10B981',
    lightBg: '#ecfdf5',
    darkBg: '#022c22',
    description: 'Track money, savings, debt, income & spending targets',
    allUnits: ['PKR', 'USD', 'EUR', '%', 'transactions', 'items'],
    subcategories: [
      {
        id: 'saving',
        name: 'Saving',
        units: ['PKR', 'USD', 'EUR'],
        unitMeasurementTypes: { PKR: 'qty', USD: 'qty', EUR: 'qty' },
        examples: ['Save PKR 100,000 for emergency fund'],
      },
      {
        id: 'debt',
        name: 'Debt',
        units: ['PKR', 'USD', 'EUR'],
        unitMeasurementTypes: { PKR: 'qty', USD: 'qty', EUR: 'qty' },
        examples: ['Pay off PKR 200,000 credit debt'],
      },
      {
        id: 'investing',
        name: 'Investing',
        units: ['PKR', 'USD', 'EUR'],
        unitMeasurementTypes: { PKR: 'qty', USD: 'qty', EUR: 'qty' },
        examples: ['Invest PKR 50,000 in mutual funds'],
      },
      {
        id: 'income',
        name: 'Income',
        units: ['PKR', 'USD', 'EUR'],
        unitMeasurementTypes: { PKR: 'qty', USD: 'qty', EUR: 'qty' },
        examples: ['Earn PKR 500,000 this year'],
      },
      {
        id: 'spending',
        name: 'Spending',
        units: ['PKR', 'USD', 'EUR'],
        unitMeasurementTypes: { PKR: 'qty', USD: 'qty', EUR: 'qty' },
        examples: ['Keep monthly spending below PKR 50,000'],
      },
    ],
  },
  health: {
    id: 'health',
    name: 'Health',
    emoji: '🏃',
    color: '#F59E0B',
    lightBg: '#fffbeb',
    darkBg: '#1c1400',
    description: 'Fitness, nutrition, weight, sleep and medical goals',
    allUnits: ['kg', 'lbs', 'steps', 'minutes', 'hours', 'days', 'sessions', 'visits', '%'],
    subcategories: [
      {
        id: 'fitness',
        name: 'Fitness',
        units: ['minutes', 'sessions'],
        unitMeasurementTypes: { minutes: 'duration', sessions: 'frequency' },
        examples: ['Exercise for 300 minutes', 'Complete 100 workout sessions'],
      },
      {
        id: 'nutrition',
        name: 'Nutrition',
        units: ['kg', 'lbs', 'days'],
        unitMeasurementTypes: { kg: 'qty', lbs: 'qty', days: 'frequency' },
        examples: ['Lose 5 kg', 'Eat healthy for 30 days'],
      },
      {
        id: 'weight',
        name: 'Weight',
        units: ['kg', 'lbs'],
        unitMeasurementTypes: { kg: 'qty', lbs: 'qty' },
        examples: ['Reach 70 kg target weight'],
      },
      {
        id: 'sleep',
        name: 'Sleep',
        units: ['hours', 'days'],
        unitMeasurementTypes: {
          hours: 'duration',
          days: 'duration_of_consistency',
        },
        examples: ['Sleep 8 hours per night', 'Maintain 7+ hours sleep for 30 days'],
      },
      {
        id: 'medical',
        name: 'Medical',
        units: ['visits', 'days'],
        unitMeasurementTypes: {
          visits: 'frequency',
          days: 'duration_of_consistency',
        },
        examples: ['Complete 5 medical checkups', 'Follow treatment for 30 days'],
      },
    ],
  },
  lifestyle: {
    id: 'lifestyle',
    name: 'Lifestyle',
    emoji: '🌟',
    color: '#F472B6',
    lightBg: '#fdf2f8',
    darkBg: '#1f0815',
    description: 'Travel, hobbies, home organization and recreation',
    allUnits: ['trips', 'days', 'hours', 'sessions', 'items', 'tasks', 'events', 'activities'],
    subcategories: [
      {
        id: 'travel',
        name: 'Travel',
        units: ['trips', 'days'],
        unitMeasurementTypes: { trips: 'qty', days: 'duration' },
        examples: ['Visit 5 new cities', 'Spend 10 days travelling'],
      },
      {
        id: 'hobbies',
        name: 'Hobbies',
        units: ['hours', 'sessions'],
        unitMeasurementTypes: { hours: 'duration', sessions: 'frequency' },
        examples: ['Spend 50 hours painting', 'Complete 30 photography sessions'],
      },
      {
        id: 'home',
        name: 'Home',
        units: ['items', 'tasks'],
        unitMeasurementTypes: { items: 'qty', tasks: 'qty' },
        examples: ['Declutter 100 items', 'Complete 20 home improvement tasks'],
      },
      {
        id: 'recreation',
        name: 'Recreation',
        units: ['hours', 'events'],
        unitMeasurementTypes: { hours: 'duration', events: 'frequency' },
        examples: ['Spend 40 hours on recreation', 'Attend 10 recreational events'],
      },
    ],
  },
  learning: {
    id: 'learning',
    name: 'Learning',
    emoji: '📚',
    color: '#3B82F6',
    lightBg: '#eff6ff',
    darkBg: '#0a1930',
    description: 'Education, skill acquisition, reading and courses',
    allUnits: ['courses', 'hours', '%', 'books', 'pages', 'lessons', 'chapters'],
    subcategories: [
      {
        id: 'education',
        name: 'Education',
        units: ['courses', 'hours'],
        unitMeasurementTypes: { courses: 'qty', hours: 'duration' },
        examples: ['Complete 3 academic courses', 'Study 100 hours'],
      },
      {
        id: 'skills',
        name: 'Skills',
        units: ['hours', '%'],
        unitMeasurementTypes: {
          hours: 'duration',
          '%': 'completion_percentage',
        },
        examples: ['Practice coding for 100 hours', 'Reach 80% proficiency in JavaScript'],
      },
      {
        id: 'reading',
        name: 'Reading',
        units: ['books', 'pages', 'hours'],
        unitMeasurementTypes: { books: 'qty', pages: 'qty', hours: 'duration' },
        examples: ['Read 20 books', 'Read 2,000 pages', 'Read for 50 hours'],
      },
      {
        id: 'courses',
        name: 'Courses',
        units: ['courses', 'lessons', '%'],
        unitMeasurementTypes: {
          courses: 'qty',
          lessons: 'qty',
          '%': 'completion_percentage',
        },
        examples: ['Complete 5 online courses', 'Complete 50 lessons', 'Complete a course to 100%'],
      },
    ],
  },
  habit: {
    id: 'habit',
    name: 'Habit',
    emoji: '🎯',
    color: '#8B5CF6',
    lightBg: '#f5f3ff',
    darkBg: '#120d26',
    description: 'Build positive habits, quit bad habits and routine consistency',
    allUnits: ['days', 'times', 'streak', 'weeks'],
    subcategories: [
      {
        id: 'build_habit',
        name: 'Build Habit',
        units: ['days', 'times', 'streak'],
        unitMeasurementTypes: {
          days: 'duration_of_consistency',
          times: 'frequency',
          streak: 'duration_of_consistency',
        },
        examples: ['Exercise for 60 consecutive days', 'Exercise 4 times per week', 'Maintain 30-day streak'],
      },
      {
        id: 'quit_habit',
        name: 'Quit Habit',
        units: ['days', 'weeks'],
        unitMeasurementTypes: {
          days: 'duration_of_consistency',
          weeks: 'duration_of_consistency',
        },
        examples: ['Stay smoke-free for 90 days', 'Stay off junk food for 8 weeks'],
      },
      {
        id: 'daily_routine',
        name: 'Daily Routine',
        units: ['days', 'times'],
        unitMeasurementTypes: {
          days: 'duration_of_consistency',
          times: 'frequency',
        },
        examples: ['Follow morning routine for 30 days', 'Complete morning routine 25 times'],
      },
    ],
  },
  work: {
    id: 'work',
    name: 'Work',
    emoji: '💼',
    color: '#0ea5e9',
    lightBg: '#f0f9ff',
    darkBg: '#071b2e',
    description: 'Career development, project delivery, business growth & productivity',
    allUnits: ['hours', '%', 'projects', 'tasks', 'clients', 'PKR', 'USD', 'EUR', 'days'],
    subcategories: [
      {
        id: 'career',
        name: 'Career',
        units: ['hours', '%'],
        unitMeasurementTypes: {
          hours: 'duration',
          '%': 'completion_percentage',
        },
        examples: ['Spend 100 hours developing skills', 'Complete 80% career development plan'],
      },
      {
        id: 'projects',
        name: 'Projects',
        units: ['projects', 'tasks', '%'],
        unitMeasurementTypes: {
          projects: 'qty',
          tasks: 'qty',
          '%': 'completion_percentage',
        },
        examples: ['Complete 5 projects', 'Complete 50 project tasks', 'Complete project to 100%'],
      },
      {
        id: 'business',
        name: 'Business',
        units: ['clients', 'PKR', 'USD', 'EUR'],
        unitMeasurementTypes: {
          clients: 'qty',
          PKR: 'qty',
          USD: 'qty',
          EUR: 'qty',
        },
        examples: ['Get 20 new clients', 'Generate PKR 1 million revenue'],
      },
      {
        id: 'productivity',
        name: 'Productivity',
        units: ['tasks', 'hours', 'days'],
        unitMeasurementTypes: {
          tasks: 'qty',
          hours: 'duration',
          days: 'duration_of_consistency',
        },
        examples: ['Complete 200 work tasks', 'Complete 100 focused hours', 'Maintain productive routine for 30 days'],
      },
    ],
  },
  custom: {
    id: 'custom',
    name: 'Personal Growth',
    emoji: '🌱',
    color: '#EC4899',
    lightBg: '#fdf2f8',
    darkBg: '#1f0815',
    description: 'Mindfulness, self-development, personal milestones & general growth',
    allUnits: ['days', 'sessions', 'hours', 'books', 'courses', '%', 'tasks'],
    subcategories: [
      {
        id: 'personal_growth',
        name: 'Personal Growth',
        units: ['days', 'sessions', 'hours', 'books', 'courses', '%'],
        unitMeasurementTypes: {
          days: 'duration_of_consistency',
          sessions: 'frequency',
          hours: 'duration',
          books: 'qty',
          courses: 'qty',
          '%': 'completion_percentage',
        },
        examples: ['Practice mindfulness for 30 days', 'Complete 20 self-development sessions', 'Spend 50 hours on self-growth'],
      },
    ],
  },
};

// ─── Utility Helper Functions ──────────────────────────────────────────────────

export const getCategoryConfig = (type: string | undefined): CategoryConfig => {
  if (!type) return GOAL_CATEGORIES_CONFIG['custom'];
  const key = type.toLowerCase();
  return GOAL_CATEGORIES_CONFIG[key] || GOAL_CATEGORIES_CONFIG['custom'];
};

export const getSubcategories = (categoryType: string): SubcategoryConfig[] => {
  const cat = getCategoryConfig(categoryType);
  return cat.subcategories || [];
};

export const getSubcategoryUnits = (
  categoryType: string,
  subcategoryId: string,
): { units: string[]; unitTypes: Record<string, MeasurementType> } => {
  const subcats = getSubcategories(categoryType);
  const subcat = subcats.find(
    (s) => s.id.toLowerCase() === subcategoryId.toLowerCase() || s.name.toLowerCase() === subcategoryId.toLowerCase(),
  );

  if (subcat) {
    return {
      units: subcat.units,
      unitTypes: subcat.unitMeasurementTypes,
    };
  }

  // Fallback to category defaults
  const cat = getCategoryConfig(categoryType);
  return {
    units: cat.allUnits,
    unitTypes: {},
  };
};

export const getAllUnitsForCategory = (categoryType: string): string[] => {
  const cat = getCategoryConfig(categoryType);
  return cat.allUnits || ['units'];
};

export const getMeasurementType = (
  categoryType: string,
  subcategoryId: string | undefined,
  unit: string,
): MeasurementType => {
  if (unit === '%') return 'completion_percentage';
  if (unit === 'hours' || unit === 'minutes') return 'duration';
  if (unit === 'sessions' || unit === 'events' || unit === 'visits' || unit === 'times') return 'frequency';
  if (unit === 'streak' || unit === 'weeks') return 'duration_of_consistency';

  if (subcategoryId) {
    const subcatUnits = getSubcategoryUnits(categoryType, subcategoryId);
    if (subcatUnits.unitTypes[unit]) {
      return subcatUnits.unitTypes[unit];
    }
  }

  // General fallback by unit name
  if (unit === 'days') return 'duration_of_consistency';
  return 'qty';
};

// Calculate normalized 0–100% progress
export const calculateNormalizedProgress = (
  currentVal: number,
  targetVal: number,
  mType: MeasurementType,
  startVal: number = 0,
): number => {
  if (targetVal <= 0) return 0;

  let rawPct = 0;
  if (mType === 'completion_percentage') {
    rawPct = currentVal;
  } else if (startVal > 0 && startVal !== targetVal) {
    if (targetVal < startVal) {
      // Downwards target (e.g. weight loss 80kg -> 70kg)
      rawPct = ((startVal - currentVal) / (startVal - targetVal)) * 100;
    } else {
      // Upwards target with baseline
      rawPct = ((currentVal - startVal) / (targetVal - startVal)) * 100;
    }
  } else {
    rawPct = (currentVal / targetVal) * 100;
  }

  return Math.max(0, Math.min(100, Math.round(rawPct)));
};
