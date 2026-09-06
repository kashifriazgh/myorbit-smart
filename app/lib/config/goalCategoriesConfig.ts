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
        questions: [
          {
            id: 'income_target_type',
            question: 'What do you want to increase?',
            type: 'single_choice',
            options: [
              { label: 'Overall income', value: 'Overall income' },
              { label: 'Salary', value: 'Salary' },
              { label: 'Freelance income', value: 'Freelance income' },
              { label: 'Business income', value: 'Business income' },
              { label: 'Other income', value: 'Other income' },
            ],
          },
          {
            id: 'current_income',
            question: 'What is your current income?',
            type: 'amount_or_choice',
            options: [
              { label: "I don't know", value: 'unknown' },
              { label: 'Input current amount', value: 'input_amount', isCustomInput: true },
            ],
          },
          {
            id: 'target_income',
            question: 'What income do you want to reach?',
            type: 'amount_or_choice',
            options: [
              { label: 'No exact target yet', value: 'flexible' },
              { label: 'Input target amount', value: 'target_amount', isCustomInput: true },
            ],
          },
          {
            id: 'deadline',
            question: 'By when?',
            type: 'date_or_choice',
            options: [
              { label: 'In 3 Months', value: '3_months' },
              { label: 'In 6 Months', value: '6_months' },
              { label: 'In 1 Year', value: '1_year' },
              { label: 'Specific Date', value: 'specific_date', isCustomInput: true },
              { label: 'No deadline', value: 'no_deadline' },
            ],
          },
        ],
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
  health: {
    id: 'health',
    name: 'Health',
    emoji: '🏃',
    color: '#F59E0B',
    lightBg: '#fffbeb',
    darkBg: '#1c1400',
    description: 'Fitness, nutrition, weight management, sleep and medical care',
    allUnits: ['kg', 'lbs', 'steps', 'minutes', 'hours', 'days', 'sessions', 'visits', '%', 'reps'],
    subcategories: [
      {
        id: 'fitness',
        name: 'Fitness',
        description: 'Physical exercise, sports, routines and activity tracking.',
        units: ['minutes', 'sessions', 'km', 'steps', 'reps', 'kg'],
        unitMeasurementTypes: {
          minutes: 'duration',
          sessions: 'frequency',
          km: 'qty',
          steps: 'qty',
          reps: 'qty',
          kg: 'qty',
        },
        questions: [
          {
            id: 'activity_type',
            question: 'What activity will you perform?',
            type: 'single_choice',
            options: [
              { label: 'Walking', value: 'Walking', icon: '🚶' },
              { label: 'Running', value: 'Running', icon: '🏃' },
              { label: 'Gym Workout', value: 'Gym', icon: '🏋️' },
              { label: 'Cycling', value: 'Cycling', icon: '🚴' },
              { label: 'Exercise routine', value: 'exercise_routine', icon: '🧘' },
              { label: 'Other Activity', value: 'other', isCustomInput: true },
            ],
          },
          {
            id: 'exercise_list',
            question: 'Select exercises for your routine:',
            type: 'multi_choice',
            dependsOnField: 'activity_type',
            dependsOnValue: 'exercise_routine',
            options: [
              { label: 'Pushups', value: 'Pushups' },
              { label: 'Squats', value: 'Squats' },
              { label: 'Planks', value: 'Planks' },
              { label: 'Pullups', value: 'Pullups' },
              { label: 'Lunges', value: 'Lunges' },
              { label: 'HIIT / Cardio', value: 'HIIT' },
              { label: 'Yoga & Stretching', value: 'Yoga' },
            ],
          },
          {
            id: 'frequency',
            question: 'How often do you want to do it?',
            type: 'single_choice',
            options: [
              { label: 'Daily', value: 'daily' },
              { label: '3 days/week', value: '3_days_week' },
              { label: '4 days/week', value: '4_days_week' },
              { label: '5 days/week', value: '5_days_week' },
              { label: 'Custom frequency', value: 'custom' },
            ],
          },
          {
            id: 'progress_metric',
            question: 'What describes best to measure the progress?',
            type: 'single_choice',
            options: [
              { label: 'Sessions', value: 'sessions' },
              { label: 'Minutes', value: 'minutes' },
              { label: 'Distance (km/mi)', value: 'distance' },
              { label: 'Steps', value: 'steps' },
              { label: 'Repetitions', value: 'reps' },
              { label: 'Weight lifted', value: 'weight_lifted' },
              { label: 'Other', value: 'other' },
            ],
          },
          {
            id: 'target_value',
            question: 'What is your target?',
            type: 'amount_or_choice',
            options: [
              { label: 'Just build consistency', value: 'consistency' },
              { label: 'Input Target Metric Value', value: 'custom_target', isCustomInput: true },
            ],
          },
          {
            id: 'duration',
            question: 'Until when?',
            type: 'date_or_choice',
            options: [
              { label: '15 Days', value: '15_days' },
              { label: '1 Month', value: '1_month' },
              { label: '2 Months', value: '2_months' },
              { label: '3 Months', value: '3_months' },
              { label: 'Specific Date', value: 'specific_date', isCustomInput: true },
            ],
          },
        ],
      },
      {
        id: 'nutrition',
        name: 'Nutrition',
        description: 'Track water, protein, calories, fast food or meal intake.',
        units: ['liters', 'grams', 'calories', 'items', 'meals', 'days'],
        unitMeasurementTypes: {
          liters: 'qty',
          grams: 'qty',
          calories: 'qty',
          items: 'qty',
          meals: 'frequency',
          days: 'duration_of_consistency',
        },
        questions: [
          {
            id: 'nutrition_goal',
            question: 'What do you want to improve?',
            type: 'single_choice',
            options: [
              { label: 'Increase something', value: 'increase' },
              { label: 'Reduce something', value: 'reduce' },
              { label: 'Limit something', value: 'limit' },
              { label: 'Maintain something', value: 'maintain' },
            ],
          },
          {
            id: 'track_item',
            question: 'What do you want to track?',
            type: 'single_choice',
            options: [
              { label: 'Water', value: 'Water', icon: '💧' },
              { label: 'Protein', value: 'Protein', icon: '🥩' },
              { label: 'Calories', value: 'Calories', icon: '🔥' },
              { label: 'Sugar', value: 'Sugar', icon: '🍬' },
              { label: 'Soft drinks', value: 'Soft drinks', icon: '🥤' },
              { label: 'Fast food', value: 'Fast food', icon: '🍔' },
              { label: 'Balanced Meals', value: 'Meals', icon: '🥗' },
            ],
          },
          {
            id: 'target_type',
            question: 'What is your target type?',
            type: 'single_choice',
            options: [
              { label: 'Exact Target Amount', value: 'exact_amount' },
              { label: 'Maximum Limit Amount', value: 'max_amount' },
              { label: 'Minimum Goal Amount', value: 'min_amount' },
              { label: 'Frequency / Consistency', value: 'frequency' },
            ],
          },
          {
            id: 'frequency',
            question: 'How often?',
            type: 'single_choice',
            options: [
              { label: 'Daily', value: 'daily' },
              { label: 'Weekly', value: 'weekly' },
              { label: 'Custom', value: 'custom' },
            ],
          },
          {
            id: 'duration',
            question: 'For how long?',
            type: 'date_or_choice',
            options: [
              { label: '30 Days', value: '30_days' },
              { label: '60 Days', value: '60_days' },
              { label: '90 Days', value: '90_days' },
              { label: 'End Date', value: 'end_date', isCustomInput: true },
            ],
          },
        ],
      },
      {
        id: 'weight',
        name: 'Weight',
        description: 'Lose, gain or maintain body weight.',
        units: ['kg', 'lbs'],
        unitMeasurementTypes: { kg: 'qty', lbs: 'qty' },
        questions: [
          {
            id: 'objective',
            question: 'What do you want to do?',
            type: 'single_choice',
            options: [
              { label: 'Lose weight', value: 'lose', icon: '📉' },
              { label: 'Gain weight', value: 'gain', icon: '📈' },
              { label: 'Maintain weight', value: 'maintain', icon: '⚖️' },
            ],
          },
          {
            id: 'current_weight',
            question: 'What is your current weight? (kg/lbs)',
            type: 'number_input',
            placeholder: 'e.g. 80',
            unit: 'kg',
          },
          {
            id: 'target_weight',
            question: 'What is your target weight? (kg/lbs)',
            type: 'number_input',
            placeholder: 'e.g. 72',
            unit: 'kg',
          },
          {
            id: 'deadline',
            question: 'By when?',
            type: 'date_or_choice',
            options: [
              { label: 'In 1 Month', value: '1_month' },
              { label: 'In 2 Months', value: '2_months' },
              { label: 'In 3 Months', value: '3_months' },
              { label: 'In 6 Months', value: '6_months' },
              { label: 'Specific Date', value: 'specific_date', isCustomInput: true },
              { label: 'No deadline', value: 'no_deadline' },
            ],
          },
          {
            id: 'logging_frequency',
            question: 'How often do you want to record your weight?',
            type: 'single_choice',
            options: [
              { label: 'Weekly', value: 'weekly' },
              { label: 'Biweekly', value: 'biweekly' },
              { label: 'Monthly', value: 'monthly' },
            ],
          },
        ],
      },
      {
        id: 'sleep',
        name: 'Sleep',
        description: 'Improve sleep duration, consistency, and bedtime routines.',
        units: ['hours', 'days', 'minutes'],
        unitMeasurementTypes: {
          hours: 'duration',
          days: 'duration_of_consistency',
          minutes: 'duration',
        },
        questions: [
          {
            id: 'objective',
            question: 'What do you want to improve?',
            type: 'single_choice',
            options: [
              { label: 'Sleep duration', value: 'Sleep duration' },
              { label: 'Sleep time', value: 'Sleep time' },
              { label: 'Wake-up time', value: 'Wake-up time' },
              { label: 'Sleep consistency', value: 'Sleep consistency' },
              { label: 'Overall sleep routine', value: 'Overall sleep routine' },
            ],
          },
          {
            id: 'target_duration',
            question: 'What is your target sleep duration?',
            type: 'single_choice',
            options: [
              { label: '7 Hours', value: '7' },
              { label: '7.5 Hours', value: '7.5' },
              { label: '8 Hours', value: '8' },
              { label: '8.5 Hours', value: '8.5' },
              { label: '9 Hours', value: '9' },
              { label: 'No specific duration', value: 'flexible' },
            ],
          },
          {
            id: 'sleep_time',
            question: 'What time do you want to sleep?',
            type: 'single_choice',
            options: [
              { label: '10:00 PM', value: '22:00' },
              { label: '10:30 PM', value: '22:30' },
              { label: '11:00 PM', value: '23:00' },
              { label: '11:30 PM', value: '23:30' },
              { label: '12:00 AM', value: '00:00' },
              { label: 'Flexible', value: 'flexible' },
            ],
          },
          {
            id: 'wake_time',
            question: 'What time do you want to wake up?',
            type: 'single_choice',
            options: [
              { label: '05:30 AM', value: '05:30' },
              { label: '06:00 AM', value: '06:00' },
              { label: '06:30 AM', value: '06:30' },
              { label: '07:00 AM', value: '07:00' },
              { label: '07:30 AM', value: '07:30' },
              { label: '08:00 AM', value: '08:00' },
              { label: 'Flexible', value: 'flexible' },
            ],
          },
          {
            id: 'days',
            question: 'Which days?',
            type: 'single_choice',
            options: [
              { label: 'Every day', value: 'everyday' },
              { label: 'Weekdays', value: 'weekdays' },
              { label: 'Weekends', value: 'weekends' },
              { label: 'Selected days', value: 'selected_days' },
            ],
          },
          {
            id: 'duration',
            question: 'For how long?',
            type: 'date_or_choice',
            options: [
              { label: '30 Days', value: '30_days' },
              { label: '60 Days', value: '60_days' },
              { label: '90 Days', value: '90_days' },
              { label: 'End Date', value: 'end_date', isCustomInput: true },
            ],
          },
        ],
      },
      {
        id: 'medical',
        name: 'Medical Care Plan',
        description: 'Track medical checkups, appointments & therapy routines.',
        units: ['visits', 'days', 'items'],
        unitMeasurementTypes: { visits: 'frequency', days: 'duration_of_consistency', items: 'qty' },
        questions: [], // 0 Questions — skipped to step 4!
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
    description: 'Education, skill development, books and online courses',
    allUnits: ['books', 'pages', 'chapters', 'sections', 'courses', 'lessons', 'modules', 'hours'],
    subcategories: [
      {
        id: 'reading',
        name: 'Reading',
        description: 'Read books, articles, novels or research papers.',
        units: ['pages', 'chapters', 'sections', 'books'],
        unitMeasurementTypes: {
          pages: 'qty',
          chapters: 'qty',
          sections: 'qty',
          books: 'qty',
        },
        questions: [
          {
            id: 'material_type',
            question: 'What do you want to read?',
            type: 'single_choice',
            options: [
              { label: 'Book', value: 'Book', icon: '📖' },
              { label: 'Article', value: 'Article', icon: '📰' },
              { label: 'Novel', value: 'Novel', icon: '📚' },
              { label: 'Research Paper', value: 'Research Paper', icon: '📄' },
            ],
          },
          {
            id: 'unit_type',
            question: 'How much is there to read?',
            type: 'single_choice',
            options: [
              { label: 'Pages', value: 'Pages' },
              { label: 'Chapters', value: 'Chapters' },
              { label: 'Sections', value: 'Sections' },
              { label: 'Entire Material', value: 'Entire Material' },
            ],
          },
          {
            id: 'total_quantity',
            question: 'What is your target quantity?',
            type: 'amount_or_choice',
            options: [
              { label: 'Finish the entire material', value: 'finish_all' },
              { label: 'Input total number', value: 'custom_number', isCustomInput: true },
            ],
          },
          {
            id: 'deadline',
            question: 'By when?',
            type: 'date_or_choice',
            options: [
              { label: 'In 1 Month', value: '1_month' },
              { label: 'In 2 Months', value: '2_months' },
              { label: 'In 3 Months', value: '3_months' },
              { label: 'Specific Date', value: 'specific_date', isCustomInput: true },
              { label: 'No deadline', value: 'no_deadline' },
            ],
          },
          {
            id: 'frequency',
            question: 'How often do you want to read?',
            type: 'single_choice',
            options: [
              { label: 'Daily', value: 'daily' },
              { label: '3 days/week', value: '3_days_week' },
              { label: '5 days/week', value: '5_days_week' },
              { label: 'Flexible', value: 'flexible' },
            ],
          },
          {
            id: 'preferred_time',
            question: 'Preferred reading time?',
            type: 'single_choice',
            options: [
              { label: 'Morning', value: 'Morning', icon: '🌅' },
              { label: 'Afternoon', value: 'Afternoon', icon: '☀️' },
              { label: 'Evening', value: 'Evening', icon: '🌆' },
              { label: 'Night', value: 'Night', icon: '🌙' },
              { label: 'Flexible', value: 'Flexible', icon: '⏱️' },
            ],
          },
        ],
      },
      {
        id: 'courses',
        name: 'Courses',
        description: 'Complete online/offline courses, lectures, or modules.',
        units: ['courses', 'lessons', 'modules', 'videos', 'chapters'],
        unitMeasurementTypes: {
          courses: 'qty',
          lessons: 'qty',
          modules: 'qty',
          videos: 'qty',
          chapters: 'qty',
        },
        questions: [
          {
            id: 'course_name',
            question: 'What course do you want to complete?',
            type: 'text_input',
            placeholder: 'e.g. Next.js Masterclass, Machine Learning',
            required: true,
          },
          {
            id: 'learning_mode',
            question: 'How will you take it?',
            type: 'single_choice',
            options: [
              { label: 'Online', value: 'Online', icon: '💻' },
              { label: 'Offline', value: 'Offline', icon: '🏫' },
              { label: 'Self-study', value: 'Self-study', icon: '📖' },
              { label: 'Other', value: 'Other' },
            ],
          },
          {
            id: 'unit_name',
            question: 'What do you call the learning units in this course?',
            type: 'single_choice',
            options: [
              { label: 'Lecture', value: 'Lecture' },
              { label: 'Video', value: 'Video' },
              { label: 'Lesson', value: 'Lesson' },
              { label: 'Session', value: 'Session' },
              { label: 'Module', value: 'Module' },
              { label: 'Chapter', value: 'Chapter' },
              { label: 'Other', value: 'Other', isCustomInput: true },
            ],
          },
          {
            id: 'total_units',
            question: 'How many learning units are there?',
            type: 'amount_or_choice',
            options: [
              { label: '10', value: '10' },
              { label: '20', value: '20' },
              { label: '30', value: '30' },
              { label: '50', value: '50' },
              { label: "I don't know", value: 'unknown' },
              { label: 'Input exact number', value: 'custom_number', isCustomInput: true },
            ],
          },
          {
            id: 'deadline',
            question: 'By when do you want to complete it?',
            type: 'date_or_choice',
            options: [
              { label: 'In 1 Month', value: '1_month' },
              { label: 'In 3 Months', value: '3_months' },
              { label: 'In 6 Months', value: '6_months' },
              { label: 'Specific Date', value: 'specific_date', isCustomInput: true },
              { label: 'No deadline', value: 'no_deadline' },
            ],
          },
        ],
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
    description: 'Build positive habits, quit unwanted behaviors & routine consistency',
    allUnits: ['days', 'times', 'streak', 'weeks'],
    subcategories: [
      {
        id: 'build',
        name: 'Build',
        description: 'Build a new positive daily or weekly habit.',
        units: ['days', 'times', 'streak'],
        unitMeasurementTypes: {
          days: 'duration_of_consistency',
          times: 'frequency',
          streak: 'duration_of_consistency',
        },
        questions: [
          {
            id: 'habit_name',
            question: 'What habit do you want to build?',
            type: 'single_choice',
            options: [
              { label: 'Drink 3L Water', value: 'Drink 3L Water', icon: '💧' },
              { label: 'Morning Meditation', value: 'Morning Meditation', icon: '🧘' },
              { label: 'Daily Journaling', value: 'Daily Journaling', icon: '✍️' },
              { label: 'Read 20 mins', value: 'Read 20 mins', icon: '📖' },
              { label: 'Morning Walk', value: 'Morning Walk', icon: '🚶' },
              { label: 'Custom Habit', value: 'custom', isCustomInput: true },
            ],
          },
          {
            id: 'frequency',
            question: 'How often do you want to perform it?',
            type: 'single_choice',
            options: [
              { label: 'Daily', value: 'daily' },
              { label: '3 days/week', value: '3_days_week' },
              { label: '5 days/week', value: '5_days_week' },
              { label: 'Custom frequency', value: 'custom' },
            ],
          },
          {
            id: 'duration',
            question: 'For how long do you want to build it?',
            type: 'date_or_choice',
            options: [
              { label: '21 Days', value: '21_days' },
              { label: '30 Days', value: '30_days' },
              { label: '60 Days', value: '60_days' },
              { label: '90 Days', value: '90_days' },
              { label: 'Specific End Date', value: 'end_date', isCustomInput: true },
            ],
          },
        ],
      },
      {
        id: 'quit',
        name: 'Quit',
        description: 'Reduce or eliminate a bad habit.',
        units: ['days', 'weeks', 'times'],
        unitMeasurementTypes: {
          days: 'duration_of_consistency',
          weeks: 'duration_of_consistency',
          times: 'frequency',
        },
        questions: [
          {
            id: 'habit_to_quit',
            question: 'What habit/behavior do you want to reduce or quit?',
            type: 'single_choice',
            options: [
              { label: 'Smoking / Vaping', value: 'Smoking', icon: '🚭' },
              { label: 'Junk Food', value: 'Junk Food', icon: '🍔' },
              { label: 'Late Night Screen Time', value: 'Late Night Screen Time', icon: '📱' },
              { label: 'Sugary Drinks', value: 'Sugary Drinks', icon: '🥤' },
              { label: 'Procrastination', value: 'Procrastination', icon: '⏰' },
              { label: 'Custom Behavior', value: 'custom', isCustomInput: true },
            ],
          },
          {
            id: 'current_frequency',
            question: 'How often does it currently happen?',
            type: 'single_choice',
            options: [
              { label: 'Daily', value: 'daily' },
              { label: '3-5 times/week', value: '3-5_week' },
              { label: '1-2 times/week', value: '1-2_week' },
              { label: 'Unknown', value: 'unknown' },
            ],
          },
          {
            id: 'goal_outcome',
            question: 'What do you want to achieve?',
            type: 'single_choice',
            options: [
              { label: 'Completely stop', value: 'completely_stop' },
              { label: 'Reduce frequency', value: 'reduce_frequency' },
              { label: 'Limit to X times', value: 'limit_times' },
            ],
          },
          {
            id: 'deadline',
            question: 'By when?',
            type: 'date_or_choice',
            options: [
              { label: '30 Days', value: '30_days' },
              { label: '60 Days', value: '60_days' },
              { label: 'Specific Date', value: 'specific_date', isCustomInput: true },
              { label: 'No deadline', value: 'no_deadline' },
            ],
          },
        ],
      },
      {
        id: 'daily_routine',
        name: 'Daily Routine',
        description: 'Establish structured morning, evening, or work routines.',
        units: ['days', 'weeks'],
        unitMeasurementTypes: {
          days: 'duration_of_consistency',
          weeks: 'duration_of_consistency',
        },
        questions: [
          {
            id: 'routine_type',
            question: 'What routine do you want to build?',
            type: 'single_choice',
            options: [
              { label: 'Morning routine', value: 'Morning routine', icon: '🌅' },
              { label: 'Evening routine', value: 'Evening routine', icon: '🌆' },
              { label: 'Work routine', value: 'Work routine', icon: '💼' },
              { label: 'Study routine', value: 'Study routine', icon: '📚' },
              { label: 'Custom routine', value: 'custom', isCustomInput: true },
            ],
          },
          {
            id: 'duration',
            question: 'For how long?',
            type: 'date_or_choice',
            options: [
              { label: '30 Days', value: '30_days' },
              { label: '60 Days', value: '60_days' },
              { label: '90 Days', value: '90_days' },
              { label: 'Custom Date Range', value: 'custom_range', isCustomInput: true },
            ],
          },
        ],
      },
    ],
  },
  work: {
    id: 'work',
    name: 'Work',
    emoji: '💼',
    color: '#0EA5E9',
    lightBg: '#f0f9ff',
    darkBg: '#071b2e',
    description: 'Career advancement, project completion, business metrics & productivity',
    allUnits: ['hours', '%', 'projects', 'tasks', 'clients', 'PKR', 'USD', 'EUR', 'milestones'],
    subcategories: [
      {
        id: 'career',
        name: 'Career',
        description: 'Promotion, salary improvement, or role transitions.',
        units: ['milestones', '%', 'months'],
        unitMeasurementTypes: {
          milestones: 'qty',
          '%': 'completion_percentage',
          months: 'duration',
        },
        questions: [
          {
            id: 'career_outcome',
            question: 'What career outcome do you want?',
            type: 'single_choice',
            options: [
              { label: 'Promotion', value: 'Promotion', icon: '📈' },
              { label: 'New position', value: 'New position', icon: '🎯' },
              { label: 'Career transition', value: 'Career transition', icon: '🔄' },
              { label: 'New profession', value: 'New profession', icon: '🚀' },
              { label: 'Salary improvement', value: 'Salary improvement', icon: '💵' },
              { label: 'Other', value: 'Other' },
            ],
          },
          {
            id: 'current_level',
            question: 'What is your current position/level?',
            type: 'text_input',
            placeholder: 'e.g. Junior Developer, Mid Marketing Specialist',
          },
          {
            id: 'target_level',
            question: 'What position/level do you want to reach?',
            type: 'text_input',
            placeholder: 'e.g. Senior Fullstack Engineer, Team Lead',
          },
          {
            id: 'deadline',
            question: 'By when?',
            type: 'date_or_choice',
            options: [
              { label: 'In 3 Months', value: '3_months' },
              { label: 'In 6 Months', value: '6_months' },
              { label: 'In 1 Year', value: '1_year' },
              { label: 'Specific Date', value: 'specific_date', isCustomInput: true },
              { label: 'No deadline', value: 'no_deadline' },
            ],
          },
          {
            id: 'enabling_factors',
            question: 'What will help you achieve it? (Becomes milestones)',
            type: 'checkbox_milestones',
            options: [
              { label: 'Skills Acquisition', value: 'Skills' },
              { label: 'Certification', value: 'Certification' },
              { label: 'Experience & Portfolio', value: 'Experience' },
              { label: 'Key Projects Completed', value: 'Projects' },
              { label: 'Job Applications Sent', value: 'Applications' },
              { label: 'Networking & Mentorship', value: 'Networking' },
            ],
          },
        ],
      },
      {
        id: 'project',
        name: 'Project',
        description: 'Deliver specific projects with tasks and deliverables.',
        units: ['tasks', 'deliverables', 'milestones', '%'],
        unitMeasurementTypes: {
          tasks: 'qty',
          deliverables: 'qty',
          milestones: 'qty',
          '%': 'completion_percentage',
        },
        questions: [
          {
            id: 'project_name',
            question: 'What project do you want to complete?',
            type: 'text_input',
            placeholder: 'e.g. Website Redesign, Mobile App Launch',
            required: true,
          },
          {
            id: 'desired_outcome',
            question: 'What is the desired outcome?',
            type: 'text_input',
            placeholder: 'Brief summary of successful project delivery',
          },
          {
            id: 'deadline',
            question: 'When should it be completed?',
            type: 'date_or_choice',
            options: [
              { label: 'In 1 Month', value: '1_month' },
              { label: 'In 3 Months', value: '3_months' },
              { label: 'In 6 Months', value: '6_months' },
              { label: 'Specific Deadline', value: 'deadline_date', isCustomInput: true },
              { label: 'No deadline', value: 'no_deadline' },
            ],
          },
          {
            id: 'measurement_method',
            question: 'How will you measure completion?',
            type: 'single_choice',
            options: [
              { label: 'Tasks Completed', value: 'Tasks' },
              { label: 'Deliverables Handed Over', value: 'Deliverables' },
              { label: 'Milestones Reached', value: 'Milestones' },
              { label: 'Percentage Manually', value: 'Percentage' },
              { label: 'Custom Metric', value: 'Custom' },
            ],
          },
        ],
      },
      {
        id: 'business',
        name: 'Business',
        description: 'Grow revenue, acquire customers, launch products & expand.',
        units: ['PKR', 'USD', 'clients', 'sales', 'milestones'],
        unitMeasurementTypes: {
          PKR: 'qty',
          USD: 'qty',
          clients: 'qty',
          sales: 'qty',
          milestones: 'qty',
        },
        questions: [
          {
            id: 'business_outcome',
            question: 'What business outcome do you want?',
            type: 'single_choice',
            options: [
              { label: 'Increase revenue', value: 'revenue', icon: '📈' },
              { label: 'Get customers', value: 'customers', icon: '👥' },
              { label: 'Increase sales', value: 'sales', icon: '🛒' },
              { label: 'Launch product/service', value: 'launch', icon: '🚀' },
              { label: 'Expand business', value: 'expand', icon: '🌐' },
              { label: 'Other', value: 'other' },
            ],
          },
          {
            id: 'current_revenue',
            question: 'Current revenue?',
            type: 'amount_or_choice',
            dependsOnField: 'business_outcome',
            dependsOnValue: ['revenue', 'sales'],
            options: [
              { label: 'Input Current Revenue', value: 'custom_amount', isCustomInput: true },
            ],
          },
          {
            id: 'target_revenue',
            question: 'Target revenue?',
            type: 'amount_or_choice',
            dependsOnField: 'business_outcome',
            dependsOnValue: ['revenue', 'sales'],
            options: [
              { label: 'Input Target Revenue', value: 'custom_amount', isCustomInput: true },
            ],
          },
          {
            id: 'current_customers',
            question: 'Current customers?',
            type: 'amount_or_choice',
            dependsOnField: 'business_outcome',
            dependsOnValue: 'customers',
            options: [
              { label: 'Input Current Customers', value: 'custom_amount', isCustomInput: true },
            ],
          },
          {
            id: 'target_customers',
            question: 'Target customers?',
            type: 'amount_or_choice',
            dependsOnField: 'business_outcome',
            dependsOnValue: 'customers',
            options: [
              { label: 'Input Target Customers', value: 'custom_amount', isCustomInput: true },
            ],
          },
          {
            id: 'product_launch_name',
            question: 'What product/service are you launching?',
            type: 'text_input',
            dependsOnField: 'business_outcome',
            dependsOnValue: 'launch',
            placeholder: 'e.g. SaaS App, E-commerce Store',
          },
          {
            id: 'deadline',
            question: 'By when?',
            type: 'date_or_choice',
            options: [
              { label: 'In 3 Months', value: '3_months' },
              { label: 'In 6 Months', value: '6_months' },
              { label: 'In 1 Year', value: '1_year' },
              { label: 'Specific Date', value: 'specific_date', isCustomInput: true },
              { label: 'No deadline', value: 'no_deadline' },
            ],
          },
        ],
      },
    ],
  },
  personal_growth: {
    id: 'personal_growth',
    name: 'Personal Growth',
    emoji: '🌱',
    color: '#EC4899',
    lightBg: '#fdf2f8',
    darkBg: '#1f0815',
    description: 'Confidence, communication skills, relationships & self-improvement',
    allUnits: ['sessions', 'conversations', 'days', 'actions', 'tasks'],
    subcategories: [
      {
        id: 'confidence',
        name: 'Confidence',
        description: 'Build confidence in public speaking, social situations or decisions.',
        units: ['tasks', 'sessions', 'days'],
        unitMeasurementTypes: {
          tasks: 'qty',
          sessions: 'frequency',
          days: 'duration_of_consistency',
        },
        questions: [
          {
            id: 'confidence_area',
            question: 'What area do you want to become more confident in?',
            type: 'single_choice',
            options: [
              { label: 'Public speaking', value: 'Public speaking', icon: '🎤' },
              { label: 'Social interaction', value: 'Social interaction', icon: '🤝' },
              { label: 'Decision making', value: 'Decision making', icon: '🧠' },
              { label: 'Work & Leadership', value: 'Work', icon: '💼' },
              { label: 'Communication', value: 'Communication', icon: '💬' },
              { label: 'Other', value: 'Other' },
            ],
          },
          {
            id: 'desired_capability',
            question: 'What do you want to be able to do?',
            type: 'text_input',
            placeholder: 'e.g. Speak smoothly in meetings, make quick decisions',
          },
        ],
      },
      {
        id: 'communication',
        name: 'Communication',
        description: 'Improve speaking, writing, presentations or active listening.',
        units: ['sessions', 'conversations', 'days'],
        unitMeasurementTypes: {
          sessions: 'frequency',
          conversations: 'frequency',
          days: 'duration_of_consistency',
        },
        questions: [
          {
            id: 'skill_type',
            question: 'What communication skill do you want to improve?',
            type: 'single_choice',
            options: [
              { label: 'Speaking', value: 'Speaking', icon: '🗣️' },
              { label: 'Writing', value: 'Writing', icon: '✍️' },
              { label: 'Presentation', value: 'Presentation', icon: '📊' },
              { label: 'Conversation', value: 'Conversation', icon: '💬' },
              { label: 'Listening', value: 'Listening', icon: '👂' },
              { label: 'Other', value: 'Other' },
            ],
          },
          {
            id: 'desired_outcome',
            question: 'What do you want to achieve?',
            type: 'text_input',
            placeholder: 'Briefly describe your communication goal',
          },
          {
            id: 'practice_method',
            question: 'How will you practice?',
            type: 'single_choice',
            options: [
              { label: 'Practice sessions', value: 'Practice sessions' },
              { label: 'Conversations', value: 'Conversations' },
              { label: 'Presentations', value: 'Presentations' },
              { label: 'Writing exercises', value: 'Writing exercises' },
              { label: 'Courses', value: 'Courses' },
            ],
          },
          {
            id: 'frequency',
            question: 'How often?',
            type: 'single_choice',
            options: [
              { label: 'Daily', value: 'daily' },
              { label: 'Weekly', value: 'weekly' },
              { label: 'Custom', value: 'custom' },
            ],
          },
          {
            id: 'deadline',
            question: 'By when?',
            type: 'date_or_choice',
            options: [
              { label: 'In 1 Month', value: '1_month' },
              { label: 'In 3 Months', value: '3_months' },
              { label: 'Specific Date', value: 'specific_date', isCustomInput: true },
              { label: 'No deadline', value: 'no_deadline' },
            ],
          },
        ],
      },
      {
        id: 'relationships',
        name: 'Relationships',
        description: 'Nurture connections with family, friends, partners, or colleagues.',
        units: ['actions', 'calls', 'meetings', 'days'],
        unitMeasurementTypes: {
          actions: 'frequency',
          calls: 'frequency',
          meetings: 'frequency',
          days: 'duration_of_consistency',
        },
        questions: [
          {
            id: 'relationship_area',
            question: 'What relationship area do you want to improve?',
            type: 'single_choice',
            options: [
              { label: 'Family', value: 'Family', icon: '👨‍👩‍👧' },
              { label: 'Friends', value: 'Friends', icon: '🧑‍🤝‍🧑' },
              { label: 'Partner', value: 'Partner', icon: '❤️' },
              { label: 'Professional relationships', value: 'Professional', icon: '💼' },
              { label: 'Social connections', value: 'Social', icon: '🌐' },
            ],
          },
          {
            id: 'improvement_desc',
            question: 'What do you want to improve?',
            type: 'text_input',
            placeholder: 'e.g. Spend more quality time together',
          },
          {
            id: 'action_types',
            question: 'What actions will help?',
            type: 'single_choice',
            options: [
              { label: 'Phone / Video Calls', value: 'Calls' },
              { label: 'In-person Meetings', value: 'Meetings' },
              { label: 'Visits & Trips', value: 'Visits' },
              { label: 'Shared Activities', value: 'Activities' },
              { label: 'Messages & Checking In', value: 'Messages' },
            ],
          },
          {
            id: 'frequency',
            question: 'How often?',
            type: 'single_choice',
            options: [
              { label: 'Daily', value: 'daily' },
              { label: 'Weekly', value: 'weekly' },
              { label: 'Monthly', value: 'monthly' },
              { label: 'Custom', value: 'custom' },
            ],
          },
          {
            id: 'duration',
            question: 'For how long?',
            type: 'date_or_choice',
            options: [
              { label: '30 Days', value: '30_days' },
              { label: '60 Days', value: '60_days' },
              { label: 'Custom Date Range', value: 'custom_range', isCustomInput: true },
            ],
          },
        ],
      },
    ],
  },
  travel: {
    id: 'travel',
    name: 'Travel',
    emoji: '✈️',
    color: '#06B6D4',
    lightBg: '#ecfeff',
    darkBg: '#042f2e',
    description: 'Plan trips, explore cities, track travel frequency & travel days',
    allUnits: ['trips', 'places', 'days', 'cities', 'countries'],
    subcategories: [
      {
        id: 'trip',
        name: 'Trip',
        description: 'Plan a specific trip with pre-trip checklist & milestones.',
        units: ['milestones', 'days', 'PKR', 'USD'],
        unitMeasurementTypes: {
          milestones: 'qty',
          days: 'duration',
          PKR: 'qty',
          USD: 'qty',
        },
        questions: [
          {
            id: 'destination',
            question: 'Where do you want to go?',
            type: 'text_input',
            placeholder: 'e.g. Tokyo, Paris, Hunza Valley',
            required: true,
          },
          {
            id: 'purpose',
            question: 'What is the purpose?',
            type: 'single_choice',
            options: [
              { label: 'Vacation', value: 'Vacation', icon: '🏖️' },
              { label: 'Family', value: 'Family', icon: '👨‍👩‍👧' },
              { label: 'Business', value: 'Business', icon: '💼' },
              { label: 'Religious', value: 'Religious', icon: '🕌' },
              { label: 'Adventure', value: 'Adventure', icon: '🏔️' },
              { label: 'Other', value: 'Other' },
            ],
          },
          {
            id: 'dates',
            question: 'When do you want to travel?',
            type: 'date_or_choice',
            options: [
              { label: 'Next Month', value: '1_month' },
              { label: 'In 3 Months', value: '3_months' },
              { label: 'In 6 Months', value: '6_months' },
              { label: 'Specific Start & End Date', value: 'specific_dates', isCustomInput: true },
              { label: 'Flexible', value: 'flexible' },
            ],
          },
          {
            id: 'travelers',
            question: 'Who is travelling?',
            type: 'single_choice',
            options: [
              { label: 'Alone', value: 'Alone' },
              { label: 'Family', value: 'Family' },
              { label: 'Friends', value: 'Friends' },
              { label: 'Other', value: 'Other' },
            ],
          },
          {
            id: 'budget',
            question: 'Do you have a travel budget?',
            type: 'amount_or_choice',
            options: [
              { label: 'No fixed budget', value: 'no_budget' },
              { label: 'Input Budget Amount', value: 'custom_amount', isCustomInput: true },
            ],
          },
          {
            id: 'pre_trip_milestones',
            question: 'What needs to be completed before the trip?',
            type: 'checkbox_milestones',
            options: [
              { label: 'Save Budget', value: 'Budget' },
              { label: 'Apply Visa', value: 'Visa' },
              { label: 'Renew Passport', value: 'Passport' },
              { label: 'Book Flight Tickets', value: 'Tickets' },
              { label: 'Book Hotel / Stay', value: 'Hotel' },
              { label: 'Arrange Transport', value: 'Transport' },
              { label: 'Packing Complete', value: 'Packing' },
            ],
          },
        ],
      },
      {
        id: 'explore',
        name: 'Explore',
        description: 'Explore cities, countries, landmarks, or new places.',
        units: ['places', 'cities', 'countries', 'landmarks'],
        unitMeasurementTypes: {
          places: 'qty',
          cities: 'qty',
          countries: 'qty',
          landmarks: 'qty',
        },
        questions: [
          {
            id: 'explore_type',
            question: 'What do you want to explore?',
            type: 'single_choice',
            options: [
              { label: 'City', value: 'City' },
              { label: 'Country', value: 'Country' },
              { label: 'Region', value: 'Region' },
              { label: 'Multiple destinations', value: 'Multiple destinations' },
            ],
          },
          {
            id: 'target_places',
            question: 'How many places do you want to visit?',
            type: 'amount_or_choice',
            options: [
              { label: '3 Places', value: '3' },
              { label: '5 Places', value: '5' },
              { label: '10 Places', value: '10' },
              { label: 'No fixed number', value: 'flexible' },
              { label: 'Input Number', value: 'custom_number', isCustomInput: true },
            ],
          },
          {
            id: 'deadline',
            question: 'By when?',
            type: 'date_or_choice',
            options: [
              { label: 'This Year', value: 'this_year' },
              { label: 'Next 6 Months', value: '6_months' },
              { label: 'Specific Date', value: 'specific_date', isCustomInput: true },
              { label: 'No deadline', value: 'no_deadline' },
            ],
          },
          {
            id: 'visit_definition',
            question: 'What counts as a place visited?',
            type: 'single_choice',
            options: [
              { label: 'City', value: 'City' },
              { label: 'Tourist attraction', value: 'Tourist attraction' },
              { label: 'Country', value: 'Country' },
              { label: 'Landmark', value: 'Landmark' },
              { label: 'Other', value: 'Other' },
            ],
          },
        ],
      },
      {
        id: 'travel_frequency',
        name: 'Travel Frequency',
        description: 'Take a specific number of trips over a period.',
        units: ['trips'],
        unitMeasurementTypes: { trips: 'frequency' },
        questions: [
          {
            id: 'trips_count',
            question: 'How many trips do you want to take?',
            type: 'amount_or_choice',
            options: [
              { label: '2 Trips', value: '2' },
              { label: '4 Trips', value: '4' },
              { label: '6 Trips', value: '6' },
              { label: 'No fixed number', value: 'flexible' },
              { label: 'Input Number', value: 'custom_number', isCustomInput: true },
            ],
          },
          {
            id: 'period',
            question: 'During what period?',
            type: 'single_choice',
            options: [
              { label: 'This year', value: 'this_year' },
              { label: 'Next 6 months', value: '6_months' },
              { label: 'Custom dates', value: 'custom_dates' },
            ],
          },
          {
            id: 'trip_type',
            question: 'What type of trips?',
            type: 'single_choice',
            options: [
              { label: 'Any', value: 'Any' },
              { label: 'Domestic', value: 'Domestic' },
              { label: 'International', value: 'International' },
              { label: 'Specific type', value: 'Specific' },
            ],
          },
        ],
      },
      {
        id: 'travel_days',
        name: 'Travel Days',
        description: 'Spend a target total number of days travelling.',
        units: ['days'],
        unitMeasurementTypes: { days: 'duration' },
        questions: [
          {
            id: 'target_days',
            question: 'How many travel days do you want?',
            type: 'amount_or_choice',
            options: [
              { label: '7 Days', value: '7' },
              { label: '14 Days', value: '14' },
              { label: '30 Days', value: '30' },
              { label: 'No exact target', value: 'flexible' },
              { label: 'Input Days', value: 'custom_days', isCustomInput: true },
            ],
          },
          {
            id: 'period',
            question: 'During what period?',
            type: 'single_choice',
            options: [
              { label: 'This year', value: 'this_year' },
              { label: 'Next 6 months', value: '6_months' },
              { label: 'Custom Date Range', value: 'custom_range' },
            ],
          },
          {
            id: 'day_type',
            question: 'What type of travel days?',
            type: 'single_choice',
            options: [
              { label: 'Any', value: 'Any' },
              { label: 'Domestic', value: 'Domestic' },
              { label: 'International', value: 'International' },
            ],
          },
        ],
      },
    ],
  },
};

// ─── Utility Helper Functions ──────────────────────────────────────────────────

export const getCategoryConfig = (type: string | undefined): CategoryConfig => {
  if (!type) return GOAL_CATEGORIES_CONFIG['personal_growth'] || GOAL_CATEGORIES_CONFIG['finance'];
  const key = type.toLowerCase();
  if (key === 'custom') return GOAL_CATEGORIES_CONFIG['personal_growth'] || GOAL_CATEGORIES_CONFIG['finance'];
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
