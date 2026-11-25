import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkPurchase, type PurchaseFinancialData } from '../../canIPurchase';

const BASE_DATA: PurchaseFinancialData = {
  spendable: 38000,
  reserved: 25000,
  savings: 100000,
  amanat: 50000,
  expensesDue: 14000,
  loansToPay: 6000,
  loansToReceive: 10000,
};

// Nov 15, 2026 (30-day month -> 16 days left inclusive)
const MID_MONTH = new Date(2026, 10, 15);
// Nov 30, 2026 (last day of month -> 1 day left)
const LAST_DAY = new Date(2026, 10, 30);

describe('checkPurchase', () => {
  it('returns "yes" when amount <= safe and ignores reserved, savings, and amanat', () => {
    // free = 38000 - 14000 - 6000 = 18000; buffer (5%) = 1900; safe = 16100
    const res = checkPurchase(BASE_DATA, 15000, 5, MID_MONTH);
    assert.equal(res.free, 18000);
    assert.equal(res.buffer, 1900);
    assert.equal(res.safe, 16100);
    assert.equal(res.verdict, 'yes');
    assert.equal(res.shortfall, 0);
    assert.equal(res.ifIncoming, false);
  });

  it('returns "tight" when amount is between safe and free', () => {
    const res = checkPurchase(BASE_DATA, 17000, 5, MID_MONTH);
    assert.equal(res.verdict, 'tight');
    assert.equal(res.shortfall, 0);
  });

  it('returns "no" with shortfall and ifIncoming=true when loansToReceive covers the gap', () => {
    // free = 18000, loansToReceive = 10000 -> free + loansToReceive = 28000
    const res = checkPurchase(BASE_DATA, 25000, 5, MID_MONTH);
    assert.equal(res.verdict, 'no');
    assert.equal(res.shortfall, 7000);
    assert.equal(res.ifIncoming, true);
  });

  it('returns "no" with ifIncoming=false when even loansToReceive is not enough', () => {
    const res = checkPurchase(BASE_DATA, 35000, 5, MID_MONTH);
    assert.equal(res.verdict, 'no');
    assert.equal(res.shortfall, 17000);
    assert.equal(res.ifIncoming, false);
  });

  it('returns "info" with safe-to-spend and dailyLimit when amount is 0 or omitted', () => {
    const res = checkPurchase(BASE_DATA, 0, 5, MID_MONTH);
    assert.equal(res.verdict, 'info');
    assert.equal(res.daysLeft, 16);
    assert.equal(res.dailyLimit, 16100 / 16);
  });

  it('handles negative free balance accurately (clamps dailyLimit to 0, keeps negative free/safe)', () => {
    const deficitData: PurchaseFinancialData = {
      spendable: 10000,
      reserved: 50000,
      savings: 50000,
      amanat: 50000,
      expensesDue: 12000,
      loansToPay: 5000,
      loansToReceive: 0,
    };
    const res = checkPurchase(deficitData, 2000, 5, MID_MONTH);
    assert.equal(res.free, -7000);
    assert.equal(res.buffer, 500);
    assert.equal(res.safe, -7500);
    assert.equal(res.dailyLimit, 0);
    assert.equal(res.verdict, 'no');
    assert.equal(res.shortfall, 9000);
    assert.equal(res.ifIncoming, false);
  });

  it('handles last day of the month (daysLeft = 1, dailyLimit = safe)', () => {
    const res = checkPurchase(BASE_DATA, 0, 5, LAST_DAY);
    assert.equal(res.verdict, 'info');
    assert.equal(res.daysLeft, 1);
    assert.equal(res.dailyLimit, 16100);
  });
});
