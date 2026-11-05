// The numbers ListStats shows above a list (DESIGN.md). Every amount is in
// integer cents (AGENTS.md Section 6.1).

export type ListItemStatus = "open" | "done";

type EstimatedItem = {
  status: ListItemStatus;
  estimatedCents: number | null;
};

// "Still to buy": the estimates of the open items. An item with no estimate
// adds nothing. Spent and spent versus estimate need done items (#12).
export function openEstimateTotalCents(items: EstimatedItem[]): number {
  return items.reduce(
    (total, item) =>
      item.status === "open" && item.estimatedCents !== null
        ? total + item.estimatedCents
        : total,
    0,
  );
}
