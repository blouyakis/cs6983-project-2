// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Group } from "@/lib/db/group-members";
import type { Payment } from "@/lib/db/settlements";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/http/errors";
import {
  confirmPaymentReceived,
  declinePaymentReceived,
  listPayments,
  markPaymentSent,
  recordDirectPayment,
} from "./payment-service";

const access = vi.hoisted(() => ({ requireGroupAccess: vi.fn() }));
vi.mock("./access", () => access);

const db = vi.hoisted(() => ({
  findPayment: vi.fn(),
  markPaymentPaid: vi.fn(),
  confirmPayment: vi.fn(),
  unmarkPaymentPaid: vi.fn(),
  deleteDirectPayment: vi.fn(),
  recordPayment: vi.fn(),
  listGroupPayments: vi.fn(),
}));
vi.mock("@/lib/db/settlements", () => db);

const members = vi.hoisted(() => ({ listCurrentMembers: vi.fn() }));
vi.mock("@/lib/db/group-members", () => members);

const ana = "6f1c2d4e-1111-4222-8333-944455556666";
const sam = "7a2d3e5f-1111-4222-8333-944455556666";
const jo = "1a2b3c4d-3333-4444-8555-b66677778888";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const paymentId = "9c8d7e6f-6666-4777-8888-e99900001111";

const flat: Group = {
  id: groupId,
  name: "Flat",
  isPersonal: false,
  createdBy: ana,
  archivedAt: null,
  createdAt: "2026-10-01T09:00:00+00:00",
};

const suggested: Payment = {
  id: paymentId,
  groupId,
  fromUserId: sam,
  toUserId: ana,
  amountCents: 1500,
  status: "suggested",
  settlementId: "5e6f7a8b-5555-4666-8777-d88899990000",
  createdAt: "2026-11-01T10:00:00+00:00",
  paidAt: null,
  confirmedAt: null,
};

const paid: Payment = {
  ...suggested,
  status: "paid",
  paidAt: "2026-11-02T10:00:00+00:00",
};

const confirmed: Payment = {
  ...paid,
  status: "confirmed",
  confirmedAt: "2026-11-03T10:00:00+00:00",
};

beforeEach(() => {
  vi.resetAllMocks();
  access.requireGroupAccess.mockResolvedValue({ group: flat, readUntil: null });
});

describe("markPaymentSent", () => {
  it("lets the sender mark a suggested payment paid", async () => {
    db.findPayment.mockResolvedValue(suggested);
    db.markPaymentPaid.mockResolvedValue(paid);

    const payment = await markPaymentSent(sam, groupId, paymentId);

    expect(access.requireGroupAccess).toHaveBeenCalledWith(
      sam,
      groupId,
      "write",
    );
    expect(db.markPaymentPaid).toHaveBeenCalledWith(paymentId);
    expect(payment).toEqual(paid);
  });

  it("is forbidden for anyone but the sender, the recipient included", async () => {
    db.findPayment.mockResolvedValue(suggested);

    await expect(markPaymentSent(ana, groupId, paymentId)).rejects.toThrow(
      ForbiddenError,
    );
    await expect(markPaymentSent(jo, groupId, paymentId)).rejects.toThrow(
      ForbiddenError,
    );
    expect(db.markPaymentPaid).not.toHaveBeenCalled();
  });

  it("is not found for a payment in another group, without saying it exists", async () => {
    db.findPayment.mockResolvedValue({ ...suggested, groupId: "other" });

    await expect(markPaymentSent(sam, groupId, paymentId)).rejects.toThrow(
      NotFoundError,
    );
  });

  it("is not found for an unknown payment", async () => {
    db.findPayment.mockResolvedValue(null);

    await expect(markPaymentSent(sam, groupId, paymentId)).rejects.toThrow(
      NotFoundError,
    );
  });

  it("is a conflict for a payment that is already paid or confirmed", async () => {
    db.findPayment.mockResolvedValue(paid);

    await expect(markPaymentSent(sam, groupId, paymentId)).rejects.toThrow(
      ConflictError,
    );
    expect(db.markPaymentPaid).not.toHaveBeenCalled();
  });

  it("is a conflict when the payment changed between the check and the write", async () => {
    db.findPayment.mockResolvedValue(suggested);
    db.markPaymentPaid.mockResolvedValue(null);

    await expect(markPaymentSent(sam, groupId, paymentId)).rejects.toThrow(
      ConflictError,
    );
  });

  it("needs write access", async () => {
    access.requireGroupAccess.mockRejectedValue(new ForbiddenError());

    await expect(markPaymentSent(sam, groupId, paymentId)).rejects.toThrow(
      ForbiddenError,
    );
    expect(db.findPayment).not.toHaveBeenCalled();
  });
});

