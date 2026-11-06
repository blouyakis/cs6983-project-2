import type { Balance } from "./balances";

// The fewest payments that clear a group's balances (#19, AGENTS.md Section
// 6.5). Everything is integer cents. The balances are a snapshot taken when
// the settle-up starts; the service turns the result into suggested payments.

export type SuggestedPayment = {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
};

// The group cap (group_member_cap migration), so the exact search below
// stays fast: at most 2^12 subsets and 3^12 subset pairs.
export const MAX_SETTLE_UP_MEMBERS = 12;

// A set of people whose balances add up to zero can be cleared with one
// payment fewer than its size, and never fewer than that. So the fewest
// payments overall is the number of people with a balance minus the most
// zero-sum sets they can be split into. That split is found exactly, over
// every subset, instead of pairing the biggest debtor with the biggest
// creditor, which can need more payments (the test with −6, −5, +2, +4, +5).
export function suggestPayments(
  balances: readonly Balance[],
): SuggestedPayment[] {
  const people = balances.filter((balance) => balance.balanceCents !== 0);
  if (people.some((person) => !Number.isInteger(person.balanceCents))) {
    throw new Error("Balances must be whole cents.");
  }
  if (people.reduce((total, person) => total + person.balanceCents, 0) !== 0) {
    throw new Error("Balances must add up to zero.");
  }
  if (people.length > MAX_SETTLE_UP_MEMBERS) {
    throw new Error(
      `A settle-up covers at most ${MAX_SETTLE_UP_MEMBERS} members.`,
    );
  }
  if (people.length === 0) {
    return [];
  }

  const count = people.length;
  const full = (1 << count) - 1;

  // sums[mask]: the total balance of the people in the mask. A balance is a
  // sum of expenses, so it can pass 2^31; Float64Array is exact to 2^53,
  // where an Int32Array would wrap and a wrapped sum could read as zero.
  const sums = new Float64Array(full + 1);
  for (let mask = 1; mask <= full; mask += 1) {
    const lowest = mask & -mask;
    const index = 31 - Math.clz32(lowest);
    sums[mask] = sums[mask ^ lowest] + people[index].balanceCents;
  }

  // best[mask]: the most zero-sum sets the mask splits into, and the set
  // holding the mask's lowest person in that split, for building the answer.
  const best = new Int32Array(full + 1);
  const chosen = new Int32Array(full + 1);
  for (let mask = 1; mask <= full; mask += 1) {
    const lowest = mask & -mask;
    const rest = mask ^ lowest;
    // Every subset of `rest`, joined with the lowest person, is a candidate
    // for that person's set.
    for (let sub = rest; ; sub = (sub - 1) & rest) {
      const candidate = sub | lowest;
      if (sums[candidate] === 0) {
        const value = 1 + best[mask ^ candidate];
        if (value > best[mask]) {
          best[mask] = value;
          chosen[mask] = candidate;
        }
      }
      if (sub === 0) {
        break;
      }
    }
  }

  const payments: SuggestedPayment[] = [];
  let remaining = full;
  while (remaining !== 0) {
    const set = chosen[remaining];
    payments.push(...clearSet(people, set));
    remaining ^= set;
  }
  return payments;
}

// One payment fewer than the set's size: each payment zeroes a debtor or a
// creditor (or both, with the last), and the set is zero-sum, so nobody is
// left over.
function clearSet(people: readonly Balance[], set: number): SuggestedPayment[] {
  const debtors: { userId: string; cents: number }[] = [];
  const creditors: { userId: string; cents: number }[] = [];
  for (let index = 0; index < people.length; index += 1) {
    if ((set & (1 << index)) === 0) {
      continue;
    }
    const { userId, balanceCents } = people[index];
    if (balanceCents < 0) {
      debtors.push({ userId, cents: -balanceCents });
    } else {
      creditors.push({ userId, cents: balanceCents });
    }
  }

  const payments: SuggestedPayment[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amountCents = Math.min(debtor.cents, creditor.cents);
    payments.push({
      fromUserId: debtor.userId,
      toUserId: creditor.userId,
      amountCents,
    });
    debtor.cents -= amountCents;
    creditor.cents -= amountCents;
    if (debtor.cents === 0) {
      debtorIndex += 1;
    }
    if (creditor.cents === 0) {
      creditorIndex += 1;
    }
  }
  return payments;
}
