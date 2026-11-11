import type { ConfirmedPayment } from "./balances";
import type { Share } from "./splits";

// A member's itemized bill for one period of a group (#21, AGENTS.md user
// flow 7). Everything is integer cents. The caller passes only the rows that
// belong to the period, as for computeBalances.

type SharedExpense = { shares: Share[] };

type PairExpense = SharedExpense & { payerId: string };

export type OwedToMember = {
  userId: string;
  // Positive: the user owes this person. Negative: this person owes the user.
  owedCents: number;
};

// The expenses the user has a share in, in the order given. A cost the user
// paid only for others still has their share of 0 (AGENTS.md Section 6.2), so
// it stays on their bill.
export function sharedBy<Expense extends SharedExpense>(
  userId: string,
  expenses: readonly Expense[],
): Expense[] {
  return expenses.filter((expense) =>
    expense.shares.some((share) => share.userId === userId),
  );
}

// What the user owes each other person over the period: their share of what
// that person paid, minus that person's share of what the user paid, minus
// confirmed payments the user sent them, plus ones they sent the user. Costs
// between two other people don't involve the user. Every member but the user
// gets a row, in the order given, then anyone else in a row (a former member),
// so the rows add up to minus the user's balance (Section 6.4).
export function owedToEach(
  userId: string,
  memberIds: readonly string[],
  expenses: readonly PairExpense[],
  payments: readonly ConfirmedPayment[],
): OwedToMember[] {
  const owed = new Map<string, number>();
  const add = (otherId: string, cents: number) => {
    if (otherId !== userId) {
      owed.set(otherId, (owed.get(otherId) ?? 0) + cents);
    }
  };
  for (const memberId of memberIds) {
    add(memberId, 0);
  }
  for (const expense of expenses) {
    for (const share of expense.shares) {
      if (expense.payerId === userId) {
        add(share.userId, -share.shareCents);
      } else if (share.userId === userId) {
        add(expense.payerId, share.shareCents);
      }
    }
  }
  for (const payment of payments) {
    if (payment.fromUserId === userId) {
      add(payment.toUserId, -payment.amountCents);
    } else if (payment.toUserId === userId) {
      add(payment.fromUserId, payment.amountCents);
    }
  }
  return Array.from(owed, ([otherId, owedCents]) => ({
    userId: otherId,
    owedCents,
  }));
}
