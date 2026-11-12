// The expense history (#15, user story 1) with the real service and lib/db
// against the real database: which expenses a user sees across their groups,
// each filter on its own and all four together, and what a former member
// sees. The personal space is covered in the unit tests: createUser makes
// users without one, and another file may give them one at any moment (#79).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ForbiddenError } from "@/lib/http/errors";
import { listExpenseHistory } from "@/lib/services/expense-history-service";
import { addExpense } from "@/lib/services/expense-service";
import { cleanUp, createGroupWithMembers, db, dbNow } from "./fixtures";

afterAll(cleanUp);

async function cost(
  groupId: string,
  payerId: string,
  sharedBy: string[],
  spentOn: string,
  description: string,
): Promise<string> {
  const expense = await addExpense(payerId, groupId, {
    description,
    amountCents: 3000,
    spentOn,
    mode: "even",
    sharedBy,
  });
  return expense.id;
}

function ids(rows: { id: string }[]): string[] {
  return rows.map((row) => row.id);
}

// Ana is in Flat with Ben and Cy, and in Trip with Ben. Two strangers have a
// group of their own.
let ana: string;
let ben: string;
let flatId: string;
let tripId: string;
let strangersId: string;
let anaPaidOct5: string;
let benPaidOct15: string;
let notAnasOct16: string;
let tripOct25: string;
let strangersCost: string;

beforeAll(async () => {
  const flat = await createGroupWithMembers(3);
  flatId = flat.groupId;
  const cy = flat.memberIds[2];
  [ana, ben] = flat.memberIds;
  const trip = await db
    .from("groups")
    .insert({ name: "Trip", created_by: ben })
    .select("id")
    .single();
  if (trip.error) {
    throw trip.error;
  }
  tripId = trip.data.id;
  const joined = await db.from("group_members").insert(
    [ana, ben].map((userId) => ({
      group_id: tripId,
      user_id: userId,
      default_share_weight: 1,
    })),
  );
  if (joined.error) {
    throw joined.error;
  }
  const strangers = await createGroupWithMembers(2);
  strangersId = strangers.groupId;

  anaPaidOct5 = await cost(flatId, ana, [ana, ben], "2026-10-05", "Groceries");
  benPaidOct15 = await cost(
    flatId,
    ben,
    [ana, ben, cy],
    "2026-10-15",
    "Electricity",
  );
  notAnasOct16 = await cost(flatId, ben, [ben, cy], "2026-10-16", "Concert");
  tripOct25 = await cost(tripId, ben, [ana, ben], "2026-10-25", "Fuel");
  strangersCost = await cost(
    strangersId,
    strangers.memberIds[0],
    strangers.memberIds,
    "2026-10-20",
    "Theirs",
  );
});

