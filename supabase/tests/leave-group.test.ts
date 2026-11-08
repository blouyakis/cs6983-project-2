// leave_group (#22, AGENTS.md user flow 8 and Sections 6.8 and 6.9): a
// current member of a shared group leaves when their balance for the current
// period is zero and no payment to or from them is still waiting, with
// left_at from the database's clock (#75). When the last member leaves, the
// group is archived at the same moment. A personal space can't be left (#81
// review). P0001 with a hint for each refusal, as record_payment does, so the
// app tells them apart without reading the message.
import { afterAll, describe, expect, it } from "vitest";
import {
  anonDb,
  cleanUp,
  createGroupWithMembers,
  createUser,
  db,
  dbNow,
  trackUser,
  uniqueEmail,
} from "./fixtures";

afterAll(cleanUp);

function leave(groupId: string, userId: string) {
  return db.rpc("leave_group", { p_group_id: groupId, p_user_id: userId });
}

// An even split among the sharers; amounts here always divide evenly.
async function addExpense(
  groupId: string,
  payerId: string,
  sharerIds: string[],
  amountCents: number,
): Promise<string> {
  const each = amountCents / sharerIds.length;
  const { data, error } = await db.rpc("create_expense", {
    p_group_id: groupId,
    p_description: "Groceries",
    p_amount_cents: amountCents,
    p_payer_id: payerId,
    p_spent_on: "2026-11-01",
    p_shares: sharerIds.map((id) => ({ user_id: id, share_cents: each })),
  });
  if (error) {
    throw error;
  }
  return data as string;
}

async function recordPayment(
  groupId: string,
  fromUserId: string,
  toUserId: string,
  amountCents: number,
): Promise<string> {
  const { data, error } = await db.rpc("record_payment", {
    p_group_id: groupId,
    p_from_user_id: fromUserId,
    p_to_user_id: toUserId,
    p_amount_cents: amountCents,
  });
  if (error) {
    throw error;
  }
  return data as string;
}

async function confirm(paymentId: string): Promise<void> {
  const { error } = await db.rpc("confirm_payment", {
    p_payment_id: paymentId,
  });
  if (error) {
    throw error;
  }
}

async function membership(groupId: string, userId: string) {
  const { data, error } = await db
    .from("group_members")
    .select("left_at")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .single();
  if (error) {
    throw error;
  }
  return data as { left_at: string | null };
}

async function archivedAt(groupId: string): Promise<string | null> {
  const { data, error } = await db
    .from("groups")
    .select("archived_at")
    .eq("id", groupId)
    .single();
  if (error) {
    throw error;
  }
  return data.archived_at as string | null;
}

// Starts a settle-up with the given suggested payments, at the database's
// clock, with the balances the payments clear.
async function startSettleUp(
  groupId: string,
  startedBy: string,
  payments: { from: string; to: string; cents: number }[],
): Promise<string> {
  const balances = new Map<string, number>();
  for (const { from, to, cents } of payments) {
    balances.set(from, (balances.get(from) ?? 0) - cents);
    balances.set(to, (balances.get(to) ?? 0) + cents);
  }
  const { data, error } = await db.rpc("start_settlement", {
    p_group_id: groupId,
    p_started_by: startedBy,
    p_started_at: await dbNow(),
    p_balances: [...balances].map(([userId, cents]) => ({
      user_id: userId,
      balance_cents: cents,
    })),
    p_payments: payments.map(({ from, to, cents }) => ({
      from_user_id: from,
      to_user_id: to,
      amount_cents: cents,
    })),
  });
  if (error) {
    throw error;
  }
  return data as string;
}

async function suggestedPayment(
  settlementId: string,
  fromUserId: string,
): Promise<string> {
  const { data, error } = await db
    .from("payments")
    .select("id")
    .eq("settlement_id", settlementId)
    .eq("from_user_id", fromUserId)
    .single();
  if (error) {
    throw error;
  }
  return data.id as string;
}

async function markPaid(paymentId: string): Promise<void> {
  const { error } = await db
    .from("payments")
    .update({ status: "paid", paid_at: await dbNow() })
    .eq("id", paymentId);
  if (error) {
    throw error;
  }
}

