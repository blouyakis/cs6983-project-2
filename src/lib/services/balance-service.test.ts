// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Group } from "@/lib/db/group-members";
import { ForbiddenError } from "@/lib/http/errors";
import { getGroupBalances } from "./balance-service";

const access = vi.hoisted(() => ({ requireGroupAccess: vi.fn() }));
vi.mock("./access", () => access);

const members = vi.hoisted(() => ({ listMembersAt: vi.fn() }));
vi.mock("@/lib/db/group-members", () => members);

const periods = vi.hoisted(() => ({
  findOpenSettlementId: vi.fn(),
  listPeriodExpenses: vi.fn(),
  listPeriodConfirmedPayments: vi.fn(),
}));
vi.mock("@/lib/db/periods", () => periods);

const ana = "6f1c2d4e-1111-4222-8333-944455556666";
const sam = "7a2d3e5f-1111-4222-8333-944455556666";
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

function member(userId: string, name: string) {
  return { userId, name, defaultShareWeight: 1 };
}

beforeEach(() => {
  vi.resetAllMocks();
  access.requireGroupAccess.mockResolvedValue({ group: flat, readUntil: null });
  members.listMembersAt.mockResolvedValue([
    member(ana, "Ana"),
    member(sam, "Sam"),
  ]);
  periods.findOpenSettlementId.mockResolvedValue(null);
  periods.listPeriodExpenses.mockResolvedValue([]);
  periods.listPeriodConfirmedPayments.mockResolvedValue([]);
});

describe("getGroupBalances", () => {
  it("checks read access first and refuses an outsider", async () => {
    access.requireGroupAccess.mockRejectedValue(new ForbiddenError("no"));

    await expect(getGroupBalances(ana, groupId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(access.requireGroupAccess).toHaveBeenCalledWith(
      ana,
      groupId,
      "read",
    );
    expect(periods.listPeriodExpenses).not.toHaveBeenCalled();
  });

  it("computes each current member's balance from the period's rows", async () => {
    periods.listPeriodExpenses.mockResolvedValue([
      {
        payerId: ana,
        amountCents: 1234,
        shares: [
          { userId: ana, shareCents: 617 },
          { userId: sam, shareCents: 617 },
        ],
      },
      {
        payerId: sam,
        amountCents: 3000,
        shares: [
          { userId: ana, shareCents: 1500 },
          { userId: sam, shareCents: 1500 },
        ],
      },
    ]);

    const balances = await getGroupBalances(ana, groupId);

    expect(balances).toEqual([
      { userId: ana, balanceCents: -883 },
      { userId: sam, balanceCents: 883 },
    ]);
  });

  it("loads the period with the open settle-up, so its rows still count", async () => {
    periods.findOpenSettlementId.mockResolvedValue(settlementId);

    await getGroupBalances(ana, groupId);

    expect(periods.listPeriodExpenses).toHaveBeenCalledWith(
      groupId,
      settlementId,
      null,
    );
    expect(periods.listPeriodConfirmedPayments).toHaveBeenCalledWith(
      groupId,
      settlementId,
      null,
    );
  });

  it("shows a former member the balances as they were when they left", async () => {
    const leftAt = "2026-09-02T15:00:00Z";
    access.requireGroupAccess.mockResolvedValue({
      group: flat,
      readUntil: leftAt,
    });

    await getGroupBalances(ana, groupId);

    expect(members.listMembersAt).toHaveBeenCalledWith(groupId, leftAt);
    expect(periods.listPeriodExpenses).toHaveBeenCalledWith(
      groupId,
      null,
      leftAt,
    );
    expect(periods.listPeriodConfirmedPayments).toHaveBeenCalledWith(
      groupId,
      null,
      leftAt,
    );
  });

  it("gives every member a row, zero when nothing happened", async () => {
    const balances = await getGroupBalances(ana, groupId);

    expect(balances).toEqual([
      { userId: ana, balanceCents: 0 },
      { userId: sam, balanceCents: 0 },
    ]);
  });
});
