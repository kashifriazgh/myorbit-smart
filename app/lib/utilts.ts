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

// calculate total cash
import { TotalCashSnapshot } from './interface';

export const calculateTotalCash = (snapshot: TotalCashSnapshot): number => {
  return snapshot.source?.amount || 0;
};
