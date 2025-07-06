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
  const baseTotal =
    (snapshot.inHand || 0) +
    (snapshot.bank || 0) +
    (snapshot.easypaisa || 0) +
    (snapshot.jazzcash || 0);

  const otherTotal =
    snapshot.otherWallets?.reduce((sum, wallet) => sum + wallet.amount, 0) || 0;

  return baseTotal + otherTotal;
};