describe("leave_group", () => {
  it("lets a member with nothing owed leave, with left_at from the database's clock", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    const before = await dbNow();

    const { error } = await leave(groupId, memberIds[1]);
    const after = await dbNow();

    expect(error).toBeNull();
    const leftAt = (await membership(groupId, memberIds[1])).left_at;
    expect(leftAt).not.toBeNull();
    expect(Date.parse(leftAt!)).toBeGreaterThanOrEqual(Date.parse(before));
    expect(Date.parse(leftAt!)).toBeLessThanOrEqual(Date.parse(after));
    expect((await membership(groupId, memberIds[0])).left_at).toBeNull();
    expect(await archivedAt(groupId)).toBeNull();
  });

  it("refuses a member who owes money", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    await addExpense(groupId, memberIds[0], memberIds, 1000);

    const { error } = await leave(groupId, memberIds[1]);

    expect(error?.code).toBe("P0001");
    expect(error?.hint).toBe("nonzero_balance");
    expect((await membership(groupId, memberIds[1])).left_at).toBeNull();
  });

  it("refuses a member who is owed money", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    await addExpense(groupId, memberIds[0], memberIds, 1000);

    const { error } = await leave(groupId, memberIds[0]);

    expect(error?.code).toBe("P0001");
    expect(error?.hint).toBe("nonzero_balance");
    expect((await membership(groupId, memberIds[0])).left_at).toBeNull();
  });

  it("lets a member leave once a confirmed direct payment evens them out", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    await addExpense(groupId, memberIds[0], memberIds, 1000);
    await confirm(
      await recordPayment(groupId, memberIds[1], memberIds[0], 500),
    );

    const { error } = await leave(groupId, memberIds[1]);

    expect(error).toBeNull();
    expect((await membership(groupId, memberIds[1])).left_at).not.toBeNull();
  });

  it("counts a confirmed payment of the open settle-up in the balance", async () => {
    // Ana paid 900 for all three: Ren and Jo each owe her 300. Ren's
    // suggested payment is confirmed, Jo's isn't, so the settle-up stays open
    // and Ren's balance is zero.
    const { groupId, memberIds } = await createGroupWithMembers(3);
    const [ana, ren, jo] = memberIds;
    await addExpense(groupId, ana, memberIds, 900);
    const settlementId = await startSettleUp(groupId, ana, [
      { from: ren, to: ana, cents: 300 },
      { from: jo, to: ana, cents: 300 },
    ]);
    const rensPayment = await suggestedPayment(settlementId, ren);
    await markPaid(rensPayment);
    await confirm(rensPayment);

    const { error } = await leave(groupId, ren);

    expect(error).toBeNull();
    expect((await membership(groupId, ren)).left_at).not.toBeNull();
  });

  it.each([
    ["to", 0, 1],
    ["from", 1, 0],
  ])(
    "refuses a member with a payment %s them that is paid but not confirmed",
    async (_case, fromIndex, toIndex) => {
      const { groupId, memberIds } = await createGroupWithMembers(2);
      await recordPayment(
        groupId,
        memberIds[fromIndex],
        memberIds[toIndex],
        500,
      );

      const { error } = await leave(groupId, memberIds[1]);

      expect(error?.code).toBe("P0001");
      expect(error?.hint).toBe("pending_payment");
      expect((await membership(groupId, memberIds[1])).left_at).toBeNull();
    },
  );

  it("refuses a member in a suggested payment of the open settle-up, even at a zero balance", async () => {
    // Ren owes Ana 500 when the settle-up starts. A cost Ren pays afterwards
    // brings his balance to zero, but the settle-up can only close once his
    // suggested payment is paid and confirmed.
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [ana, ren] = memberIds;
    await addExpense(groupId, ana, memberIds, 1000);
    await startSettleUp(groupId, ana, [{ from: ren, to: ana, cents: 500 }]);
    await addExpense(groupId, ren, memberIds, 1000);

    const { error } = await leave(groupId, ren);

    expect(error?.code).toBe("P0001");
    expect(error?.hint).toBe("pending_payment");
    expect((await membership(groupId, ren)).left_at).toBeNull();
  });

  it("lets a member with nothing owed leave while a settle-up they aren't in is open", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    const [ana, ren, jo] = memberIds;
    await addExpense(groupId, ana, [ana, ren], 1000);
    await startSettleUp(groupId, ana, [{ from: ren, to: ana, cents: 500 }]);

    const { error } = await leave(groupId, jo);

    expect(error).toBeNull();
    expect((await membership(groupId, jo)).left_at).not.toBeNull();
  });

  it("refuses the owner of a personal space, who stays its member", async () => {
    const { data, error: registerError } = await db.rpc("register_user", {
      p_email: uniqueEmail(),
      p_password_hash: "hash",
      p_name: "Ana",
    });
    if (registerError) {
      throw registerError;
    }
    const ownerId = data as string;
    trackUser(ownerId);
    const space = await db
      .from("groups")
      .select("id")
      .eq("created_by", ownerId)
      .eq("is_personal", true)
      .single();
    if (space.error) {
      throw space.error;
    }

    const { error } = await leave(space.data.id as string, ownerId);

    expect(error?.code).toBe("P0001");
    expect(error?.hint).toBe("personal_space");
    expect((await membership(space.data.id as string, ownerId)).left_at).toBe(
      null,
    );
    expect(await archivedAt(space.data.id as string)).toBeNull();
  });

  it("refuses a member who already left, and keeps their first left_at", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    await leave(groupId, memberIds[1]);
    const first = (await membership(groupId, memberIds[1])).left_at;

    const { error } = await leave(groupId, memberIds[1]);

    expect(error?.code).toBe("P0001");
    expect(error?.hint).toBe("not_member");
    expect((await membership(groupId, memberIds[1])).left_at).toBe(first);
  });

  it("refuses someone who was never in the group", async () => {
    const { groupId } = await createGroupWithMembers(2);
    const stranger = await createUser();

    const { error } = await leave(groupId, stranger);

    expect(error?.code).toBe("P0001");
    expect(error?.hint).toBe("not_member");
  });

  it("keeps a group with one member left working, unarchived", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);

    await leave(groupId, memberIds[1]);

    expect(await archivedAt(groupId)).toBeNull();
    expect((await membership(groupId, memberIds[0])).left_at).toBeNull();
  });

  it("archives the group when its last member leaves, at the moment they left", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    await leave(groupId, memberIds[1]);

    const { error } = await leave(groupId, memberIds[0]);

    expect(error).toBeNull();
    const leftAt = (await membership(groupId, memberIds[0])).left_at;
    expect(leftAt).not.toBeNull();
    expect(await archivedAt(groupId)).toBe(leftAt);
  });

  it("is not callable by the browser", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);

    const { error } = await anonDb().rpc("leave_group", {
      p_group_id: groupId,
      p_user_id: memberIds[1],
    });

    expect(error?.code).toBe("42501");
    expect((await membership(groupId, memberIds[1])).left_at).toBeNull();
  });
});
