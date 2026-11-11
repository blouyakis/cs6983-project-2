// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Expense } from "@/lib/db/expenses";
import type { Group } from "@/lib/db/group-members";
import type { ClosedPeriod } from "@/lib/db/settlements";
import { ForbiddenError, NotFoundError } from "@/lib/http/errors";
import { getMyBill } from "./bill-service";

const access = vi.hoisted(() => ({ requireGroupAccess: vi.fn() }));
vi.mock("./access", () => access);

const members = vi.hoisted(() => ({ listMembersAt: vi.fn() }));
vi.mock("@/lib/db/group-members", () => members);

const expenses = vi.hoisted(() => ({ listExpensesInPeriod: vi.fn() }));
vi.mock("@/lib/db/expenses", () => expenses);

const periods = vi.hoisted(() => ({
  listPeriodConfirmedPayments: vi.fn(),
  listClosedPeriodConfirmedPayments: vi.fn(),
}));
vi.mock("@/lib/db/periods", () => periods);

const settlements = vi.hoisted(() => ({
  findOpenSettlement: vi.fn(),
  listClosedSettlements: vi.fn(),
}));
vi.mock("@/lib/db/settlements", () => settlements);

const ana = "6f1c2d4e-1111-4222-8333-944455556666";
const sam = "7a2d3e5f-1111-4222-8333-944455556666";
const jo = "1a2b3c4d-3333-4444-8555-b66677778888";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const openId = "5e6f7a8b-5555-4666-8777-d88899990000";
const closedId = "4d5e6f7a-6666-4777-8888-e99900001111";

const flat: Group = {
  id: groupId,
  name: "Flat",
  isPersonal: false,
  createdBy: ana,
  archivedAt: null,
  createdAt: "2026-10-01T09:00:00+00:00",
};

function member(userId: string, name: string) {
  return { userId, name, defaultShareWeight: 1 };
}

function expense(
  id: string,
  payerId: string,
  amountCents: number,
  shares: [string, number][],
): Expense {
  return {
    id,
    groupId,
    description: `Cost ${id}`,
    amountCents,
    payerId,
    spentOn: "2026-11-02",
    settled: false,
    createdAt: "2026-11-02T10:00:00+00:00",
    editedAt: null,
    shares: shares.map(([userId, shareCents]) => ({ userId, shareCents })),
  };
}

const pastPeriod: ClosedPeriod = {
  id: closedId,
  groupId,
  status: "closed",
  startedBy: sam,
  startedAt: "2026-10-31T00:00:00+00:00",
  closedAt: "2026-11-01T00:00:00+00:00",
  expenseCount: 1,
  paymentCount: 1,
};

beforeEach(() => {
  vi.resetAllMocks();
  access.requireGroupAccess.mockResolvedValue({ group: flat, readUntil: null });
  members.listMembersAt.mockResolvedValue([
    member(ana, "Ana"),
    member(sam, "Sam"),
    member(jo, "Jo"),
  ]);
  expenses.listExpensesInPeriod.mockResolvedValue([]);
  periods.listPeriodConfirmedPayments.mockResolvedValue([]);
  periods.listClosedPeriodConfirmedPayments.mockResolvedValue([]);
  settlements.findOpenSettlement.mockResolvedValue(null);
  settlements.listClosedSettlements.mockResolvedValue([pastPeriod]);
});

describe("getMyBill", () => {
  it("checks read access first and refuses an outsider", async () => {
    access.requireGroupAccess.mockRejectedValue(new ForbiddenError("no"));

    await expect(getMyBill(ana, groupId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(access.requireGroupAccess).toHaveBeenCalledWith(
      ana,
      groupId,
      "read",
    );
    expect(expenses.listExpensesInPeriod).not.toHaveBeenCalled();
  });

  it("lists only the expenses the user shares, each with their share", async () => {
    const groceries = expense("e1", sam, 3000, [
      [ana, 1000],
      [sam, 1000],
      [jo, 1000],
    ]);
    const samForJo = expense("e2", sam, 2000, [
      [sam, 1000],
      [jo, 1000],
    ]);
    expenses.listExpensesInPeriod.mockResolvedValue([groceries, samForJo]);

    const bill = await getMyBill(ana, groupId);

    expect(bill.lines).toEqual([{ ...groceries, shareCents: 1000 }]);
  });

  it("says what the user owes each other member, in the order they joined", async () => {
    expenses.listExpensesInPeriod.mockResolvedValue([
      expense("e1", sam, 3000, [
        [ana, 1500],
        [sam, 1500],
      ]),
    ]);
    periods.listPeriodConfirmedPayments.mockResolvedValue([
      { fromUserId: ana, toUserId: sam, amountCents: 500 },
    ]);

    const bill = await getMyBill(ana, groupId);

    expect(bill.owed).toEqual([
      { userId: sam, owedCents: 1000 },
      { userId: jo, owedCents: 0 },
    ]);
  });

  it("reads the current period, including an open settle-up, with the past periods to pick from", async () => {
    settlements.findOpenSettlement.mockResolvedValue({ id: openId });

    const bill = await getMyBill(ana, groupId);

    expect(bill.settlementId).toBeNull();
    expect(bill.pastPeriods).toEqual([pastPeriod]);
    expect(expenses.listExpensesInPeriod).toHaveBeenCalledWith(
      groupId,
      { openSettlementId: openId },
      null,
    );
    expect(periods.listPeriodConfirmedPayments).toHaveBeenCalledWith(
      groupId,
      openId,
      null,
    );
    expect(settlements.listClosedSettlements).toHaveBeenCalledWith(
      groupId,
      null,
    );
  });

  it("reads a closed period's own expenses and payments", async () => {
    const bill = await getMyBill(ana, groupId, closedId);

    expect(bill.settlementId).toBe(closedId);
    expect(expenses.listExpensesInPeriod).toHaveBeenCalledWith(
      groupId,
      { settlementId: closedId },
      null,
    );
    expect(periods.listClosedPeriodConfirmedPayments).toHaveBeenCalledWith(
      groupId,
      closedId,
    );
    expect(periods.listPeriodConfirmedPayments).not.toHaveBeenCalled();
  });

  it("is 404 for a period that isn't one of the group's closed ones", async () => {
    await expect(getMyBill(ana, groupId, openId)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(expenses.listExpensesInPeriod).not.toHaveBeenCalled();
  });

  it("stops a former member's bill at the day they left", async () => {
    const leftAt = "2026-11-03T12:00:00+00:00";
    access.requireGroupAccess.mockResolvedValue({
      group: flat,
      readUntil: leftAt,
    });

    await getMyBill(ana, groupId);

    expect(members.listMembersAt).toHaveBeenCalledWith(groupId, leftAt);
    expect(expenses.listExpensesInPeriod).toHaveBeenCalledWith(
      groupId,
      { openSettlementId: null },
      leftAt,
    );
    expect(periods.listPeriodConfirmedPayments).toHaveBeenCalledWith(
      groupId,
      null,
      leftAt,
    );
    expect(settlements.listClosedSettlements).toHaveBeenCalledWith(
      groupId,
      leftAt,
    );
  });
});
