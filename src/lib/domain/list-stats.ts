// The numbers ListStats shows above a list (DESIGN.md). Every amount is in
// integer cents (AGENTS.md Section 6.1).

export type ListItemStatus = "open" | "done";

type EstimatedItem = {
  status: ListItemStatus;
  estimatedCents: number | null;
};

// "Still to buy": the estimates of the open items. An item with no estimate
// adds nothing.
export function openEstimateTotalCents(items: EstimatedItem[]): number {
  return items.reduce(
    (total, item) =>
      item.status === "open" && item.estimatedCents !== null
        ? total + item.estimatedCents
        : total,
    0,
  );
}

type CheckedOffItem = EstimatedItem & {
  // What the item cost when it was checked off; null for no cost, or when its
  // expense was later deleted on its own.
  costCents: number | null;
};

export type CheckedOffTotals = {
  // "Spent": what the done items cost.
  spentCents: number;
  // "Spent versus estimate": how far the done items that had an estimate came
  // over it (positive) or under it (negative). Null when none had one.
  overEstimateCents: number | null;
};

// The two numbers a shared group's ListStats adds once items are checked off
// (#12). An item checked off with no cost counts as $0.00 against its
// estimate. Items with no estimate are spent but not compared.
export function checkedOffTotals(items: CheckedOffItem[]): CheckedOffTotals {
  let spentCents = 0;
  let overEstimateCents: number | null = null;
  for (const item of items) {
    if (item.status !== "done") {
      continue;
    }
    const cost = item.costCents ?? 0;
    spentCents += cost;
    if (item.estimatedCents !== null) {
      overEstimateCents = (overEstimateCents ?? 0) + cost - item.estimatedCents;
    }
  }
  return { spentCents, overEstimateCents };
}

type DatedExpense = {
  // A calendar day, "2026-11-02".
  spentOn: string;
  amountCents: number;
};

// "Spent this month" on the personal list (#23): every expense dated in
// `month`, "2026-11", whether it was logged directly or by checking off an
// item. In the personal space the owner is the only sharer, so the amount is
// all theirs.
export function spentInMonthCents(
  expenses: DatedExpense[],
  month: string,
): number {
  return expenses.reduce(
    (total, expense) =>
      expense.spentOn.slice(0, 7) === month
        ? total + expense.amountCents
        : total,
    0,
  );
}

// The month `now` falls in, in UTC, as "2026-11".
export function monthOf(now: Date): string {
  return now.toISOString().slice(0, 7);
}

// The days of `month`, "2026-11", for a query on spent_on: from the first day
// up to, but not including, the first day of the next month.
export function monthRange(month: string): { from: string; before: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  const next =
    monthNumber === 12
      ? `${year + 1}-01`
      : `${year}-${String(monthNumber + 1).padStart(2, "0")}`;
  return { from: `${month}-01`, before: `${next}-01` };
}
