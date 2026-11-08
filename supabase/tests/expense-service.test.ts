// addExpense and listGroupExpenses (#7) with the real service and lib/db
// against the real database: the split is written with its expense, the list
// comes back newest first with its shares, and a former member only sees what
// was added before they left.
import { afterAll, describe, expect, it } from "vitest";
import { findExpense } from "@/lib/db/expenses";
import { ForbiddenError, ValidationError } from "@/lib/http/errors";
import { addExpense, listGroupExpenses } from "@/lib/services/expense-service";
import type { CreateExpenseInput } from "@/lib/validation/expense";
import {
  cleanUp,
  createGroupWithMembers,
  createUser,
  db,
  dbNow,
} from "./fixtures";

afterAll(cleanUp);

function even(
  sharedBy: string[],
  overrides: Partial<CreateExpenseInput> = {},
): CreateExpenseInput {
  return {
    description: "Electricity",
    amountCents: 1001,
    spentOn: "2026-11-02",
    mode: "even",
    sharedBy,
    ...overrides,
  } as CreateExpenseInput;
}

async function setMembership(
  groupId: string,
  userId: string,
  leftAt: string | null,
): Promise<void> {
  const { error } = await db
    .from("group_members")
    .update({ left_at: leftAt })
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) {
    throw error;
  }
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("addExpense", () => {
  it("saves an even split that adds up, with the leftover cents on the payer", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    const [payer, second, third] = memberIds;

    const expense = await addExpense(payer, groupId, even(memberIds));

    expect(expense).toMatchObject({
      groupId,
      description: "Electricity",
      amountCents: 1001,
      payerId: payer,
      spentOn: "2026-11-02",
      settled: false,
      editedAt: null,
    });
    const shares = new Map(expense.shares.map((s) => [s.userId, s.shareCents]));
    expect(shares.get(payer)).toBe(335);
    expect(shares.get(second)).toBe(333);
    expect(shares.get(third)).toBe(333);
    expect(expense.shares.reduce((sum, s) => sum + s.shareCents, 0)).toBe(1001);
  });

  it("makes whoever adds it the payer", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);

    const expense = await addExpense(memberIds[1], groupId, even(memberIds));

    expect(expense.payerId).toBe(memberIds[1]);
    expect(expense.shares.find((s) => s.userId === memberIds[1])).toEqual({
      userId: memberIds[1],
      shareCents: 501,
    });
  });

  it("saves custom amounts exactly as entered", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [payer, other] = memberIds;

    const expense = await addExpense(payer, groupId, {
      description: "Gift for Sam",
      amountCents: 1001,
      spentOn: "2026-11-02",
      mode: "custom",
      sharedBy: [payer, other],
      amountsCents: { [payer]: 0, [other]: 1001 },
    });

    expect(expense.shares).toHaveLength(2);
    expect(expense.shares).toEqual(
      expect.arrayContaining([
        { userId: payer, shareCents: 0 },
        { userId: other, shareCents: 1001 },
      ]),
    );
  });

  it("saves an amount of 0, and every share is 0", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);

    const expense = await addExpense(
      memberIds[0],
      groupId,
      even(memberIds, { amountCents: 0 }),
    );

    expect(expense.amountCents).toBe(0);
    expect(expense.shares.map((s) => s.shareCents)).toEqual([0, 0]);
  });

  it("splits only among the people chosen", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);

    const expense = await addExpense(
      memberIds[0],
      groupId,
      even([memberIds[0], memberIds[2]], { amountCents: 1000 }),
    );

    expect(expense.shares.map((s) => s.userId).sort()).toEqual(
      [memberIds[0], memberIds[2]].sort(),
    );
  });

  it("rejects a sharer who isn't a member, and writes nothing", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const outsider = await createUser();

    await expect(
      addExpense(memberIds[0], groupId, even([memberIds[0], outsider])),
    ).rejects.toMatchObject({
      status: 400,
      fields: { sharedBy: expect.any(String) },
    });
    expect(await listGroupExpenses(memberIds[0], groupId)).toEqual([]);
  });

  it("rejects a sharer who has left the group", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    await setMembership(groupId, memberIds[1], await dbNow());

    await expect(
      addExpense(memberIds[0], groupId, even(memberIds)),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects sharers that leave out the payer", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);

    await expect(
      addExpense(memberIds[0], groupId, even([memberIds[1], memberIds[2]])),
    ).rejects.toMatchObject({
      status: 400,
      fields: { sharedBy: expect.stringMatching(/payer/) },
    });
  });

  it("gives a former member a 403, and writes nothing", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    await setMembership(groupId, memberIds[1], await dbNow());

    await expect(
      addExpense(memberIds[1], groupId, even([memberIds[1]])),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await listGroupExpenses(memberIds[0], groupId)).toEqual([]);
  });

  it("gives someone who was never in the group a 403", async () => {
    const { groupId } = await createGroupWithMembers(2);
    const outsider = await createUser();

    await expect(
      addExpense(outsider, groupId, even([outsider])),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("gives an archived group a 403", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);
    const { error } = await db
      .from("groups")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", groupId);
    expect(error).toBeNull();

    await expect(
      addExpense(memberIds[0], groupId, even(memberIds)),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("listGroupExpenses", () => {
  it("lists newest day first, and within a day the newest entry first", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [payer] = memberIds;
    const older = await addExpense(
      payer,
      groupId,
      even(memberIds, { description: "Older", spentOn: "2026-10-30" }),
    );
    const morning = await addExpense(
      payer,
      groupId,
      even(memberIds, { description: "Morning", spentOn: "2026-11-02" }),
    );
    await pause(20);
    const evening = await addExpense(
      payer,
      groupId,
      even(memberIds, { description: "Evening", spentOn: "2026-11-02" }),
    );

    const listed = await listGroupExpenses(payer, groupId);

    expect(listed.map((expense) => expense.id)).toEqual([
      evening.id,
      morning.id,
      older.id,
    ]);
  });

  it("returns each expense with its shares, and only this group's expenses", async () => {
    const flat = await createGroupWithMembers(2);
    const trip = await createGroupWithMembers(2);
    const added = await addExpense(
      flat.memberIds[0],
      flat.groupId,
      even(flat.memberIds),
    );
    await addExpense(trip.memberIds[0], trip.groupId, even(trip.memberIds));

    const listed = await listGroupExpenses(flat.memberIds[0], flat.groupId);

    expect(listed.map((expense) => expense.id)).toEqual([added.id]);
    expect(listed[0].shares).toHaveLength(2);
    expect(listed[0].shares).toEqual(expect.arrayContaining(added.shares));
  });

  it("lets any current member read the group's expenses", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const added = await addExpense(memberIds[0], groupId, even(memberIds));

    const seen = await listGroupExpenses(memberIds[1], groupId);

    expect(seen.map((expense) => expense.id)).toEqual([added.id]);
  });

  it("shows a former member only what was added before they left", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [stays, leaves] = memberIds;
    const before = await addExpense(stays, groupId, even(memberIds));
    // The database stamps created_at, so leave just after it, by its own clock.
    const leftAt = new Date(Date.parse(before.createdAt) + 5).toISOString();
    await pause(30);
    await setMembership(groupId, leaves, leftAt);
    await addExpense(stays, groupId, even([stays]));

    const seen = await listGroupExpenses(leaves, groupId);

    expect(seen.map((expense) => expense.id)).toEqual([before.id]);
    expect(
      (await listGroupExpenses(stays, groupId)).map((expense) => expense.id),
    ).toHaveLength(2);
  });

  it("gives someone who was never in the group a 403", async () => {
    const { groupId } = await createGroupWithMembers(2);
    const outsider = await createUser();

    await expect(listGroupExpenses(outsider, groupId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe("findExpense", () => {
  it("returns null for an expense that doesn't exist", async () => {
    expect(
      await findExpense("00000000-0000-4000-8000-000000000000"),
    ).toBeNull();
  });
});
