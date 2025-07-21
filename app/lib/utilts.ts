export function formatCurrency(
  amount: number,
  currency: 'PKR' | 'USD'
): string {
  if (currency === 'USD') {
    return `$${amount.toFixed(2)}`; // supports cents
  }

  // Default is PKR
  return `Rs ${amount.toLocaleString('en-PK', {
    maximumFractionDigits: 0,
  })}`;
}

// lib/utils/timeAnalysis.ts

export function extractHoursAndDaysFromTimestamps(timestamps: Date[]) {
  const hoursMap = new Map<number, number>();
  const daysMap = new Map<number, number>();

  timestamps.forEach((date) => {
    const hour = date.getHours(); // 0 to 23
    const day = date.getDay(); // 0 (Sun) to 6 (Sat)

    hoursMap.set(hour, (hoursMap.get(hour) || 0) + 1);
    daysMap.set(day, (daysMap.get(day) || 0) + 1);
  });

  const mostFrequent = (map: Map<number, number>) => {
    const entries = Array.from(map.entries());
    const maxCount = Math.max(...entries.map(([, count]) => count));
    return entries
      .filter(([, count]) => count === maxCount)
      .map(([key]) => key);
  };

  return {
    hourFrequency: hoursMap,
    dayFrequency: daysMap,
    mostFocusedHours: mostFrequent(hoursMap),
    mostFocusedDays: mostFrequent(daysMap),
  };
}

export const weekdayMap = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