describe("listExpenseHistory", () => {
  it("lists the expenses the user shares across their groups, newest first, with their share", async () => {
    const history = await listExpenseHistory(ana);

    expect(ids(history)).toEqual([tripOct25, benPaidOct15, anaPaidOct5]);
    expect(
      history.map((row) => [
        row.groupName,
        row.amountCents,
        row.yourShareCents,
      ]),
    ).toEqual([
      ["Trip", 3000, 1500],
      ["Flat", 3000, 1000],
      ["Flat", 3000, 1500],
    ]);
  });

  it("never shows an expense from a group the user was never in", async () => {
    expect(ids(await listExpenseHistory(ana))).not.toContain(strangersCost);
  });

  it("leaves out an expense in the user's group that they don't share", async () => {
    expect(ids(await listExpenseHistory(ana))).not.toContain(notAnasOct16);
    // Ben shares it, so it is in his.
    expect(ids(await listExpenseHistory(ben))).toContain(notAnasOct16);
  });

  it("puts a pencil only on the unsettled expense the user paid", async () => {
    const history = await listExpenseHistory(ana);

    expect(history.map((row) => [row.id, row.editLock])).toEqual([
      [tripOct25, "not-payer"],
      [benPaidOct15, "not-payer"],
      [anaPaidOct5, null],
    ]);
  });

  it("filters by group", async () => {
    expect(ids(await listExpenseHistory(ana, { groupId: tripId }))).toEqual([
      tripOct25,
    ]);
  });

  it("filters by who paid", async () => {
    expect(ids(await listExpenseHistory(ana, { paidBy: ben }))).toEqual([
      tripOct25,
      benPaidOct15,
    ]);
    expect(ids(await listExpenseHistory(ana, { paidBy: ana }))).toEqual([
      anaPaidOct5,
    ]);
  });

  it("filters from a day, that day included", async () => {
    expect(ids(await listExpenseHistory(ana, { from: "2026-10-15" }))).toEqual([
      tripOct25,
      benPaidOct15,
    ]);
  });

  it("filters up to a day, that day included", async () => {
    expect(ids(await listExpenseHistory(ana, { to: "2026-10-15" }))).toEqual([
      benPaidOct15,
      anaPaidOct5,
    ]);
  });

  it("applies all four filters together", async () => {
    expect(
      ids(
        await listExpenseHistory(ana, {
          groupId: flatId,
          paidBy: ben,
          from: "2026-10-10",
          to: "2026-10-20",
        }),
      ),
    ).toEqual([benPaidOct15]);
    // The same days in the other group match nothing.
    expect(
      await listExpenseHistory(ana, {
        groupId: tripId,
        paidBy: ben,
        from: "2026-10-10",
        to: "2026-10-20",
      }),
    ).toEqual([]);
  });

  it("is 403 for a groupId of a group the user isn't in", async () => {
    await expect(
      listExpenseHistory(ana, { groupId: strangersId }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("a former member's expense history", () => {
  it("shows only what was added before they left, read-only", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [dee, eli] = memberIds;
    const before = await cost(groupId, dee, [dee, eli], "2026-10-05", "Before");
    // Dee leaves at this moment. The next cost is added after it, while her
    // membership row still let her be a sharer, so only the cut-off hides it.
    const leftAt = await dbNow();
    const after = await cost(groupId, eli, [dee, eli], "2026-10-06", "After");
    const { error } = await db
      .from("group_members")
      .update({ left_at: leftAt })
      .eq("group_id", groupId)
      .eq("user_id", dee);
    if (error) {
      throw error;
    }

    const history = await listExpenseHistory(dee);

    expect(ids(history)).toEqual([before]);
    expect(history[0].editLock).toBe("read-only");
    expect(ids(await listExpenseHistory(dee, { groupId }))).toEqual([before]);
    // Eli is still in the group and sees both.
    expect(ids(await listExpenseHistory(eli))).toEqual([after, before]);
  });
});

// "former" in the Paid by filter (#130): costs paid by anyone who has left.
describe("the history filtered by a payer who has left", () => {
  it("lists the costs former members paid, and still filters by their id", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    const [fay, gus, hal] = memberIds;
    const gusPaid = await cost(groupId, gus, [fay, gus], "2026-10-05", "Gus");
    const halPaid = await cost(groupId, hal, [fay, hal], "2026-10-06", "Hal");
    const { error } = await db
      .from("group_members")
      .update({ left_at: await dbNow() })
      .eq("group_id", groupId)
      .eq("user_id", gus);
    if (error) {
      throw error;
    }

    expect(ids(await listExpenseHistory(fay))).toEqual([halPaid, gusPaid]);
    expect(ids(await listExpenseHistory(fay, { paidBy: "former" }))).toEqual([
      gusPaid,
    ]);
    expect(
      ids(await listExpenseHistory(fay, { paidBy: "former", groupId })),
    ).toEqual([gusPaid]);
    expect(
      ids(
        await listExpenseHistory(fay, { paidBy: "former", from: "2026-10-06" }),
      ),
    ).toEqual([]);
    expect(ids(await listExpenseHistory(fay, { paidBy: gus }))).toEqual([
      gusPaid,
    ]);
  });
});
