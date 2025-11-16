/**
 * Utility function to detect and extract mention type from editor content
 */

export type ContentType =
  | 'task'
  | 'journal'
  | 'schedule'
  | 'expense'
  | 'shopping'
  | 'income'
  | 'streak'
  | 'timetable'
  | 'idea'
  | 'goal'
  | 'money'
  | null;

/**
 * Detects the mention type from editor content
 * Looks for @mention patterns in the text
 */
export function detectMentionType(content: string): ContentType {
  if (!content) return null;

  // Convert content to lowercase for matching
  const lowerContent = content.toLowerCase();

  // Check for mentions (case-insensitive)
  const mentionPatterns = {
    task: ['@task', '@todo', '@todos'],
    journal: ['@journal', '@journals', '@entry'],
    schedule: ['@schedule', '@schedules', '@event', '@meeting'],
    expense: ['@expense', '@expenditure', '@expenses', '@expenditures'],
    shopping: ['@shopping', '@shoppinglist', '@shop', '@item'],
    income: [
      '@income',
      '@incomesource',
      '@incomesources',
      '@salary',
      '@earnings',
    ],
    streak: ['@streak', '@streaks', '@habit', '@habits'],
    timetable: ['@timetable', '@timetables', '@schedule', '@routine'],
    idea: ['@idea', '@ideas', '@thought', '@thoughts'],
    goal: ['@goal', '@goals', '@target', '@targets'],
    money: ['@money', '@addmoney', '@cash', '@funds'],
  };

  // Check each type
  for (const [type, patterns] of Object.entries(mentionPatterns)) {
    if (patterns.some((pattern) => lowerContent.includes(pattern))) {
      return type as ContentType;
    }
  }

  return null;
}

/**
 * Removes mention tags from content to get clean text for AI processing
 */
export function cleanContentForAI(content: string): string {
  if (!content) return '';

  // Remove @mentions and their labels
  return content
    .replace(
      /@(task|todo|todos|journal|journals|entry|schedule|schedules|event|meeting|expense|expenditure|expenses|expenditures|shopping|shoppinglist|shop|item|income|incomesource|incomesources|salary|earnings|streak|streaks|habit|habits|timetable|timetables|routine|idea|ideas|thought|thoughts|goal|goals|target|targets|money|addmoney|cash|funds)\b/gi,
      ''
    )
    .trim();
}
