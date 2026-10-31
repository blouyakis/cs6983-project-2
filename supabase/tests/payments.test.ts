import { afterAll, describe, expect, it } from "vitest";
import {
  anonDb,
  cleanUp,
  createGroupWithMembers,
  createUser,
  db,
} from "./fixtures";

afterAll(cleanUp);

// Fixed times, so no test depends on this machine's clock matching the database's.
const PAID = "2026-10-21T00:00:00Z";
const CONFIRMED = "2026-10-22T00:00:00Z";

function directPayment(groupId: string, fromId: string, toId: string) {
  return {
    group_id: groupId,
    from_user_id: fromId,
    to_user_id: toId,
    amount_cents: 2000,
    status: "paid",
    paid_at: PAID,
  };
}

async function startSettlement(groupId: string, startedBy: string) {
  const { data, error } = await db
    .from("settlements")
    .insert({ group_id: groupId, started_by: startedBy })
    .select("id")
    .single();
  if (error) {
    throw error;
  }
  return data.id as string;
}

describe("payments table", () => {
  it("records a direct payment that the sender marked paid", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);

    const { data, error } = await db
      .from("payments")
      .insert(directPayment(groupId, memberIds[1], memberIds[0]))
      .select("status, settlement_id, confirmed_at, created_at")
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      status: "paid",
      settlement_id: null,
      confirmed_at: null,
    });
    expect(data!.created_at).toBeTruthy();
  });

  it("moves a suggested payment to paid, then to confirmed", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const settlementId = await startSettlement(groupId, memberIds[0]);
    const created = await db
      .from("payments")
      .insert({
        group_id: groupId,
        from_user_id: memberIds[1],
        to_user_id: memberIds[0],
        amount_cents: 2000,
        status: "suggested",
        settlement_id: settlementId,
      })
      .select("id")
      .single();

    const paid = await db
      .from("payments")
      .update({ status: "paid", paid_at: PAID })
      .eq("id", created.data!.id);
    const confirmed = await db
      .from("payments")
      .update({ status: "confirmed", confirmed_at: CONFIRMED })
      .eq("id", created.data!.id);

    expect(created.error).toBeNull();
    expect(paid.error).toBeNull();
    expect(confirmed.error).toBeNull();
  });

  it("only suggests payments as part of a settle-up", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);

    const { error } = await db.from("payments").insert({
      group_id: groupId,
      from_user_id: memberIds[1],
      to_user_id: memberIds[0],
      amount_cents: 2000,
      status: "suggested",
    });

    expect(error?.code).toBe("23514");
    expect(error?.message).toContain("payments_suggested_has_settlement");
  });

  it("rejects an amount of zero or less", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);

    const { error } = await db.from("payments").insert({
      ...directPayment(groupId, memberIds[1], memberIds[0]),
      amount_cents: 0,
    });

    expect(error?.code).toBe("23514");
    expect(error?.message).toContain("payments_amount_positive");
  });

  it("rejects paying yourself", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);

    const { error } = await db
      .from("payments")
      .insert(directPayment(groupId, memberIds[0], memberIds[0]));

    expect(error?.code).toBe("23514");
    expect(error?.message).toContain("payments_different_people");
  });

  it("rejects an unknown status", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);

    const { error } = await db.from("payments").insert({
      ...directPayment(groupId, memberIds[1], memberIds[0]),
      status: "pending",
    });

    expect(error?.code).toBe("23514");
    expect(error?.message).toContain("payments_status_valid");
  });

  it("requires the times that match the status", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const base = directPayment(groupId, memberIds[1], memberIds[0]);

    const paidWithoutTime = await db
      .from("payments")
      .insert({ ...base, paid_at: null });
    const confirmedWithoutTime = await db
      .from("payments")
      .insert({ ...base, status: "confirmed" });
    const paidAlreadyConfirmed = await db
      .from("payments")
      .insert({ ...base, confirmed_at: CONFIRMED });

    for (const { error } of [
      paidWithoutTime,
      confirmedWithoutTime,
      paidAlreadyConfirmed,
    ]) {
      expect(error?.code).toBe("23514");
      expect(error?.message).toContain("payments_times_match_status");
    }
  });

  it("rejects a confirmation before the payment", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);

    const { error } = await db.from("payments").insert({
      ...directPayment(groupId, memberIds[1], memberIds[0]),
      status: "confirmed",
      paid_at: CONFIRMED,
      confirmed_at: PAID,
    });

    expect(error?.code).toBe("23514");
    expect(error?.message).toContain("payments_confirmed_after_paid");
  });

  it("is only between members of the group", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);
    const stranger = await createUser();

    const fromStranger = await db
      .from("payments")
      .insert(directPayment(groupId, stranger, memberIds[0]));
    const toStranger = await db
      .from("payments")
      .insert(directPayment(groupId, memberIds[0], stranger));

    expect(fromStranger.error?.code).toBe("23503");
    expect(fromStranger.error?.message).toContain("payments_from_is_member");
    expect(toStranger.error?.code).toBe("23503");
    expect(toStranger.error?.message).toContain("payments_to_is_member");
  });

  it("can only belong to a settlement of its own group", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const other = await createGroupWithMembers(1);
    const foreign = await startSettlement(other.groupId, other.memberIds[0]);

    const { error } = await db.from("payments").insert({
      ...directPayment(groupId, memberIds[1], memberIds[0]),
      settlement_id: foreign,
    });

    expect(error?.code).toBe("23503");
    expect(error?.message).toContain("payments_settlement_in_group");
  });

  it("is closed to the anon key", async () => {
    const { error } = await anonDb().from("payments").select("id");

    expect(error?.code).toBe("42501");
  });
});
