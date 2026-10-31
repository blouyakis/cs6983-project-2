import { afterAll, describe, expect, it } from "vitest";
import {
  anonDb,
  cleanUp,
  createGroupWithMembers,
  createUser,
  db,
} from "./fixtures";

afterAll(cleanUp);

// Zero, so these rows need no shares once shares must add up to the amount
// (expense-shares.test.ts). An expense with a cost is created with its shares.
function expense(groupId: string, payerId: string) {
  return {
    group_id: groupId,
    description: "Electricity",
    amount_cents: 0,
    payer_id: payerId,
    spent_on: "2026-10-20",
  };
}

describe("expenses table", () => {
  it("stores an unsettled, unedited expense paid by a member", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);

    const { data, error } = await db
      .from("expenses")
      .insert(expense(groupId, memberIds[0]))
      .select("description, spent_on, settlement_id, created_at, edited_at")
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      description: "Electricity",
      spent_on: "2026-10-20",
      settlement_id: null,
      edited_at: null,
    });
    expect(data!.created_at).toBeTruthy();
  });

  it("rejects a negative amount", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);

    const { error } = await db
      .from("expenses")
      .insert({ ...expense(groupId, memberIds[0]), amount_cents: -1 });

    expect(error?.code).toBe("23514");
    expect(error?.message).toContain("expenses_amount_not_negative");
  });

  it("rejects an amount that is not whole cents", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);

    const { error } = await db
      .from("expenses")
      .insert({ ...expense(groupId, memberIds[0]), amount_cents: 12.5 });

    expect(error?.code).toBe("22P02");
  });

  it("requires the payer to be a member of the group", async () => {
    const { groupId } = await createGroupWithMembers(1);
    const other = await createGroupWithMembers(1);
    const stranger = await createUser();

    const byStranger = await db
      .from("expenses")
      .insert(expense(groupId, stranger));
    const byOtherGroup = await db
      .from("expenses")
      .insert(expense(groupId, other.memberIds[0]));

    expect(byStranger.error?.code).toBe("23503");
    expect(byStranger.error?.message).toContain("expenses_payer_is_member");
    expect(byOtherGroup.error?.code).toBe("23503");
  });

  it("keeps a former member's expenses", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const { data } = await db
      .from("expenses")
      .insert(expense(groupId, memberIds[1]))
      .select("id")
      .single();

    const leaving = await db
      .from("group_members")
      .update({ left_at: "2099-01-01T00:00:00Z" })
      .eq("group_id", groupId)
      .eq("user_id", memberIds[1]);
    const still = await db.from("expenses").select("id").eq("id", data!.id);

    expect(leaving.error).toBeNull();
    expect(still.data).toHaveLength(1);
  });

  it("can only belong to a settlement of its own group", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);
    const other = await createGroupWithMembers(1);
    const settlements = await db
      .from("settlements")
      .insert([
        { group_id: groupId, started_by: memberIds[0] },
        { group_id: other.groupId, started_by: other.memberIds[0] },
      ])
      .select("id, group_id");
    const own = settlements.data!.find((row) => row.group_id === groupId)!;
    const foreign = settlements.data!.find((row) => row.group_id !== groupId)!;

    const inOwn = await db
      .from("expenses")
      .insert({ ...expense(groupId, memberIds[0]), settlement_id: own.id });
    const inForeign = await db
      .from("expenses")
      .insert({ ...expense(groupId, memberIds[0]), settlement_id: foreign.id });

    expect(inOwn.error).toBeNull();
    expect(inForeign.error?.code).toBe("23503");
    expect(inForeign.error?.message).toContain("expenses_settlement_in_group");
  });

  it("is closed to the anon key", async () => {
    const { error } = await anonDb().from("expenses").select("id");

    expect(error?.code).toBe("42501");
  });
});
