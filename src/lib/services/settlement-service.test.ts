// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Group } from "@/lib/db/group-members";
import type { Payment, Settlement } from "@/lib/db/settlements";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/http/errors";
import {
  cancelSettleUp,
  getCurrentSettleUp,
  listPastPeriods,
  startSettleUp,
} from "./settlement-service";

const access = vi.hoisted(() => ({ requireGroupAccess: vi.fn() }));
vi.mock("./access", () => access);

const balances = vi.hoisted(() => ({ getGroupBalancesAt: vi.fn() }));
vi.mock("./balance-service", () => balances);

const db = vi.hoisted(() => ({
  BalancesChangedError: class BalancesChangedError extends Error {},
  dbNow: vi.fn(),
  insertSettlement: vi.fn(),
  findSettlement: vi.fn(),
  findOpenSettlement: vi.fn(),
  listSettlementPayments: vi.fn(),
  listClosedSettlements: vi.fn(),
  cancelOpenSettlement: vi.fn(),
}));
vi.mock("@/lib/db/settlements", () => db);

const ana = "6f1c2d4e-1111-4222-8333-944455556666";
const sam = "7a2d3e5f-1111-4222-8333-944455556666";
const jo = "1a2b3c4d-3333-4444-8555-b66677778888";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const settlementId = "5e6f7a8b-5555-4666-8777-d88899990000";

const flat: Group = {
  id: groupId,
  name: "Flat",
  isPersonal: false,
  createdBy: ana,
  archivedAt: null,
  createdAt: "2026-10-01T09:00:00+00:00",
};

const open: Settlement = {
  id: settlementId,
  groupId,
  status: "open",
  startedBy: ana,
  startedAt: "2026-11-01T10:00:00+00:00",
  closedAt: null,
};

const payment: Payment = {
  id: "9c8d7e6f-6666-4777-8888-e99900001111",
  groupId,
  fromUserId: sam,
  toUserId: ana,
  amountCents: 1500,
  status: "suggested",
  settlementId,
  createdAt: "2026-11-01T10:00:00+00:00",
  paidAt: null,
  confirmedAt: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  access.requireGroupAccess.mockResolvedValue({ group: flat, readUntil: null });
  db.dbNow.mockResolvedValue("2026-11-01T10:00:00+00:00");
  balances.getGroupBalancesAt.mockResolvedValue([
    { userId: ana, balanceCents: 1500 },
    { userId: sam, balanceCents: -1500 },
  ]);
  db.insertSettlement.mockResolvedValue(settlementId);
  db.findSettlement.mockResolvedValue(open);
  db.findOpenSettlement.mockResolvedValue(null);
  db.listSettlementPayments.mockResolvedValue([payment]);
  db.listClosedSettlements.mockResolvedValue([]);
});

