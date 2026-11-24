import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeWalletOwnership,
  calculateAffordability,
} from '../affordabilityAnalyzer';
import type {
  Expenditure,
  Liability,
  LoanRecord,
  PlannedExpense,
  TotalCashSnapshot,
} from '../../interface';

const REF_DATE = new Date(2026, 10, 15); // 2026-11-15 (local)

function makeSnapshot(
  overrides: Partial<TotalCashSnapshot> = {}
): TotalCashSnapshot {
  return {
    userId: 'u1',
    sources: {
      in_hand: 0,
      easypaisa: 0,
      jazzcash: 0,
      other: 0,
      bank: {},
      custom: {},
      ...(overrides.sources || {}),
    },
    sourceOwnership: overrides.sourceOwnership || {},
    totalAmount: overrides.totalAmount ?? 0,
    freezeAmount: overrides.freezeAmount ?? 0,
    createdAt: REF_DATE,
  };
}

describe('Affordability Analyzer Engine', () => {
  it('1. Returns Comfortably Affordable (green) when safe capacity covers purchase', () => {
    const snapshot = makeSnapshot({
      sources: {
        in_hand: 100000,
        easypaisa: 0,
        jazzcash: 0,
        other: 0,
        bank: {},
        custom: {},
      },
    });

    const plannedExpenses: PlannedExpense[] = [
      {
        id: 'e1',
        userId: 'u1',
        title: 'Electricity Bill',
        category: 'Utilities',
        expectedAmount: 15000,
        dueDate: '2026-11-22',
        paymentStatus: 'pending',
        recurrence: 'monthly',
      },
    ];

    const res = calculateAffordability({
      purchaseName: 'Office Chair',
      proposedPurchaseAmount: 30000,
      emergencyBuffer: 20000,
      referenceDate: REF_DATE,
      snapshot,
      plannedExpenses,
      expenditures: [],
      loans: [],
    });

    assert.equal(res.verdict.code, 'comfortably_affordable');
    assert.equal(res.verdict.color, 'green');
    assert.equal(res.capacity.netSpendableCapacity, 85000);
    assert.equal(res.capacity.safePurchasingCapacity, 65000);
    assert.equal(res.capacity.remainingPostPurchaseSafeBalance, 35000);
    assert.equal(res.capacity.purchaseShortfall, 0);
  });

  it('2. Returns Affordable but Risky (amber) when purchase dips into emergency buffer', () => {
    const snapshot = makeSnapshot({
      sources: {
        in_hand: 60000,
        easypaisa: 0,
        jazzcash: 0,
        other: 0,
        bank: {},
        custom: {},
      },
    });

    const plannedExpenses: PlannedExpense[] = [
      {
        id: 'e1',
        userId: 'u1',
        title: 'Internet',
        category: 'Utilities',
        expectedAmount: 10000,
        dueDate: '2026-11-20',
        paymentStatus: 'pending',
        recurrence: 'monthly',
      },
    ];

    // Spendable = 60k, Uncovered = 10k -> Net = 50k, Buffer = 20k -> Safe = 30k
    // Purchase = 40k -> <= Net (50k) but > Safe (30k) => Affordable but Risky
    const res = calculateAffordability({
      purchaseName: 'Smartphone',
      proposedPurchaseAmount: 40000,
      emergencyBuffer: 20000,
      referenceDate: REF_DATE,
      snapshot,
      plannedExpenses,
      expenditures: [],
      loans: [],
    });

    assert.equal(res.verdict.code, 'affordable_but_risky');
    assert.equal(res.verdict.color, 'amber');
    assert.equal(res.capacity.safePurchasingCapacity, 30000);
    assert.equal(res.capacity.remainingPostPurchaseSafeBalance, -10000);
    assert.equal(res.capacity.purchaseShortfall, 10000);
  });

  it('3. Returns Conditionally Affordable (blue) when expected lent loan recoveries bridge the gap without inflating Spendable', () => {
    const snapshot = makeSnapshot({
      sources: {
        in_hand: 35000,
        easypaisa: 0,
        jazzcash: 0,
        other: 0,
        bank: {},
        custom: {},
      },
    });

    const loans: LoanRecord[] = [
      {
        id: 'l1',
        userId: 'u1',
        type: 'lend',
        counterparty: 'Bilal',
        amount: 25000,
        paidAmount: 5000, // 20,000 remaining
        dueDate: new Date(2026, 10, 25),
        isSettled: false,
        createdAt: REF_DATE,
      },
    ];

    // Spendable = 35k, Buffer = 10k -> Safe = 25k, Net = 35k
    // Purchase = 40k (> Net 35k), Projected Safe = 25k + 20k = 45k >= 40k => Conditionally Affordable
    const res = calculateAffordability({
      purchaseName: 'Laptop',
      proposedPurchaseAmount: 40000,
      emergencyBuffer: 10000,
      referenceDate: REF_DATE,
      snapshot,
      plannedExpenses: [],
      expenditures: [],
      loans,
    });

    assert.equal(res.ownership.totalSpendable, 35000); // Recovery NOT added to Spendable
    assert.equal(res.obligations.totalExpectedLoanRecoveries, 20000);
    assert.equal(res.capacity.safePurchasingCapacity, 25000);
    assert.equal(res.capacity.projectedSafePurchasingCapacity, 45000);
    assert.equal(res.verdict.code, 'conditionally_affordable');
    assert.equal(res.verdict.color, 'blue');
  });

  it('4. Returns Not Affordable (red) and strictly excludes Amanat & Savings', () => {
    const snapshot = makeSnapshot({
      sources: {
        in_hand: 10000,
        easypaisa: 0,
        jazzcash: 0,
        other: 0,
        bank: { HBL: 200000 },
        custom: {},
      },
      sourceOwnership: {
        'bank:HBL': {
          hasOwnThisMoney: true,
          allocations: [
            {
              id: 'a1',
              owner: 'Savings',
              amount: 120000,
              purpose: 'House Downpayment',
              fundState: 'savings',
              availabilityStatus: 'savings',
            },
            {
              id: 'a2',
              owner: 'Brother',
              amount: 80000,
              purpose: 'Amanat (Brother)',
              fundState: 'amanat',
              availabilityStatus: 'external',
            },
          ],
        },
      },
    });

    const res = calculateAffordability({
      purchaseName: 'Motorcycle',
      proposedPurchaseAmount: 50000,
      emergencyBuffer: 5000,
      referenceDate: REF_DATE,
      snapshot,
      plannedExpenses: [],
      expenditures: [],
      loans: [],
    });

    assert.equal(res.ownership.totalWalletBalance, 210000);
    assert.equal(res.ownership.totalSpendable, 10000);
    assert.equal(res.ownership.totalSaving, 120000);
    assert.equal(res.ownership.totalAmanat, 80000);
    assert.equal(res.verdict.code, 'not_affordable');
    assert.equal(res.verdict.color, 'red');
    assert.equal(res.capacity.purchaseShortfall, 45000);
    // Ensure Amanat is never recommended as a funding source
    assert.ok(
      res.recommendations.some((r) => r.title.toLowerCase().includes('amanat') && r.detail.toLowerCase().includes('excluded'))
    );
  });

  it('5. Handles partial payments and overdue obligations accurately while excluding paid/settled records', () => {
    const snapshot = makeSnapshot({
      sources: {
        in_hand: 50000,
        easypaisa: 0,
        jazzcash: 0,
        other: 0,
        bank: {},
        custom: {},
      },
    });

    const plannedExpenses: PlannedExpense[] = [
      {
        id: 'paid1',
        userId: 'u1',
        title: 'Paid Rent',
        category: 'Housing',
        expectedAmount: 30000,
        actualPaidAmount: 30000,
        dueDate: '2026-11-05',
        paymentStatus: 'paid',
        recurrence: 'monthly',
      },
      {
        id: 'partial1',
        userId: 'u1',
        title: 'School Fee',
        category: 'Education',
        expectedAmount: 20000,
        actualPaidAmount: 8000, // 12,000 remaining
        dueDate: '2026-11-10', // overdue
        paymentStatus: 'partially_paid',
        recurrence: 'monthly',
      },
    ];

    const loans: LoanRecord[] = [
      {
        id: 'settled1',
        userId: 'u1',
        type: 'borrow',
        counterparty: 'Settled Friend',
        amount: 15000,
        paidAmount: 15000,
        dueDate: new Date(2026, 10, 10),
        isSettled: true,
        createdAt: REF_DATE,
      },
      {
        id: 'borrow1',
        userId: 'u1',
        type: 'borrow',
        counterparty: 'Hamza',
        amount: 10000,
        paidAmount: 3000, // 7,000 remaining
        dueDate: new Date(2026, 10, 12), // overdue
        isSettled: false,
        createdAt: REF_DATE,
      },
    ];

    const res = calculateAffordability({
      proposedPurchaseAmount: 10000,
      emergencyBuffer: 5000,
      referenceDate: REF_DATE,
      snapshot,
      plannedExpenses,
      expenditures: [],
      loans,
    });

    assert.equal(res.obligations.totalPendingExpenses, 12000);
    assert.equal(res.obligations.totalOverdueExpenses, 12000);
    assert.equal(res.obligations.totalUpcomingLoanRepayments, 7000);
    assert.equal(res.obligations.totalOverdueLoanRepayments, 7000);
    assert.equal(res.obligations.totalUncoveredObligations, 19000);
    assert.equal(res.capacity.netSpendableCapacity, 31000);
    assert.equal(res.capacity.safePurchasingCapacity, 26000);
    assert.equal(res.verdict.code, 'comfortably_affordable');
  });

  it('6. Prevents reusing the same Reserve pool across multiple obligations & applies conservative matching', () => {
    const snapshot = makeSnapshot({
      sources: {
        in_hand: 20000,
        easypaisa: 0,
        jazzcash: 0,
        other: 0,
        bank: { Meezan: 25000 },
        custom: {},
      },
      sourceOwnership: {
        'bank:Meezan': {
          hasOwnThisMoney: true,
          allocations: [
            {
              id: 'res_elec',
              owner: 'Reserved',
              amount: 10000,
              purpose: 'Electricity Bill',
              fundState: 'reserved',
              availabilityStatus: 'reserved',
            },
            {
              id: 'res_general',
              owner: 'Reserved',
              amount: 15000,
              purpose: 'Car Maintenance',
              fundState: 'reserved',
              availabilityStatus: 'reserved',
            },
          ],
        },
      },
    });

    // Two expenses with the same title "Electricity Bill" totaling 16,000, but only 10,000 in that Reserve envelope.
    // Plus an unrelated "Groceries" expense of 8,000 — must NOT draw from "Car Maintenance" reserve!
    const plannedExpenses: PlannedExpense[] = [
      {
        id: 'e1',
        userId: 'u1',
        title: 'Electricity Bill',
        category: 'Utilities',
        expectedAmount: 8000,
        dueDate: '2026-11-18',
        paymentStatus: 'pending',
        recurrence: 'monthly',
      },
      {
        id: 'e2',
        userId: 'u1',
        title: 'Electricity Bill',
        category: 'Utilities',
        expectedAmount: 8000,
        dueDate: '2026-11-24',
        paymentStatus: 'pending',
        recurrence: 'monthly',
      },
      {
        id: 'e3',
        userId: 'u1',
        title: 'Groceries',
        category: 'Food',
        expectedAmount: 8000,
        dueDate: '2026-11-26',
        paymentStatus: 'pending',
        recurrence: 'monthly',
      },
    ];

    const res = calculateAffordability({
      proposedPurchaseAmount: 5000,
      emergencyBuffer: 0,
      referenceDate: REF_DATE,
      snapshot,
      plannedExpenses,
      expenditures: [],
      loans: [],
    });

    // Total pending = 24,000; only 10,000 covered (8,000 on e1 + 2,000 on e2); uncovered = 14,000
    assert.equal(res.obligations.totalPendingExpenses, 24000);
    assert.equal(res.obligations.obligationsCoveredByReserve, 10000);
    assert.equal(res.obligations.totalUncoveredObligations, 14000);
    assert.ok(
      res.disclosures.some((d) => d.code === 'conservative_reserve_matching'),
      'Expected conservative_reserve_matching disclosure for unlinked Car Maintenance reserve'
    );
  });

  it('7. Preserves negative balances when obligations already exceed Spendable funds', () => {
    const snapshot = makeSnapshot({
      sources: {
        in_hand: 10000,
        easypaisa: 0,
        jazzcash: 0,
        other: 0,
        bank: {},
        custom: {},
      },
    });

    const liabilities: Liability[] = [
      {
        id: 'liab1',
        userId: 'u1',
        type: 'borrowed',
        amount: 25000,
        personName: 'Uncle',
        date: REF_DATE,
        dueDate: new Date(2026, 10, 20),
        status: 'active',
        createdAt: REF_DATE,
      },
    ];

    const res = calculateAffordability({
      proposedPurchaseAmount: 5000,
      emergencyBuffer: 5000,
      referenceDate: REF_DATE,
      snapshot,
      plannedExpenses: [],
      expenditures: [],
      loans: [],
      liabilities,
    });

    assert.equal(res.capacity.netSpendableCapacity, -15000);
    assert.equal(res.capacity.safePurchasingCapacity, -20000);
    assert.equal(res.capacity.remainingPostPurchaseSafeBalance, -25000);
    assert.equal(res.capacity.purchaseShortfall, 25000);
    assert.equal(res.verdict.code, 'not_affordable');
    assert.ok(res.disclosures.some((d) => d.code === 'existing_deficit'));
  });

  it('8. Prevents duplicate balance counting for virtual wallets and wallet vs. envelope sums', () => {
    const snapshot = makeSnapshot({
      sources: {
        in_hand: 0,
        easypaisa: 0,
        jazzcash: 0,
        other: 0,
        bank: {
          HBL: 50000,
          'HBL Virtual Sub': 20000, // virtual wallet backed by HBL
        },
        custom: {
          DriftedWallet: 10000, // allocations sum to 20,000 (> gross 10,000)
        },
      },
      sourceOwnership: {
        'bank:HBL': {
          hasOwnThisMoney: true,
          allocations: [
            {
              id: 'a1',
              owner: 'You',
              amount: 30000,
              purpose: 'Daily Spend',
              fundState: 'spendable',
            },
            {
              id: 'a2',
              owner: 'Reserved',
              amount: 10000,
              purpose: 'Bills',
              fundState: 'reserved',
            },
            // Remaining 10,000 unassigned in HBL -> spendable (total HBL = 50,000, NOT 90,000)
          ],
        },
        'bank:HBL Virtual Sub': {
          hasOwnThisMoney: true,
          isVirtual: true,
          parentWalletKey: 'bank:HBL',
        },
        'custom:DriftedWallet': {
          hasOwnThisMoney: true,
          allocations: [
            {
              id: 'd1',
              owner: 'You',
              amount: 10000,
              fundState: 'spendable',
            },
            {
              id: 'd2',
              owner: 'Savings',
              amount: 10000,
              fundState: 'savings',
            },
          ],
        },
      },
    });

    const disclosures: Parameters<typeof analyzeWalletOwnership>[1] = [];
    const ownership = analyzeWalletOwnership(snapshot, disclosures);

    // Total must be 50,000 (HBL) + 10,000 (DriftedWallet) = 60,000 (virtual excluded, envelopes capped)
    assert.equal(ownership.totalWalletBalance, 60000);
    assert.equal(ownership.excludedVirtualWalletCount, 1);
    assert.equal(ownership.totalSpendable, 45000); // 40,000 HBL + 5,000 scaled DriftedWallet
    assert.equal(ownership.totalReserve, 10000);
    assert.equal(ownership.totalSaving, 5000);
    assert.ok(disclosures.some((d) => d.code === 'virtual_wallets_excluded'));
    assert.ok(disclosures.some((d) => d.code === 'allocation_exceeds_wallet_balance'));
  });

  it('9. Handles undefined paymentStatus and isPaid conservatively with explicit disclosure', () => {
    const snapshot = makeSnapshot({
      sources: {
        in_hand: 30000,
        easypaisa: 0,
        jazzcash: 0,
        other: 0,
        bank: {},
        custom: {},
      },
    });

    const plannedWithUndefined = [
      {
        id: 'legacy_p1',
        userId: 'u1',
        title: 'Legacy Gas Bill',
        category: 'Utilities',
        expectedAmount: 4000,
        dueDate: '2026-11-18',
        recurrence: 'monthly',
      } as unknown as PlannedExpense,
    ];

    const expendituresWithUndefined: Expenditure[] = [
      {
        id: 'legacy_e1',
        userId: 'u1',
        title: 'Water Tanker',
        type: 'one-time',
        frequency: 'one_time',
        amount: 3000,
        dueDate: new Date(2026, 10, 19),
        // isPaid intentionally undefined
        createdAt: REF_DATE,
        updatedAt: REF_DATE,
      },
    ];

    const res = calculateAffordability({
      proposedPurchaseAmount: 10000,
      emergencyBuffer: 5000,
      referenceDate: REF_DATE,
      snapshot,
      plannedExpenses: plannedWithUndefined,
      expenditures: expendituresWithUndefined,
      loans: [],
    });

    assert.equal(res.obligations.totalPendingExpenses, 7000);
    assert.equal(res.obligations.pendingExpenses.filter((e) => e.hasUndefinedStatus).length, 2);
    assert.ok(res.disclosures.some((d) => d.code === 'undefined_payment_status'));
  });
});
