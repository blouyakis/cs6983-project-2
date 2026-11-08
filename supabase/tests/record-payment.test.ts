// record_payment (#14, AGENTS.md user flow 6): a member records money they
// sent to another current member outside the app. It starts as paid, with
// paid_at from the database's clock, so the recipient's confirmation (also
// stamped by the database) is never earlier than it.
import { afterAll, describe, expect, it } from "vitest";
import {
  anonDb,
  cleanUp,
  createGroupWithMembers,
  createUser,
  db,
} from "./fixtures";

afterAll(cleanUp);

async function dbNow(): Promise<string> {
  const { data, error } = await db.rpc("db_now");
  if (error) {
    throw error;
  }
  return data as string;
}

function record(
  groupId: string,
  fromUserId: string,
  toUserId: string,
  amountCents: number,
) {
  return db.rpc("record_payment", {
    p_group_id: groupId,
    p_from_user_id: fromUserId,
    p_to_user_id: toUserId,
    p_amount_cents: amountCents,
  });
}

async function leave(groupId: string, userId: string) {
  const { error } = await db
    .from("group_members")
    .update({ left_at: await dbNow() })
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) {
    throw error;
  }
}

async function paymentsIn(groupId: string) {
  const { data, error } = await db
    .from("payments")
    .select(
      "id, from_user_id, to_user_id, amount_cents, status, settlement_id, paid_at, confirmed_at",
    )
    .eq("group_id", groupId);
  if (error) {
    throw error;
  }
  return data;
}

describe("record_payment", () => {
  it("records a paid payment with paid_at from the database's clock", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const before = await dbNow();

    const { data: id, error } = await record(
      groupId,
      memberIds[0],
      memberIds[1],
      883,
    );
    const after = await dbNow();

    expect(error).toBeNull();
    const [payment] = await paymentsIn(groupId);
    expect(payment).toMatchObject({
      id,
      from_user_id: memberIds[0],
      to_user_id: memberIds[1],
      amount_cents: 883,
      status: "paid",
      settlement_id: null,
      confirmed_at: null,
    });
    const paidAt = Date.parse(payment.paid_at as string);
    expect(paidAt).toBeGreaterThanOrEqual(Date.parse(before));
    expect(paidAt).toBeLessThanOrEqual(Date.parse(after));
  });

  it("can be confirmed straight away", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const { data: id } = await record(groupId, memberIds[0], memberIds[1], 500);

    const { error } = await db.rpc("confirm_payment", { p_payment_id: id });

    expect(error).toBeNull();
    const [payment] = await paymentsIn(groupId);
    expect(payment.status).toBe("confirmed");
  });

  it("refuses a recipient who left the group", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    await leave(groupId, memberIds[1]);

    const { error } = await record(groupId, memberIds[0], memberIds[1], 500);

    expect(error?.code).toBe("P0001");
    expect(error?.hint).toBe("recipient_not_member");
    expect(await paymentsIn(groupId)).toEqual([]);
  });

  it("refuses a recipient who was never in the group", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const stranger = await createUser();

    const { error } = await record(groupId, memberIds[0], stranger, 500);

    expect(error?.code).toBe("P0001");
    expect(error?.hint).toBe("recipient_not_member");
    expect(await paymentsIn(groupId)).toEqual([]);
  });

  it("refuses a sender who left the group", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    await leave(groupId, memberIds[0]);

    const { error } = await record(groupId, memberIds[0], memberIds[1], 500);

    expect(error?.code).toBe("P0001");
    expect(error?.hint).toBe("sender_not_member");
    expect(await paymentsIn(groupId)).toEqual([]);
  });

  it.each([
    ["to yourself", 0, 500],
    ["of 0 cents", 1, 0],
    ["below 0 cents", 1, -1],
  ])("refuses a payment %s", async (_case, toIndex, amountCents) => {
    const { groupId, memberIds } = await createGroupWithMembers(2);

    const { error } = await record(
      groupId,
      memberIds[0],
      memberIds[toIndex],
      amountCents,
    );

    expect(error?.code).toBe("23514");
    expect(await paymentsIn(groupId)).toEqual([]);
  });

  it("is not callable by the browser", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);

    const { error } = await anonDb().rpc("record_payment", {
      p_group_id: groupId,
      p_from_user_id: memberIds[0],
      p_to_user_id: memberIds[1],
      p_amount_cents: 500,
    });

    expect(error?.code).toBe("42501");
  });
});
