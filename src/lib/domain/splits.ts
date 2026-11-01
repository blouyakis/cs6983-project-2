import { ValidationError } from "@/lib/http/errors";

// Splitting an expense among its sharers (AGENTS.md Sections 6.1 to 6.3).
// Every amount is in integer cents, and the shares always add up exactly to
// the amount.

export type Sharer = { userId: string; weight: number };
export type Share = { userId: string; shareCents: number };

const CHECK_FIELDS = "Check the highlighted fields.";

function rejectField(field: string, message: string): never {
  throw new ValidationError(CHECK_FIELDS, { [field]: message });
}

function isWholeCents(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function checkAmount(amountCents: number): void {
  if (!isWholeCents(amountCents)) {
    rejectField("amountCents", "Enter an amount of $0.00 or more.");
  }
}

function checkSharedBy(payerId: string, sharedBy: readonly string[]): void {
  if (sharedBy.length === 0) {
    rejectField("sharedBy", "Choose at least one person to share this cost.");
  }
  if (new Set(sharedBy).size !== sharedBy.length) {
    rejectField("sharedBy", "Each person can share this cost only once.");
  }
  // The payer always shares, so leftover cents always have a place to go.
  if (!sharedBy.includes(payerId)) {
    rejectField(
      "sharedBy",
      "The payer must be one of the people sharing this cost.",
    );
  }
}

// Splits amountCents in proportion to each sharer's weight. Everyone gets the
// whole cents of their exact share, and the cents left over go to the payer
// (AGENTS.md Section 6.2). An even split is every weight set to 1.
export function splitByWeights(
  amountCents: number,
  payerId: string,
  sharers: readonly Sharer[],
): Share[] {
  checkAmount(amountCents);
  checkSharedBy(
    payerId,
    sharers.map((sharer) => sharer.userId),
  );

  // Weights come from the database or the server, never straight from a
  // request, so a bad one is a bug rather than a user error.
  if (
    !sharers.every(
      (sharer) => Number.isSafeInteger(sharer.weight) && sharer.weight > 0,
    )
  ) {
    throw new Error("Share weights must be positive whole numbers.");
  }
  const totalWeight = sharers.reduce((sum, sharer) => sum + sharer.weight, 0);
  if (!Number.isSafeInteger(amountCents * totalWeight)) {
    throw new Error("The amount and weights are too large to split exactly.");
  }

  // Integer division only: amountCents * weight is a safe integer, and
  // subtracting the remainder first keeps the quotient exact.
  const shares = sharers.map((sharer) => {
    const scaled = amountCents * sharer.weight;
    return {
      userId: sharer.userId,
      shareCents: (scaled - (scaled % totalWeight)) / totalWeight,
    };
  });
  const assigned = shares.reduce((sum, share) => sum + share.shareCents, 0);
  const payerShare = shares.find((share) => share.userId === payerId)!;
  payerShare.shareCents += amountCents - assigned;
  return shares;
}

// SplitEditor opens on Evenly when every sharer has the same weight, and on
// Custom amounts filled in from the weights otherwise (#8).
export function hasEqualWeights(sharers: readonly Sharer[]): boolean {
  return sharers.every((sharer) => sharer.weight === sharers[0].weight);
}
