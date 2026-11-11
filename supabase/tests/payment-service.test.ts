// User flow 6 (#14) with the real services and lib/db against the real
// database: a direct payment changes nobody's balance until the recipient
// confirms it, and then moves both balances by its amount.
import { afterAll, describe, expect, it } from "vitest";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/http/errors";
import { getGroupBalances } from "@/lib/services/balance-service";
import { addExpense } from "@/lib/services/expense-service";
import {
  confirmPaymentReceived,
  declinePaymentReceived,
  listPayments,
  markPaymentSent,
  recordDirectPayment,
} from "@/lib/services/payment-service";
import {
  cancelSettleUp,
  getCurrentSettleUp,
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

    // The confirmed $5 cleared the debt, so nothing was suggested and the
    // period closed at once, claiming the direct payment.
    expect(settleUp.payments).toMatchObject([
      { id: direct.id, status: "confirmed", settlementId: settleUp.id },
    ]);
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

// #108: the recipient of a payment marked paid can say the money never
// arrived. A settle-up payment goes back to suggested, so the payer can mark
// it again and the settle-up can be cancelled again; a direct payment, which
// never counted in a balance, is deleted.
describe("declining a paid payment", () => {
  // A paid 1200 shared by three, so B and C each owe A 400.
  async function settleUpWithTwoPayments() {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    const [a, b, c] = memberIds;
    await addExpense(a, groupId, {
      description: "Groceries",
      amountCents: 1200,
      spentOn: "2026-11-02",
      mode: "even",
      sharedBy: [a, b, c],
    });
    const settleUp = await startSettleUp(a, groupId);
    const fromB = settleUp.payments.find((p) => p.fromUserId === b);
    const fromC = settleUp.payments.find((p) => p.fromUserId === c);
    if (!fromB || !fromC) {
      throw new Error("expected a payment from B and one from C");
    }
    return { groupId, a, b, c, fromB, fromC };
  }

  it("puts a settle-up payment back to suggested, with paid_at cleared", async () => {
    const { groupId, a, b, fromB } = await settleUpWithTwoPayments();
    await markPaymentSent(b, groupId, fromB.id);

    const declined = await declinePaymentReceived(a, groupId, fromB.id);

    expect(declined).toMatchObject({
      id: fromB.id,
      status: "suggested",
      paidAt: null,
      confirmedAt: null,
    });
    const { payments } = await getCurrentSettleUp(a, groupId);
    expect(payments.find((p) => p.id === fromB.id)).toMatchObject({
      status: "suggested",
      paidAt: null,
    });
    // The payer can mark it paid again.
    expect((await markPaymentSent(b, groupId, fromB.id)).status).toBe("paid");
  });

  it("lets the settle-up be cancelled once every paid payment is declined", async () => {
    const { groupId, a, b, c, fromB, fromC } = await settleUpWithTwoPayments();
    await markPaymentSent(b, groupId, fromB.id);
    await markPaymentSent(c, groupId, fromC.id);

    await declinePaymentReceived(a, groupId, fromB.id);
    await expect(cancelSettleUp(a, groupId)).rejects.toThrow(ConflictError);

    await declinePaymentReceived(a, groupId, fromC.id);
    await cancelSettleUp(a, groupId);
    await expect(getCurrentSettleUp(a, groupId)).rejects.toThrow(NotFoundError);
  });

  it("deletes a direct payment and changes no balance", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [a, b] = memberIds;
    await addExpense(a, groupId, {
      description: "Groceries",
      amountCents: 1000,
      spentOn: "2026-11-02",
      mode: "even",
      sharedBy: [a, b],
    });
    const payment = await recordDirectPayment(b, groupId, {
      toUserId: a,
      amountCents: 500,
    });

    expect(await declinePaymentReceived(a, groupId, payment.id)).toBeNull();

    const stored = await listPayments(a, groupId);
    expect(stored.map((p) => p.id)).not.toContain(payment.id);
    expect(await balanceOf(a, groupId, a)).toBe(500);
    expect(await balanceOf(a, groupId, b)).toBe(-500);
  });

  it("can only be done by the recipient", async () => {
    const { groupId, a, b, c, fromB } = await settleUpWithTwoPayments();
    await markPaymentSent(b, groupId, fromB.id);
    const direct = await recordDirectPayment(b, groupId, {
      toUserId: c,
      amountCents: 100,
    });

    for (const [userId, paymentId] of [
      [b, fromB.id],
      [c, fromB.id],
      [b, direct.id],
      [a, direct.id],
    ]) {
      await expect(
        declinePaymentReceived(userId, groupId, paymentId),
      ).rejects.toThrow(ForbiddenError);
    }
  });

  it("is a conflict for a payment that is suggested or confirmed", async () => {
    const { groupId, a, c, fromB, fromC } = await settleUpWithTwoPayments();
    await markPaymentSent(c, groupId, fromC.id);
    await confirmPaymentReceived(a, groupId, fromC.id);

    await expect(declinePaymentReceived(a, groupId, fromB.id)).rejects.toThrow(
      ConflictError,
    );
    await expect(declinePaymentReceived(a, groupId, fromC.id)).rejects.toThrow(
      ConflictError,
    );
  });

  it("lets exactly one of a decline and a confirm of the same payment win", async () => {
    const { groupId, a, b, fromB } = await settleUpWithTwoPayments();
    await markPaymentSent(b, groupId, fromB.id);
    const direct = await recordDirectPayment(b, groupId, {
      toUserId: a,
      amountCents: 100,
    });

    for (const paymentId of [fromB.id, direct.id]) {
      const results = await Promise.allSettled([
        declinePaymentReceived(a, groupId, paymentId),
        confirmPaymentReceived(a, groupId, paymentId),
      ]);

      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      for (const result of results) {
        if (result.status === "rejected") {
          expect(
            result.reason instanceof ConflictError ||
              result.reason instanceof NotFoundError,
          ).toBe(true);
        }
      }
    }
  });
});
