// listExpensesSpentBetween (#90) against the real database: only the days in
// the range, the end day left out, and only the group asked about.
import { afterAll, describe, expect, it } from "vitest";
import { listExpensesSpentBetween } from "@/lib/db/expenses";
import { addExpense } from "@/lib/services/expense-service";
import { cleanUp, createGroupWithMembers } from "./fixtures";

afterAll(cleanUp);

async function cost(
  groupId: string,
  payerId: string,
  amountCents: number,
  spentOn: string,
): Promise<void> {
  await addExpense(payerId, groupId, {
    description: "Cost",
    amountCents,
    spentOn,
    mode: "even",
    sharedBy: [payerId],
  });
}

describe("expenses spent between two days", () => {
  it("returns the expenses from the first day up to, not including, the last", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);
    const [ana] = memberIds;
    const other = await createGroupWithMembers(1);
    await cost(groupId, ana, 100, "2026-10-31");
    await cost(groupId, ana, 3500, "2026-11-01");
    await cost(groupId, ana, 6100, "2026-11-04");
    await cost(other.groupId, other.memberIds[0], 999, "2026-11-04");

    const rows = await listExpensesSpentBetween(
      groupId,
      "2026-11-01",
      "2026-11-04",
      null,
    );

    expect(rows).toEqual([{ spentOn: "2026-11-01", amountCents: 3500 }]);
  });
});
