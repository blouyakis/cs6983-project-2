// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Group } from "@/lib/db/group-members";
import type { Payment } from "@/lib/db/settlements";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/http/errors";
import { confirmPaymentReceived, markPaymentSent } from "./payment-service";

const access = vi.hoisted(() => ({ requireGroupAccess: vi.fn() }));
vi.mock("./access", () => access);

const db = vi.hoisted(() => ({
  findPayment: vi.fn(),
  markPaymentPaid: vi.fn(),
  confirmPayment: vi.fn(),
}));
vi.mock("@/lib/db/settlements", () => db);

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
