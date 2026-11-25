import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getBudgetCycle,
  isValidBudgetStartDay,
  normalizeBudgetStartDay,
} from '../budgetCycle';

describe('budgetCycle', () => {
  it('validates allowed days (1-14 and 21-31) and rejects 15-20', () => {
    for (let d = 1; d <= 14; d++) assert.equal(isValidBudgetStartDay(d), true);
    for (let d = 15; d <= 20; d++) assert.equal(isValidBudgetStartDay(d), false);
    for (let d = 21; d <= 31; d++) assert.equal(isValidBudgetStartDay(d), true);
    assert.equal(normalizeBudgetStartDay(17), 1);
    assert.equal(normalizeBudgetStartDay(25), 25);
  });

  it('day 25 on 25 Nov starts December (25 Nov – 24 Dec)', () => {
    const cycle = getBudgetCycle(25, new Date(2026, 10, 25), 0); // Nov 25, 2026
    assert.equal(cycle.month, 11); // December
    assert.equal(cycle.year, 2026);
    assert.equal(cycle.label, 'December 2026');
    assert.equal(cycle.rangeLabel, '25 Nov – 24 Dec');
  });

  it('day 25 on 24 Nov is still November (25 Oct – 24 Nov)', () => {
    const cycle = getBudgetCycle(25, new Date(2026, 10, 24), 0); // Nov 24, 2026
    assert.equal(cycle.month, 10); // November
    assert.equal(cycle.label, 'November 2026');
    assert.equal(cycle.rangeLabel, '25 Oct – 24 Nov');
  });

  it('day 5 on 5 Dec starts December (5 Dec – 4 Jan)', () => {
    const cycle = getBudgetCycle(5, new Date(2026, 11, 5), 0); // Dec 5, 2026
    assert.equal(cycle.month, 11); // December
    assert.equal(cycle.label, 'December 2026');
    assert.equal(cycle.rangeLabel, '5 Dec – 4 Jan');
  });

  it('day 5 on 4 Dec is still November (5 Nov – 4 Dec)', () => {
    const cycle = getBudgetCycle(5, new Date(2026, 11, 4), 0); // Dec 4, 2026
    assert.equal(cycle.month, 10); // November
    assert.equal(cycle.label, 'November 2026');
    assert.equal(cycle.rangeLabel, '5 Nov – 4 Dec');
  });

  it('day 1 behaves as standard calendar month', () => {
    const cycle = getBudgetCycle(1, new Date(2026, 10, 25), 0);
    assert.equal(cycle.label, 'November 2026');
    assert.equal(cycle.rangeLabel, '1 Nov – 30 Nov');
  });
});
