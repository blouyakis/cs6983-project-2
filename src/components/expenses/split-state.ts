import type { Member } from "@/lib/db/group-members";
import { centsToInputText, parseDollars } from "@/lib/domain/money";
import {
  checkCustomShares,
  hasEqualWeights,
  MAX_CENTS,
  splitByWeights,
  splitMessages,
  type Share,
} from "@/lib/domain/splits";
import { ValidationError } from "@/lib/http/errors";

// What SplitEditor holds while the user fills in an expense (DESIGN.md
// "SplitEditor"). It is plain data, so the rules for opening, filling in and
// resolving a split are tested without a browser. The rules themselves are in
// lib/domain/splits.ts; this only decides what the form shows and sends.

export type SplitState = {
  mode: "even" | "custom";
  // The user ids of the people sharing, in the order of the group's members.
  sharedBy: string[];
  // What the user typed into the custom amounts, by user id. Null until they
  // edit one. Until then the amounts are worked out from the group's weights,
  // so they follow the expense amount; after that they are left alone.
  typed: Record<string, string> | null;
};

// The split fields of the request, as splitSchema in lib/validation reads them.
export type SplitFields =
  | { mode: "even"; sharedBy: string[] }
  | {
      mode: "custom";
      sharedBy: string[];
      amountsCents: Record<string, number>;
    };

export type ResolvedSplit =
  | { fields: SplitFields; shares: Share[] }
  | {
      fieldErrors: Record<string, string>;
    };

const ENTER_SHARES = "Enter every share in dollars and cents, such as 12.34.";

// For a new expense: Evenly when everyone has the same weight, otherwise Custom
// amounts filled in from the weights, so the group's ratio applies unless the
// payer changes it (AGENTS.md Section 6.3). Everyone shares by default.
export function initialSplitState(members: readonly Member[]): SplitState {
  const sharers = members.map((member) => ({
    userId: member.userId,
    weight: member.defaultShareWeight,
  }));
  return {
    mode: hasEqualWeights(sharers) ? "even" : "custom",
    sharedBy: members.map((member) => member.userId),
    typed: null,
  };
}

// The text in each custom amount field, by user id. Blank when the amount is
// too large to split, which the amount field reports.
export function amountTexts(
  state: SplitState,
  members: readonly Member[],
  payerId: string,
  amountCents: number | null,
): Record<string, string> {
  const { typed, sharedBy } = state;
  if (typed) {
    return Object.fromEntries(sharedBy.map((id) => [id, typed[id] ?? ""]));
  }
  const weights = new Map(
    members.map((member) => [member.userId, member.defaultShareWeight]),
  );
  try {
    const shares = splitByWeights(
      amountCents ?? 0,
      payerId,
      sharedBy.map((id) => ({ userId: id, weight: weights.get(id) ?? 1 })),
    );
    return Object.fromEntries(
      shares.map((share) => [share.userId, centsToInputText(share.shareCents)]),
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return Object.fromEntries(sharedBy.map((id) => [id, ""]));
    }
    throw error;
  }
}

// Editing one amount keeps the others as they were shown, and from then on
// nothing is filled in again.
export function typeAmount(
  state: SplitState,
  members: readonly Member[],
  payerId: string,
  amountCents: number | null,
  userId: string,
  text: string,
): SplitState {
  return {
    ...state,
    typed: {
      ...amountTexts(state, members, payerId, amountCents),
      [userId]: text,
    },
  };
}

export function chooseMode(
  state: SplitState,
  mode: SplitState["mode"],
): SplitState {
  return { ...state, mode };
}

export function chooseSharers(
  state: SplitState,
  sharedBy: string[],
): SplitState {
  return { ...state, sharedBy };
}

// Turns the state into the request's split fields and the shares to preview, or
// into field errors in the words the server would use, so a split that would be
// a 400 is blocked before it is sent. The server still checks it.
export function resolveSplit(
  state: SplitState,
  members: readonly Member[],
  payerId: string,
  amountCents: number,
): ResolvedSplit {
  if (
    !Number.isSafeInteger(amountCents) ||
    amountCents < 0 ||
    amountCents > MAX_CENTS
  ) {
    return { fieldErrors: { amountCents: splitMessages.amount } };
  }
  try {
    if (state.mode === "even") {
      const shares = splitByWeights(
        amountCents,
        payerId,
        state.sharedBy.map((id) => ({ userId: id, weight: 1 })),
      );
      return { fields: { mode: "even", sharedBy: state.sharedBy }, shares };
    }
    const texts = amountTexts(state, members, payerId, amountCents);
    const parsed = state.sharedBy.map((id) => parseDollars(texts[id]));
    if (parsed.some((cents) => cents === null)) {
      return { fieldErrors: { amountsCents: ENTER_SHARES } };
    }
    const amountsCents = Object.fromEntries(
      state.sharedBy.map((id, index) => [id, parsed[index] as number]),
    );
    const shares = checkCustomShares(
      amountCents,
      payerId,
      state.sharedBy,
      amountsCents,
    );
    return {
      fields: { mode: "custom", sharedBy: state.sharedBy, amountsCents },
      shares,
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      return { fieldErrors: error.fields ?? {} };
    }
    throw error;
  }
}