describe("confirmPaymentReceived", () => {
  it("lets the recipient confirm a paid payment and says whether the period closed", async () => {
    db.findPayment.mockResolvedValueOnce(paid).mockResolvedValueOnce(confirmed);
    db.confirmPayment.mockResolvedValue(true);

    const result = await confirmPaymentReceived(ana, groupId, paymentId);

    expect(access.requireGroupAccess).toHaveBeenCalledWith(
      ana,
      groupId,
      "write",
    );
    expect(db.confirmPayment).toHaveBeenCalledWith(paymentId);
    expect(result).toEqual({ payment: confirmed, closed: true });
  });

  it("is forbidden for anyone but the recipient, the sender included", async () => {
    db.findPayment.mockResolvedValue(paid);

    await expect(
      confirmPaymentReceived(sam, groupId, paymentId),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      confirmPaymentReceived(jo, groupId, paymentId),
    ).rejects.toThrow(ForbiddenError);
    expect(db.confirmPayment).not.toHaveBeenCalled();
  });

  it("is a conflict for a payment that isn't marked paid yet", async () => {
    db.findPayment.mockResolvedValue(suggested);

    await expect(
      confirmPaymentReceived(ana, groupId, paymentId),
    ).rejects.toThrow(ConflictError);
    expect(db.confirmPayment).not.toHaveBeenCalled();
  });

  it("is not found for an unknown payment or one in another group", async () => {
    db.findPayment.mockResolvedValueOnce(null);
    await expect(
      confirmPaymentReceived(ana, groupId, paymentId),
    ).rejects.toThrow(NotFoundError);

    db.findPayment.mockResolvedValueOnce({ ...paid, groupId: "other" });
    await expect(
      confirmPaymentReceived(ana, groupId, paymentId),
    ).rejects.toThrow(NotFoundError);
  });

  it("fails loudly when the confirmed payment can't be loaded back", async () => {
    db.findPayment.mockResolvedValueOnce(paid).mockResolvedValueOnce(null);
    db.confirmPayment.mockResolvedValue(false);

    await expect(
      confirmPaymentReceived(ana, groupId, paymentId),
    ).rejects.toThrow(/could not/i);
  });
});

