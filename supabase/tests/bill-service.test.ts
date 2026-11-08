// The itemized bill (#21, user flow 7) with the real services and lib/db
// against the real database: what it lists, that what it says the user owes
// matches their balance, and that a past period's bill stays as it was.
import { afterAll, describe, expect, it } from "vitest";
import { NotFoundError } from "@/lib/http/errors";
import { getGroupBalances } from "@/lib/services/balance-service";
import { getMyBill } from "@/lib/services/bill-service";
import { addExpense } from "@/lib/services/expense-service";
import {
  confirmPaymentReceived,
  markPaymentSent,
  recordDirectPayment,
} from "@/lib/services/payment-service";
import { startSettleUp } from "@/lib/services/settlement-service";
import { cleanUp, createGroupWithMembers } from "./fixtures";

afterAll(cleanUp);

async function evenExpense(
  groupId: string,
  payerId: string,
  amountCents: number,
  sharedBy: string[],
  description = "Cost",
): Promise<string> {
  const expense = await addExpense(payerId, groupId, {
    description,
    amountCents,
    spentOn: "2026-11-02",
    mode: "even",
    sharedBy,
  });
  return expense.id;
}

function total(owed: { owedCents: number }[]): number {
  return owed.reduce((sum, row) => sum + row.owedCents, 0);
}

async function balanceOf(groupId: string, userId: string): Promise<number> {
  const balances = await getGroupBalances(userId, groupId);
  return balances.find((row) => row.userId === userId)?.balanceCents ?? 0;
}

// Starts a settle-up and has every payer pay and every recipient confirm,
// which closes the period. Returns its id.
async function settleEverything(
  groupId: string,
  startedBy: string,
): Promise<string> {
  const settleUp = await startSettleUp(startedBy, groupId);
  for (const payment of settleUp.payments) {
    await markPaymentSent(payment.fromUserId, groupId, payment.id);
    await confirmPaymentReceived(payment.toUserId, groupId, payment.id);
  }
  return settleUp.id;
}

describe("getMyBill", () => {
  it("lists the expenses the user shares, with who paid, the total and their share", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    const [ana, sam, jo] = memberIds;
    await evenExpense(groupId, sam, 3001, memberIds, "Groceries");

    const bill = await getMyBill(ana, groupId);

    expect(bill.lines).toHaveLength(1);
    expect(bill.lines[0]).toMatchObject({
      description: "Groceries",
      payerId: sam,
      amountCents: 3001,
      shareCents: 1000,
    });
    expect(bill.owed).toEqual([
      { userId: sam, owedCents: 1000 },
      { userId: jo, owedCents: 0 },
    ]);
  });

  it("leaves out an expense split between other members only", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    const [ana, sam, jo] = memberIds;
    await evenExpense(groupId, sam, 2000, [sam, jo]);

    const bill = await getMyBill(ana, groupId);

    expect(bill.lines).toEqual([]);
    expect(total(bill.owed)).toBe(0);
  });

  it("adds up to minus the member's balance, with costs both ways and a confirmed payment", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    const [ana, sam, jo] = memberIds;
    await evenExpense(groupId, sam, 3001, memberIds);
    await evenExpense(groupId, ana, 1234, [ana, jo]);
    await evenExpense(groupId, jo, 999, [sam, jo]);
    const payment = await recordDirectPayment(ana, groupId, {
      toUserId: sam,
      amountCents: 400,
    });
    await confirmPaymentReceived(sam, groupId, payment.id);

    for (const userId of memberIds) {
      const bill = await getMyBill(userId, groupId);
      expect(total(bill.owed)).toBe(-(await balanceOf(groupId, userId)));
    }
  });

  it("keeps a past period's bill unchanged after a new settle-up", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [ana, sam] = memberIds;
    await evenExpense(groupId, sam, 3000, memberIds, "October rent");
    const october = await settleEverything(groupId, ana);
    const before = await getMyBill(ana, groupId, october);

    await evenExpense(groupId, ana, 5000, memberIds, "November rent");
    const november = await settleEverything(groupId, sam);
    const after = await getMyBill(ana, groupId, october);

    expect(after).toEqual({
      ...before,
      pastPeriods: expect.any(Array),
    });
    expect(after.lines.map((line) => line.description)).toEqual([
      "October rent",
    ]);
    expect(after.pastPeriods.map((period) => period.id)).toEqual([
      november,
      october,
    ]);
    // Closing the period paid what it owed, so nobody owes anything for it.
    expect(after.owed).toEqual([{ userId: sam, owedCents: 0 }]);
    // The current period starts empty after the second close.
    expect((await getMyBill(ana, groupId)).lines).toEqual([]);
  });

  it("is 404 for a closed period of another group", async () => {
    const first = await createGroupWithMembers(2);
    const second = await createGroupWithMembers(2);
    await evenExpense(
      second.groupId,
      second.memberIds[0],
      1000,
      second.memberIds,
    );
    const otherPeriod = await settleEverything(
      second.groupId,
      second.memberIds[0],
    );

    await expect(
      getMyBill(first.memberIds[0], first.groupId, otherPeriod),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
