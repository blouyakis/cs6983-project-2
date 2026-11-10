// User flow 6 (#14) with the real services and lib/db against the real
// database: a direct payment changes nobody's balance until the recipient
// confirms it, and then moves both balances by its amount.
import { afterAll, describe, expect, it } from "vitest";
import {
  ConflictError,
  ForbiddenError,
  ValidationError,
} from "@/lib/http/errors";
import { getGroupBalances } from "@/lib/services/balance-service";
import { addExpense } from "@/lib/services/expense-service";
import {
  confirmPaymentReceived,
  listPayments,
  markPaymentSent,
  recordDirectPayment,
} from "@/lib/services/payment-service";
import {
  listPastPeriods,
  startSettleUp,
} from "@/lib/services/settlement-service";
import { cleanUp, createGroupWithMembers, createUser, db } from "./fixtures";

afterAll(cleanUp);

async function balanceOf(
  viewerId: string,
  groupId: string,
  userId: string,
): Promise<number> {
  const balances = await getGroupBalances(viewerId, groupId);
  return (
    balances.find((balance) => balance.userId === userId)?.balanceCents ?? 0
  );
}

async function leave(groupId: string, userId: string): Promise<void> {
  const { data: now } = await db.rpc("db_now");
  const { error } = await db
    .from("group_members")
    .update({ left_at: now })
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) {
    throw error;
  }
}

describe("a direct payment", () => {
  it("is paid and changes no balance until the recipient confirms", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [a, b] = memberIds;

    const payment = await recordDirectPayment(a, groupId, {
      toUserId: b,
      amountCents: 883,
    });

    expect(payment).toMatchObject({
      fromUserId: a,
      toUserId: b,
      amountCents: 883,
      status: "paid",
      settlementId: null,
      confirmedAt: null,
    });
    expect(payment.paidAt).not.toBeNull();
    expect(await balanceOf(a, groupId, a)).toBe(0);
    expect(await balanceOf(a, groupId, b)).toBe(0);
  });

  it("moves A up by 883 and B down by 883 once B confirms", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [a, b] = memberIds;
    const payment = await recordDirectPayment(a, groupId, {
      toUserId: b,
      amountCents: 883,
    });

    const { payment: confirmed } = await confirmPaymentReceived(
      b,
      groupId,
      payment.id,
    );

    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.confirmedAt).not.toBeNull();
    expect(await balanceOf(a, groupId, a)).toBe(883);
    expect(await balanceOf(a, groupId, b)).toBe(-883);
  });

  it("can only be confirmed by the recipient", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    const [a, b, c] = memberIds;
    const payment = await recordDirectPayment(a, groupId, {
      toUserId: b,
      amountCents: 883,
    });

    await expect(
      confirmPaymentReceived(c, groupId, payment.id),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      confirmPaymentReceived(a, groupId, payment.id),
    ).rejects.toThrow(ForbiddenError);
  });

  it("can't be confirmed twice", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [a, b] = memberIds;
    const payment = await recordDirectPayment(a, groupId, {
      toUserId: b,
      amountCents: 883,
    });
    await confirmPaymentReceived(b, groupId, payment.id);

    await expect(
      confirmPaymentReceived(b, groupId, payment.id),
    ).rejects.toThrow(ConflictError);
  });

  it("can't go to yourself", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);

    await expect(
      recordDirectPayment(memberIds[0], groupId, {
        toUserId: memberIds[0],
        amountCents: 883,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("can't go to someone who left or was never in the group", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    const [a, b] = memberIds;
    await leave(groupId, b);
    const stranger = await createUser();

    for (const toUserId of [b, stranger]) {
      await expect(
        recordDirectPayment(a, groupId, { toUserId, amountCents: 883 }),
      ).rejects.toThrow(ValidationError);
    }
  });
});

// AGENTS.md Section 6.10: a direct payment recorded while a settle-up is open
// belongs to the next period, so closing the period must not claim it.
describe("a direct payment during an open settle-up", () => {
  it("isn't claimed when the period closes and counts in the next period", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [a, b] = memberIds;
    await addExpense(a, groupId, {
      description: "Groceries",
      amountCents: 1000,
      spentOn: "2026-11-02",
      mode: "even",
      sharedBy: [a, b],
    });
    const settleUp = await startSettleUp(a, groupId);
    expect(settleUp.payments).toHaveLength(1);
    const [suggested] = settleUp.payments;

    const direct = await recordDirectPayment(a, groupId, {
      toUserId: b,
      amountCents: 300,
    });
    await confirmPaymentReceived(b, groupId, direct.id);
    await markPaymentSent(b, groupId, suggested.id);
    const { closed } = await confirmPaymentReceived(a, groupId, suggested.id);

    expect(closed).toBe(true);
    expect(await listPastPeriods(a, groupId)).toHaveLength(1);
    const [stored] = (await listPayments(a, groupId)).filter(
      (payment) => payment.id === direct.id,
    );
    expect(stored).toMatchObject({ status: "confirmed", settlementId: null });
    expect(await balanceOf(a, groupId, a)).toBe(300);
    expect(await balanceOf(a, groupId, b)).toBe(-300);
  });
});

// #112: a direct payment that is paid but not confirmed counts in no balance,
// so a settle-up started now would suggest the same money again and the
// sender could pay twice. Starting waits until the recipient has confirmed.
describe("a direct payment waiting to be confirmed", () => {
  it("stops a settle-up from starting until the recipient confirms it", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [a, b] = memberIds;
    await addExpense(a, groupId, {
      description: "Groceries",
      amountCents: 1000,
      spentOn: "2026-11-02",
      mode: "even",
      sharedBy: [a, b],
    });
    const direct = await recordDirectPayment(b, groupId, {
      toUserId: a,
      amountCents: 500,
    });

    const refused = startSettleUp(a, groupId);

    await expect(refused).rejects.toThrow(ConflictError);
    await expect(refused).rejects.toThrow(/hasn't been confirmed/);
    expect(await listPastPeriods(a, groupId)).toEqual([]);

    await confirmPaymentReceived(a, groupId, direct.id);
    const settleUp = await startSettleUp(a, groupId);

    // The confirmed $5 cleared the debt, so the period closed at once.
    expect(settleUp.payments).toEqual([]);
    expect(await listPastPeriods(a, groupId)).toHaveLength(1);
  });
});

describe("listPayments", () => {
  it("lists paid and confirmed payments, and a former member only sees those from before they left", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    const [a, b, c] = memberIds;
    const first = await recordDirectPayment(a, groupId, {
      toUserId: b,
      amountCents: 100,
    });
    await confirmPaymentReceived(b, groupId, first.id);
    await leave(groupId, c);
    const second = await recordDirectPayment(b, groupId, {
      toUserId: a,
      amountCents: 200,
    });

    const all = await listPayments(a, groupId);
    expect(all.map((payment) => payment.id)).toEqual([second.id, first.id]);
    expect(all.map((payment) => payment.status)).toEqual(["paid", "confirmed"]);

    const seenByFormer = await listPayments(c, groupId);
    expect(seenByFormer.map((payment) => payment.id)).toEqual([first.id]);
  });
});