describe("startSettleUp", () => {
  it("suggests the fewest payments from the balances and stores them", async () => {
    const settleUp = await startSettleUp(ana, groupId);

    expect(access.requireGroupAccess).toHaveBeenCalledWith(
      ana,
      groupId,
      "write",
    );
    expect(balances.getGroupBalancesAt).toHaveBeenCalledWith(
      ana,
      groupId,
      "2026-11-01T10:00:00+00:00",
    );
    expect(db.insertSettlement).toHaveBeenCalledWith(
      groupId,
      ana,
      "2026-11-01T10:00:00+00:00",
      [
        { userId: ana, balanceCents: 1500 },
        { userId: sam, balanceCents: -1500 },
      ],
      [{ fromUserId: sam, toUserId: ana, amountCents: 1500 }],
    );
    expect(settleUp).toEqual({ ...open, payments: [payment] });
  });

  it("uses an exact search, not a greedy match, for the payments", async () => {
    balances.getGroupBalancesAt.mockResolvedValue([
      { userId: ana, balanceCents: -600 },
      { userId: sam, balanceCents: -500 },
      { userId: jo, balanceCents: 200 },
      { userId: "d", balanceCents: 400 },
      { userId: "e", balanceCents: 500 },
    ]);

    await startSettleUp(ana, groupId);

    const [, , , , suggested] = db.insertSettlement.mock.calls[0];
    expect(suggested).toHaveLength(3);
  });

  it("starts with no payments when everyone is settled up, so the period closes at once", async () => {
    balances.getGroupBalancesAt.mockResolvedValue([
      { userId: ana, balanceCents: 0 },
      { userId: sam, balanceCents: 0 },
    ]);
    const closed = { ...open, status: "closed", closedAt: open.startedAt };
    db.findSettlement.mockResolvedValue(closed);
    db.listSettlementPayments.mockResolvedValue([]);

    const settleUp = await startSettleUp(ana, groupId);

    const [, , , , suggested] = db.insertSettlement.mock.calls[0];
    expect(suggested).toEqual([]);
    expect(settleUp).toEqual({ ...closed, payments: [] });
  });

  it("is a conflict when a settle-up is already open, before computing anything", async () => {
    db.findOpenSettlement.mockResolvedValue(open);

    await expect(startSettleUp(sam, groupId)).rejects.toThrow(ConflictError);
    expect(balances.getGroupBalancesAt).not.toHaveBeenCalled();
    expect(db.insertSettlement).not.toHaveBeenCalled();
  });

  it("passes on the database's conflict when two members start at once", async () => {
    db.insertSettlement.mockRejectedValue(new ConflictError("already open"));

    await expect(startSettleUp(sam, groupId)).rejects.toThrow(ConflictError);
  });

  it("reads the balances again when a cost landed before the cut-off, then gives up", async () => {
    db.insertSettlement
      .mockRejectedValueOnce(new db.BalancesChangedError("changed"))
      .mockRejectedValueOnce(new db.BalancesChangedError("changed"))
      .mockResolvedValueOnce(settlementId);
    db.dbNow
      .mockResolvedValueOnce("2026-11-01T10:00:00+00:00")
      .mockResolvedValueOnce("2026-11-01T10:00:01+00:00")
      .mockResolvedValueOnce("2026-11-01T10:00:02+00:00");

    const settleUp = await startSettleUp(ana, groupId);

    expect(db.insertSettlement).toHaveBeenCalledTimes(3);
    expect(balances.getGroupBalancesAt).toHaveBeenLastCalledWith(
      ana,
      groupId,
      "2026-11-01T10:00:02+00:00",
    );
    expect(settleUp.id).toBe(settlementId);
  });

  it("is a conflict when the balances keep changing", async () => {
    db.insertSettlement.mockRejectedValue(
      new db.BalancesChangedError("changed"),
    );

    // The database's refusal is passed on as it is: a 409 (see
    // lib/db/settlements.test.ts).
    await expect(startSettleUp(ana, groupId)).rejects.toBeInstanceOf(
      db.BalancesChangedError,
    );
    expect(db.insertSettlement).toHaveBeenCalledTimes(3);
  });

  it("has nothing to settle in a personal space", async () => {
    access.requireGroupAccess.mockResolvedValue({
      group: { ...flat, isPersonal: true },
      readUntil: null,
    });

    await expect(startSettleUp(ana, groupId)).rejects.toThrow(ConflictError);
    expect(db.insertSettlement).not.toHaveBeenCalled();
  });

  it("needs write access: a former member can't start one", async () => {
    access.requireGroupAccess.mockRejectedValue(new ForbiddenError());

    await expect(startSettleUp(ana, groupId)).rejects.toThrow(ForbiddenError);
    expect(balances.getGroupBalancesAt).not.toHaveBeenCalled();
  });

  it("fails loudly when the settle-up it just started can't be loaded", async () => {
    db.findSettlement.mockResolvedValue(null);

    await expect(startSettleUp(ana, groupId)).rejects.toThrow(/could not/i);
  });
});

describe("getCurrentSettleUp", () => {
  it("returns the open settle-up with its payments for a reader", async () => {
    db.findOpenSettlement.mockResolvedValue(open);

    const settleUp = await getCurrentSettleUp(sam, groupId);

    expect(access.requireGroupAccess).toHaveBeenCalledWith(
      sam,
      groupId,
      "read",
    );
    expect(db.listSettlementPayments).toHaveBeenCalledWith(settlementId);
    expect(settleUp).toEqual({ ...open, payments: [payment] });
  });

  it("is not found when no settle-up is open", async () => {
    db.findOpenSettlement.mockResolvedValue(null);

    await expect(getCurrentSettleUp(sam, groupId)).rejects.toThrow(
      NotFoundError,
    );
  });

  it("hides a settle-up started after a former member left", async () => {
    db.findOpenSettlement.mockResolvedValue(open);
    access.requireGroupAccess.mockResolvedValue({
      group: flat,
      readUntil: "2026-10-15T00:00:00+00:00",
    });

    await expect(getCurrentSettleUp(sam, groupId)).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("cancelSettleUp", () => {
  it("cancels the group's open settle-up for a current member", async () => {
    await cancelSettleUp(sam, groupId);

    expect(access.requireGroupAccess).toHaveBeenCalledWith(
      sam,
      groupId,
      "write",
    );
    expect(db.cancelOpenSettlement).toHaveBeenCalledWith(groupId);
  });

  it("passes the database's conflict on", async () => {
    db.cancelOpenSettlement.mockRejectedValue(new ConflictError("paid"));

    await expect(cancelSettleUp(sam, groupId)).rejects.toThrow(ConflictError);
  });
});

describe("listPastPeriods", () => {
  it("lists closed periods for a reader, up to the day a former member left", async () => {
    access.requireGroupAccess.mockResolvedValue({
      group: flat,
      readUntil: "2026-10-15T00:00:00+00:00",
    });
    const period = {
      ...open,
      status: "closed",
      closedAt: "2026-10-01T00:00:00+00:00",
      expenseCount: 3,
      paymentCount: 1,
    };
    db.listClosedSettlements.mockResolvedValue([period]);

    const periods = await listPastPeriods(sam, groupId);

    expect(access.requireGroupAccess).toHaveBeenCalledWith(
      sam,
      groupId,
      "read",
    );
    expect(db.listClosedSettlements).toHaveBeenCalledWith(
      groupId,
      "2026-10-15T00:00:00+00:00",
    );
    expect(periods).toEqual([period]);
  });
});
