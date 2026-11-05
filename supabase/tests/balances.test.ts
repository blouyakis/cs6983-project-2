// getGroupBalances (#9) with the real service and lib/db against the real
// database: the formula over unsettled expenses and confirmed payments, what
// a closed settlement and an unconfirmed payment leave out, and the seed
// group's known balances.
import { afterAll, describe, expect, it } from "vitest";
import { ForbiddenError } from "@/lib/http/errors";
import { getGroupBalances } from "@/lib/services/balance-service";
import { addExpense } from "@/lib/services/expense-service";
import { cleanUp, createGroupWithMembers, createUser, db } from "./fixtures";

afterAll(cleanUp);

async function evenExpense(
  groupId: string,
  payerId: string,
  amountCents: number,
  sharedBy: string[],
): Promise<string> {
  const expense = await addExpense(payerId, groupId, {
    description: "Cost",
    amountCents,
    spentOn: "2026-11-02",
    mode: "even",
    sharedBy,
  });
  return expense.id;
}

async function payment(
  groupId: string,
  fromUserId: string,
  toUserId: string,
  amountCents: number,
  status: "suggested" | "paid" | "confirmed",
  settlementId: string | null = null,
): Promise<void> {
  const paidAt = status === "suggested" ? null : "2026-11-02T10:00:00Z";
  const confirmedAt = status === "confirmed" ? "2026-11-02T12:00:00Z" : null;
  const { error } = await db.from("payments").insert({
    group_id: groupId,
    from_user_id: fromUserId,
    to_user_id: toUserId,
    amount_cents: amountCents,
    status,
    settlement_id: settlementId,
    paid_at: paidAt,
    confirmed_at: confirmedAt,
  });
  if (error) {
    throw error;
  }
}

async function settlement(
  groupId: string,
  startedBy: string,
  status: "open" | "closed",
): Promise<string> {
  const { data, error } = await db
    .from("settlements")
    .insert({
      group_id: groupId,
      started_by: startedBy,
      status,
      closed_at: status === "closed" ? "2026-11-01T00:00:00Z" : null,
    })
    .select("id")
    .single();
  if (error) {
    throw error;
  }
  return data.id as string;
}

async function settle(expenseId: string, settlementId: string): Promise<void> {
  const { error } = await db
    .from("expenses")
    .update({ settlement_id: settlementId })
    .eq("id", expenseId);
  if (error) {
    throw error;
  }
}

function cents(
  balances: { userId: string; balanceCents: number }[],
  userId: string,
): number | undefined {
  return balances.find((balance) => balance.userId === userId)?.balanceCents;
}

describe("getGroupBalances", () => {
  it("is paid minus shares: $12.34 by A and $30.00 by B, split evenly", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [a, b] = memberIds;
    await evenExpense(groupId, a, 1234, memberIds);
    await evenExpense(groupId, b, 3000, memberIds);

    const balances = await getGroupBalances(a, groupId);

    expect(cents(balances, a)).toBe(-883);
    expect(cents(balances, b)).toBe(883);
  });

  it("is zero for both after a confirmed 883 payment from A to B", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [a, b] = memberIds;
    await evenExpense(groupId, a, 1234, memberIds);
    await evenExpense(groupId, b, 3000, memberIds);
    await payment(groupId, a, b, 883, "confirmed");

    const balances = await getGroupBalances(a, groupId);

    expect(cents(balances, a)).toBe(0);
    expect(cents(balances, b)).toBe(0);
  });

  it("ignores suggested and paid payments until the recipient confirms", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [a, b] = memberIds;
    await evenExpense(groupId, b, 3000, memberIds);
    const open = await settlement(groupId, a, "open");
    await payment(groupId, a, b, 500, "suggested", open);
    await payment(groupId, a, b, 700, "paid");

    const balances = await getGroupBalances(a, groupId);

    expect(cents(balances, a)).toBe(-1500);
    expect(cents(balances, b)).toBe(1500);
  });

  it("leaves out expenses and payments of a closed settlement", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [a, b] = memberIds;
    const closed = await settlement(groupId, a, "closed");
    const old = await evenExpense(groupId, a, 10_000, memberIds);
    await settle(old, closed);
    await payment(groupId, b, a, 5000, "confirmed", closed);
    await evenExpense(groupId, b, 1000, memberIds);

    const balances = await getGroupBalances(a, groupId);

    expect(cents(balances, a)).toBe(-500);
    expect(cents(balances, b)).toBe(500);
  });

  it("still counts expenses in the open settlement, which is the current period", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [a, b] = memberIds;
    const open = await settlement(groupId, a, "open");
    const inSettlement = await evenExpense(groupId, a, 1000, memberIds);
    await settle(inSettlement, open);

    const balances = await getGroupBalances(a, groupId);

    expect(cents(balances, a)).toBe(500);
    expect(cents(balances, b)).toBe(-500);
  });

  it("gives a member with nothing yet a balance of zero", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);

    const balances = await getGroupBalances(memberIds[0], groupId);

    expect(balances).toEqual(
      memberIds.map((userId) => ({ userId, balanceCents: 0 })),
    );
  });

  it("refuses someone outside the group with 403", async () => {
    const { groupId } = await createGroupWithMembers(2);
    const outsider = await createUser();

    await expect(getGroupBalances(outsider, groupId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("matches the seed group: Demo +198, Jo -802, Sam +604", async () => {
    const { data: users, error } = await db
      .from("users")
      .select("id, name, email")
      .in("email", [
        "demo@lifeboard.test",
        "sam@lifeboard.test",
        "jo@lifeboard.test",
      ]);
    if (error) {
      throw error;
    }
    const byName = new Map(users.map((user) => [user.name, user.id]));
    const demo = byName.get("Demo") as string;
    const { data: flat } = await db
      .from("groups")
      .select("id")
      .eq("created_by", demo)
      .eq("name", "Flat")
      .single();

    const balances = await getGroupBalances(demo, flat!.id as string);

    expect(cents(balances, demo)).toBe(198);
    expect(cents(balances, byName.get("Jo") as string)).toBe(-802);
    expect(cents(balances, byName.get("Sam") as string)).toBe(604);
    expect(balances.reduce((sum, b) => sum + b.balanceCents, 0)).toBe(0);
  });
});