describe("declinePaymentReceived", () => {
  const directPaid: Payment = { ...paid, settlementId: null };

  it("puts a paid settle-up payment back to suggested and returns it", async () => {
    db.findPayment.mockResolvedValue(paid);
    db.unmarkPaymentPaid.mockResolvedValue(suggested);

    const result = await declinePaymentReceived(ana, groupId, paymentId);

    expect(access.requireGroupAccess).toHaveBeenCalledWith(
      ana,
      groupId,
      "write",
    );
    expect(db.unmarkPaymentPaid).toHaveBeenCalledWith(paymentId);
    expect(db.deleteDirectPayment).not.toHaveBeenCalled();
    expect(result).toEqual(suggested);
  });

  it("deletes a paid direct payment and returns null", async () => {
    db.findPayment.mockResolvedValue(directPaid);
    db.deleteDirectPayment.mockResolvedValue(true);

    expect(await declinePaymentReceived(ana, groupId, paymentId)).toBeNull();
    expect(db.deleteDirectPayment).toHaveBeenCalledWith(paymentId);
    expect(db.unmarkPaymentPaid).not.toHaveBeenCalled();
  });

  it("is forbidden for anyone but the recipient, the sender included", async () => {
    db.findPayment.mockResolvedValue(paid);

    await expect(
      declinePaymentReceived(sam, groupId, paymentId),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      declinePaymentReceived(jo, groupId, paymentId),
    ).rejects.toThrow(ForbiddenError);
    expect(db.unmarkPaymentPaid).not.toHaveBeenCalled();
  });

  it("is a conflict for a payment that is suggested or confirmed", async () => {
    for (const payment of [suggested, confirmed]) {
      db.findPayment.mockResolvedValueOnce(payment);
      await expect(
        declinePaymentReceived(ana, groupId, paymentId),
      ).rejects.toThrow(ConflictError);
    }
    expect(db.unmarkPaymentPaid).not.toHaveBeenCalled();
    expect(db.deleteDirectPayment).not.toHaveBeenCalled();
  });

  it("is a conflict when a confirm lands between the read and the write", async () => {
    db.findPayment.mockResolvedValue(paid);
    db.unmarkPaymentPaid.mockResolvedValue(null);
    await expect(
      declinePaymentReceived(ana, groupId, paymentId),
    ).rejects.toThrow(ConflictError);

    db.findPayment.mockResolvedValue(directPaid);
    db.deleteDirectPayment.mockResolvedValue(false);
    await expect(
      declinePaymentReceived(ana, groupId, paymentId),
    ).rejects.toThrow(ConflictError);
  });

  it("is not found for an unknown payment or one in another group", async () => {
    db.findPayment.mockResolvedValueOnce(null);
    await expect(
      declinePaymentReceived(ana, groupId, paymentId),
    ).rejects.toThrow(NotFoundError);

    db.findPayment.mockResolvedValueOnce({ ...paid, groupId: "other" });
    await expect(
      declinePaymentReceived(ana, groupId, paymentId),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("recordDirectPayment", () => {
  const direct: Payment = {
    ...paid,
    fromUserId: ana,
    toUserId: sam,
    amountCents: 883,
    settlementId: null,
  };

  beforeEach(() => {
    members.listCurrentMembers.mockResolvedValue([
      { userId: ana, name: "Ana", defaultShareWeight: 1 },
      { userId: sam, name: "Sam", defaultShareWeight: 1 },
    ]);
  });

  it("records a payment from the current user, who needs write access", async () => {
    db.recordPayment.mockResolvedValue(direct);

    const payment = await recordDirectPayment(ana, groupId, {
      toUserId: sam,
      amountCents: 883,
    });

    expect(access.requireGroupAccess).toHaveBeenCalledWith(
      ana,
      groupId,
      "write",
    );
    expect(db.recordPayment).toHaveBeenCalledWith(groupId, ana, sam, 883);
    expect(payment).toEqual(direct);
  });

  it("refuses a payment to yourself with a 400 on toUserId", async () => {
    const error = await recordDirectPayment(ana, groupId, {
      toUserId: ana,
      amountCents: 883,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({
      fields: { toUserId: "You can't pay yourself." },
    });
    expect(db.recordPayment).not.toHaveBeenCalled();
  });

  it("refuses someone who isn't a current member with a 400 on toUserId", async () => {
    const error = await recordDirectPayment(ana, groupId, {
      toUserId: jo,
      amountCents: 883,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({
      fields: { toUserId: "Choose a current member of this group." },
    });
    expect(db.recordPayment).not.toHaveBeenCalled();
  });

  it("refuses a user without write access", async () => {
    access.requireGroupAccess.mockRejectedValue(
      new ForbiddenError("You left this group."),
    );

    await expect(
      recordDirectPayment(ana, groupId, { toUserId: sam, amountCents: 883 }),
    ).rejects.toThrow(ForbiddenError);
    expect(db.recordPayment).not.toHaveBeenCalled();
  });
});

describe("listPayments", () => {
  it("lists the group's payments for a current member", async () => {
    db.listGroupPayments.mockResolvedValue([paid]);

    expect(await listPayments(ana, groupId)).toEqual([paid]);
    expect(access.requireGroupAccess).toHaveBeenCalledWith(
      ana,
      groupId,
      "read",
    );
    expect(db.listGroupPayments).toHaveBeenCalledWith(groupId, null);
  });

  it("stops at a former member's left_at", async () => {
    access.requireGroupAccess.mockResolvedValue({
      group: flat,
      readUntil: "2026-11-02T12:00:00+00:00",
    });
    db.listGroupPayments.mockResolvedValue([]);

    await listPayments(jo, groupId);

    expect(db.listGroupPayments).toHaveBeenCalledWith(
      groupId,
      "2026-11-02T12:00:00+00:00",
    );
  });

  it("refuses someone outside the group", async () => {
    access.requireGroupAccess.mockRejectedValue(
      new ForbiddenError("You are not a member of this group."),
    );

    await expect(listPayments(jo, groupId)).rejects.toThrow(ForbiddenError);
  });
});
