// getOverview (#10) with the real services and lib/db against the real
// database: each group's balance is the one #9 gives, and the net is their
// sum.
import { afterAll, describe, expect, it } from "vitest";
import { getGroupBalances } from "@/lib/services/balance-service";
import { addExpense } from "@/lib/services/expense-service";
import { getOverview } from "@/lib/services/overview-service";
import { cleanUp, createGroupWithMembers, createUser, db } from "./fixtures";

afterAll(cleanUp);

async function evenExpense(
  groupId: string,
  payerId: string,
  amountCents: number,
  sharedBy: string[],
): Promise<void> {
  await addExpense(payerId, groupId, {
    description: "Cost",
    amountCents,
    spentOn: "2026-11-02",
    mode: "even",
    sharedBy,
  });
}

// A second group for a user who is already in one, with one other member.
async function joinNewGroup(
  userId: string,
): Promise<{ groupId: string; otherId: string }> {
  const other = await createUser();
  const group = await db
    .from("groups")
    .insert({ name: "Picnic", created_by: other })
    .select("id")
    .single();
  if (group.error) {
    throw group.error;
  }
  const groupId: string = group.data.id;
  const { error } = await db.from("group_members").insert(
    [other, userId].map((memberId) => ({
      group_id: groupId,
      user_id: memberId,
      default_share_weight: 1,
    })),
  );
  if (error) {
    throw error;
  }
  return { groupId, otherId: other };
}

async function balanceOf(userId: string, groupId: string): Promise<number> {
  const balances = await getGroupBalances(userId, groupId);
  return balances.find((balance) => balance.userId === userId)
    ?.balanceCents as number;
}

describe("the overview in the database", () => {
  it("nets −883 in one group and +500 in another to −383, matching #9's balances", async () => {
    const dorm = await createGroupWithMembers(2);
    const [ana, sam] = dorm.memberIds;
    const { groupId: picnicId, otherId: jo } = await joinNewGroup(ana);
    await evenExpense(dorm.groupId, sam, 1766, [ana, sam]);
    await evenExpense(picnicId, ana, 1000, [ana, jo]);

    const overview = await getOverview(ana);

    const dormBalance = await balanceOf(ana, dorm.groupId);
    const picnicBalance = await balanceOf(ana, picnicId);
    expect([dormBalance, picnicBalance]).toEqual([-883, 500]);
    expect(
      Object.fromEntries(
        overview.groups.map((group) => [group.id, group.balanceCents]),
      ),
    ).toEqual({ [dorm.groupId]: -883, [picnicId]: 500 });
    expect(overview.netCents).toBe(dormBalance + picnicBalance);
    expect(overview.owingCents).toBe(883);
    expect(overview.owedCents).toBe(500);
    // Ana's shares: 883 of Sam's cost, 500 of her own.
    expect(overview.groupShareThisPeriodCents).toBe(1383);
  });
});
