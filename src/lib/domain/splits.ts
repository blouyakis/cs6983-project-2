import { ValidationError } from "@/lib/http/errors";
import { formatCents } from "./money";

// Splitting an expense among its sharers (AGENTS.md Sections 6.1 to 6.3).
// Every amount is in integer cents, and the shares always add up exactly to
// the amount.

export type Sharer = { userId: string; weight: number };
export type Share = { userId: string; shareCents: number };

const CHECK_FIELDS = "Check the highlighted fields.";

// expenses.amount_cents and expense_shares.share_cents are Postgres integer,
// so this is the most either can hold. Checking it here makes a bigger amount
// a 400 on its field instead of a database error.
export const MAX_CENTS = 2_147_483_647;
const range = `from ${formatCents(0)} to ${formatCents(MAX_CENTS)}`;

// Shared with splitSchema in lib/validation, so a rule broken in the request
// and the same rule broken here read the same to the user.
export const splitMessages = {
  amount: `Enter an amount ${range}, in whole cents.`,
  noSharers: "Choose at least one person to share this cost.",
  repeatedSharer: "Each person can share this cost only once.",
  payerNotSharing: "The payer must be one of the people sharing this cost.",
  shareNotWholeCents: `Each share must be ${range}, in whole cents.`,
  missingShare: "Enter a share for everyone sharing this cost.",
  extraShare: "Only people sharing this cost can have a share.",
} as const;

function rejectField(field: string, message: string): never {
  throw new ValidationError(CHECK_FIELDS, { [field]: message });
}

function isWholeCents(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_CENTS;
}

function checkAmount(amountCents: number): void {
  if (!isWholeCents(amountCents)) {
    rejectField("amountCents", splitMessages.amount);
  }
}

function checkSharedBy(payerId: string, sharedBy: readonly string[]): void {
  if (sharedBy.length === 0) {
    rejectField("sharedBy", splitMessages.noSharers);
  }
  if (new Set(sharedBy).size !== sharedBy.length) {
    rejectField("sharedBy", splitMessages.repeatedSharer);
  }
  // The payer always shares, so leftover cents always have a place to go.
  if (!sharedBy.includes(payerId)) {
    rejectField("sharedBy", splitMessages.payerNotSharing);
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

// Checks shares the payer typed in (AGENTS.md Section 6.3) and returns them in
// the order of sharedBy. They have no leftover, since every cent is entered.
export function checkCustomShares(
  amountCents: number,
  payerId: string,
  sharedBy: readonly string[],
  amountsCents: Readonly<Record<string, number>>,
): Share[] {
  checkAmount(amountCents);
  checkSharedBy(payerId, sharedBy);

  const entered = Object.entries(amountsCents);
  if (!entered.every(([, cents]) => isWholeCents(cents))) {
    rejectField("amountsCents", splitMessages.shareNotWholeCents);
  }
  if (!sharedBy.every((userId) => Object.hasOwn(amountsCents, userId))) {
    rejectField("amountsCents", splitMessages.missingShare);
  }
  if (entered.length !== sharedBy.length) {
    rejectField("amountsCents", splitMessages.extraShare);
  }

  const total = entered.reduce((sum, [, cents]) => sum + cents, 0);
  if (total !== amountCents) {
    rejectField(
      "amountsCents",
      `The shares add up to ${formatCents(total)}, not ${formatCents(amountCents)}.`,
    );
  }
  return sharedBy.map((userId) => ({
    userId,
    shareCents: amountsCents[userId],
  }));
}
