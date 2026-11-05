import type { Share } from "./splits";

// Balances for one period of a group (AGENTS.md Section 6.4, architecture.md
// Section 6). Everything is integer cents. The caller passes only the rows
// that belong to the period: unsettled expenses and confirmed payments.

export type BalanceExpense = {
  payerId: string;
  amountCents: number;
  shares: Share[];
};

export type ConfirmedPayment = {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
};

export type Balance = {
  userId: string;
  // Positive: the group owes this person. Negative: they owe the group.
  balanceCents: number;
};

// balance(m) = paid by m − m's shares + confirmed payments m sent − confirmed
// payments m received. Every member gets a row, in the order given, and so
// does anyone else in an expense or payment (a former member whose costs are
// still unsettled), so the balances always add up to zero.
export function computeBalances(
  memberIds: readonly string[],
  expenses: readonly BalanceExpense[],
  payments: readonly ConfirmedPayment[],
): Balance[] {
  const totals = new Map<string, number>();
  const add = (userId: string, cents: number) => {
    totals.set(userId, (totals.get(userId) ?? 0) + cents);
  };
  for (const memberId of memberIds) {
    add(memberId, 0);
  }
  for (const expense of expenses) {
    add(expense.payerId, expense.amountCents);
    for (const share of expense.shares) {
      add(share.userId, -share.shareCents);
    }
  }
  for (const payment of payments) {
    add(payment.fromUserId, payment.amountCents);
    add(payment.toUserId, -payment.amountCents);
  }
  return Array.from(totals, ([userId, balanceCents]) => ({
    userId,
    balanceCents,
  }));
}
