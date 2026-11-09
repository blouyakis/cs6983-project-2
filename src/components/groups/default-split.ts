import type { Member } from "@/lib/db/group-members";
import { toPercents } from "@/lib/domain/describe-split";
import { hasEqualWeights } from "@/lib/domain/splits";

// What the Default split form holds (DESIGN.md "DefaultSplitForm", #63). It is
// plain data, so opening and checking the form are tested without a browser.
export type DefaultSplitState = {
  mode: "even" | "custom";
  // What is in each member's percent field, by user id. Kept on Evenly too,
  // so switching back to Custom percentages shows what was there.
  percents: Record<string, string>;
};

// The body of PATCH /api/groups/{groupId}, as updateGroupSchema reads it.
export type DefaultSplitFields = {
  memberWeights: { userId: string; weight: number }[];
};

// By user id, or `total` for the sum, which sits under the fields.
export type DefaultSplitErrors = Record<string, string>;

export const ENTER_PERCENT = "Enter a whole percent from 1 to 100.";

const WHOLE_NUMBER = /^\d+$/;

// Evenly when every weight is equal, otherwise Custom percentages filled in
// from the weights, rounded so they add up to 100. The fields are filled in
// either way, for switching to Custom.
export function initialDefaultSplit(
  members: readonly Member[],
): DefaultSplitState {
  const sharers = members.map((member) => ({
    userId: member.userId,
    weight: member.defaultShareWeight,
  }));
  const percents = toPercents(sharers.map((sharer) => sharer.weight));
  return {
    mode: hasEqualWeights(sharers) ? "even" : "custom",
    percents: Object.fromEntries(
      members.map((member, index) => [member.userId, String(percents[index])]),
    ),
  };
}

// What a typed percent counts as: a whole number, or nothing. The Total line
// and a save read the fields the same way.
function wholePercent(typed: string | undefined): number {
  const trimmed = (typed ?? "").trim();
  return WHOLE_NUMBER.test(trimmed) ? Number(trimmed) : NaN;
}

// The Total line under the percent fields.
export function totalPercent(
  state: DefaultSplitState,
  members: readonly Member[],
): number {
  return members.reduce((sum, member) => {
    const percent = wholePercent(state.percents[member.userId]);
    return Number.isNaN(percent) ? sum : sum + percent;
  }, 0);
}

// Evenly sends weight 1 for everyone. Custom percentages sends each percent as
// the weight as it is, so 60 and 40 are stored as 60 and 40 (#63); each must be
// a whole number from 1 to 100 and together they must make 100. Percents left
// as the form opened them keep the weights they were rounded from, so saving
// 67 and 33 untouched leaves 60:30 as it was. Every current member is listed
// once, as update_group requires.
export function resolveDefaultSplit(
  state: DefaultSplitState,
  members: readonly Member[],
): DefaultSplitFields | { errors: DefaultSplitErrors } {
  if (state.mode === "even") {
    return {
      memberWeights: members.map((member) => ({
        userId: member.userId,
        weight: 1,
      })),
    };
  }
  const shown = initialDefaultSplit(members).percents;
  const untouched = members.every(
    (member) =>
      wholePercent(state.percents[member.userId]) ===
      Number(shown[member.userId]),
  );
  if (untouched) {
    return {
      memberWeights: members.map((member) => ({
        userId: member.userId,
        weight: member.defaultShareWeight,
      })),
    };
  }
  const errors: DefaultSplitErrors = {};
  const memberWeights = members.map((member) => {
    const weight = wholePercent(state.percents[member.userId]);
    if (!(weight >= 1 && weight <= 100)) {
      errors[member.userId] = ENTER_PERCENT;
    }
    return { userId: member.userId, weight };
  });
  if (Object.keys(errors).length > 0) {
    return { errors };
  }
  const total = memberWeights.reduce((sum, entry) => sum + entry.weight, 0);
  if (total !== 100) {
    return {
      errors: {
        total: `The percentages add up to ${total}%. Make them add up to 100%.`,
      },
    };
  }
  return { memberWeights };
}
