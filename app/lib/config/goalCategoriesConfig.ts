import { GoalType } from '../interface';

export type MeasurementType =
  | 'qty'
  | 'duration'
  | 'frequency'
  | 'completion_percentage'
  | 'duration_of_consistency';

export type QuestionType =
  | 'single_choice'
  | 'multi_choice'
  | 'text_input'
  | 'number_input'
  | 'date_or_choice'
  | 'amount_or_choice'
  | 'checkbox_milestones';

export interface QuestionOption {
  label: string;
  value: string;
  subText?: string;
  icon?: string;
  isCustomInput?: boolean;
}

export interface QuestionConfig {
  id: string;
  question: string;
  type: QuestionType;
  subtitle?: string;
  options?: QuestionOption[];
  placeholder?: string;
  unit?: string;
  required?: boolean;
  dependsOnField?: string;
  dependsOnValue?: string | string[];
}

export interface SubcategoryConfig {
  id: string;
  name: string;
  description?: string;
  units: string[];
  unitMeasurementTypes: Record<string, MeasurementType>;
  examples?: string[];
  questions: QuestionConfig[];
  disabled?: boolean;
  disabledMessage?: string;
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
  disabled?: boolean;
  disabledMessage?: string;
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
    description: 'Save money, reduce expenses, increase income & manage debts',
    allUnits: ['PKR', 'USD', 'EUR', '%', 'transactions', 'items'],
    subcategories: [
      {
        id: 'saving',
        name: 'Saving',
        description: 'Save a specific amount of money, usually through a Finance Fund.',
        units: ['PKR', 'USD', 'EUR'],
        unitMeasurementTypes: { PKR: 'qty', USD: 'qty', EUR: 'qty' },
        questions: [
          {
            id: 'target_amount',
            question: 'How much do you want to save?',
            type: 'amount_or_choice',
            options: [
              { label: 'PKR 50,000', value: '50000' },
              { label: 'PKR 100,000', value: '100000' },
              { label: 'PKR 500,000', value: '500000' },
              { label: 'PKR 1,000,000', value: '1000000' },
              { label: "I don't have an exact amount yet", value: 'flexible' },
            ],
          },
          {
            id: 'deadline',
            question: 'By when do you want to save it?',
            type: 'date_or_choice',
            options: [
              { label: 'In 1 Month', value: '1_month' },
              { label: 'In 3 Months', value: '3_months' },
              { label: 'In 6 Months', value: '6_months' },
              { label: 'In 1 Year', value: '1_year' },
              { label: 'Specific Date', value: 'specific_date', isCustomInput: true },
              { label: "I don't have a deadline", value: 'no_deadline' },
            ],
          },
          {
            id: 'purpose',
            question: 'What are you saving for?',
            subtitle: 'Optional purpose or target name',
            type: 'single_choice',
            options: [
              { label: 'Emergency Fund', value: 'Emergency Fund', icon: '🛡️' },
              { label: 'House / Property', value: 'House Fund', icon: '🏠' },
              { label: 'Car / Vehicle', value: 'Vehicle Fund', icon: '🚗' },
              { label: 'Vacation / Travel', value: 'Travel Fund', icon: '✈️' },
              { label: 'Investment', value: 'Investment Fund', icon: '📈' },
              { label: 'Other Purpose', value: 'other', isCustomInput: true },
            ],
          },
          {
            id: 'saving_frequency',
            question: 'How do you want to save?',
            type: 'single_choice',
            options: [
              { label: 'Flexible', value: 'flexible' },
              { label: 'Daily', value: 'daily' },
              { label: 'Weekly', value: 'weekly' },
              { label: 'Monthly', value: 'monthly' },
              { label: 'Custom', value: 'custom' },
            ],
          },
        ],
      },
      {
        id: 'reduce_expenses',
        name: 'Reduce Expenses',
        description: 'Reduce or eliminate existing expenses.',
        units: ['PKR', 'USD', 'EUR', '%'],
        unitMeasurementTypes: { PKR: 'qty', USD: 'qty', EUR: 'qty', '%': 'completion_percentage' },
        questions: [],
      },
      {
        id: 'increase_income',
        name: 'Increase Income',
        description: 'Grow your earnings across salary, business, or freelance.',
        units: ['PKR', 'USD', 'EUR'],
        unitMeasurementTypes: { PKR: 'qty', USD: 'qty', EUR: 'qty' },
        questions: [],
      },
      {
        id: 'manage_debt',
        name: 'Manage Debt',
        description: 'Track debt paybacks or money to receive.',
        units: ['PKR', 'USD', 'EUR'],
        unitMeasurementTypes: { PKR: 'qty', USD: 'qty', EUR: 'qty' },
        questions: [],
      },
    ],
  },
};

// ─── Utility Helper Functions ──────────────────────────────────────────────────

export const getCategoryConfig = (type: string | undefined): CategoryConfig => {
  if (!type) return GOAL_CATEGORIES_CONFIG['finance'];
  const key = type.toLowerCase();
  return GOAL_CATEGORIES_CONFIG[key] || GOAL_CATEGORIES_CONFIG['finance'];
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
  if (unit === 'sessions' || unit === 'events' || unit === 'visits' || unit === 'times' || unit === 'reps' || unit === 'trips' || unit === 'places') return 'frequency';
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
