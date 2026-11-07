import type { Share } from "./splits";

// The overview's totals across groups (#10). Everything is integer cents
// (AGENTS.md Section 6.1). The group balances come from computeBalances (#9);
// nothing here recalculates them.

export type BalanceSummary = {
  // What the user is owed minus what they owe, across their groups.
  netCents: number;
  // The sum of the groups where the user owes, as a positive amount.
  owingCents: number;
  // The sum of the groups where the user is owed.
  owedCents: number;
};

// The user's balance in each shared group, one number per group. The
// personal space has no balance, so the caller leaves it out (#23).
export function summarizeBalances(
  balancesCents: readonly number[],
): BalanceSummary {
  let owingCents = 0;
  let owedCents = 0;
  for (const cents of balancesCents) {
    if (cents < 0) {
      owingCents -= cents;
    } else {
      owedCents += cents;
    }
  }
  return { netCents: owedCents - owingCents, owingCents, owedCents };
}

// "Your share in groups, this period": the user's shares of the expenses
// given, whoever paid them.
export function shareOfExpensesCents(
  userId: string,
  expenses: readonly { shares: readonly Share[] }[],
): number {
  let total = 0;
  for (const expense of expenses) {
    for (const share of expense.shares) {
      if (share.userId === userId) {
        total += share.shareCents;
      }
    }
  }
  return total;
}
