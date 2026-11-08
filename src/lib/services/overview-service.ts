import "server-only";
import { countOpenListItems, type ListItem } from "@/lib/db/list-items";
import {
  monthOf,
  monthRange,
  openEstimateTotalCents,
  spentInMonthCents,
} from "@/lib/domain/list-stats";
import {
  shareOfExpensesCents,
  summarizeBalances,
  type BalanceSummary,
} from "@/lib/domain/overview";
import { getGroupPeriod } from "./balance-service";
import { listGroupExpensesSpentBetween } from "./expense-service";
import { listGroups, type GroupSummary } from "./group-service";
import { listGroupOpenListItems } from "./list-item-service";

// A shared group the user is in now, with where they stand in it.
export type GroupStanding = GroupSummary & {
  // Positive: the group owes the user. Negative: they owe the group.
  balanceCents: number;
  // The user's shares of the group's expenses this period.
  shareThisPeriodCents: number;
  openItemCount: number;
};

export type PersonalOverview = {
  group: GroupSummary;
  spentThisMonthCents: number;
  // The estimates of the open items; an item with no estimate adds nothing.
  openEstimateCents: number;
  openItems: ListItem[];
};

export type Overview = BalanceSummary & {
  groupShareThisPeriodCents: number;
  // Null only for a user who somehow has no personal space (#23 gives every
  // user one).
  personal: PersonalOverview | null;
  groups: GroupStanding[];
  // Groups the user left, and archived ones: read-only, so they have no
  // balance to show and stay out of the net (AGENTS.md Section 6.8).
  readOnlyGroups: GroupSummary[];
};

// Balances come from getGroupPeriod (#9), which checks access for each group.
async function standingsOf(
  userId: string,
  groups: readonly GroupSummary[],
): Promise<GroupStanding[]> {
  const shared = groups.filter((group) => !group.isPersonal && !group.readOnly);
  const [periods, openCounts] = await Promise.all([
    Promise.all(shared.map((group) => getGroupPeriod(userId, group.id))),
    countOpenListItems(shared.map((group) => group.id)),
  ]);
  return shared.map((group, index) => {
    const { balances, expenses } = periods[index];
    const own = balances.find((balance) => balance.userId === userId);
    return {
      ...group,
      balanceCents: own?.balanceCents ?? 0,
      shareThisPeriodCents: shareOfExpensesCents(userId, expenses),
      openItemCount: openCounts.get(group.id) ?? 0,
    };
  });
}

async function personalOverview(
  userId: string,
  group: GroupSummary,
  now: Date,
): Promise<PersonalOverview> {
  // Only this month's expenses and the open items are loaded, not the whole
  // history (#90). TODO(#77): take the month in the user's time zone, not UTC.
  const month = monthOf(now);
  const { from, before } = monthRange(month);
  const [expenses, openItems] = await Promise.all([
    listGroupExpensesSpentBetween(userId, group.id, from, before),
    listGroupOpenListItems(userId, group.id),
  ]);
  return {
    group,
    // Every expense in the personal space is the owner's alone (#23). The
    // query already kept this month, so the sum is the same rule the personal
    // space page uses.
    spentThisMonthCents: spentInMonthCents(expenses, month),
    openEstimateCents: openEstimateTotalCents(openItems),
    openItems,
  };
}

// The landing screen after login (#10).
export async function getOverview(
  userId: string,
  now: Date = new Date(),
): Promise<Overview> {
  const groups = await listGroups(userId);
  const personalGroup = groups.find((group) => group.isPersonal);
  const [standings, personal] = await Promise.all([
    standingsOf(userId, groups),
    personalGroup ? personalOverview(userId, personalGroup, now) : null,
  ]);
  return {
    ...summarizeBalances(standings.map((group) => group.balanceCents)),
    groupShareThisPeriodCents: standings.reduce(
      (total, group) => total + group.shareThisPeriodCents,
      0,
    ),
    personal,
    groups: standings,
    readOnlyGroups: groups.filter(
      (group) => !group.isPersonal && group.readOnly,
    ),
  };
}
