// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Expense } from "@/lib/db/expenses";
import { ForbiddenError } from "@/lib/http/errors";
import { listExpenseHistory } from "./expense-history-service";
import type { GroupSummary } from "./group-service";

const access = vi.hoisted(() => ({ requireGroupAccess: vi.fn() }));
vi.mock("./access", () => access);

const groupService = vi.hoisted(() => ({ listGroups: vi.fn() }));
vi.mock("./group-service", () => groupService);

const expensesDb = vi.hoisted(() => ({ listExpenses: vi.fn() }));
vi.mock("@/lib/db/expenses", () => expensesDb);

const settlements = vi.hoisted(() => ({ findOpenSettlement: vi.fn() }));
vi.mock("@/lib/db/settlements", () => settlements);

const ana = "6f1c2d4e-1111-4222-8333-944455556666";
const sam = "7a2d3e5f-1111-4222-8333-944455556666";
const flatId = "0b7e8a10-2222-4333-8444-a55566667777";
const tripId = "2c3d4e5f-2222-4333-8444-a55566667777";
const personalId = "3d4e5f6a-2222-4333-8444-a55566667777";
const strangerGroupId = "4e5f6a7b-2222-4333-8444-a55566667777";

function summary(
  id: string,
  name: string,
  overrides: Partial<GroupSummary> = {},
): GroupSummary {
  return {
    id,
    name,
    isPersonal: false,
    archivedAt: null,
    createdAt: "2026-10-01T09:00:00+00:00",
    readOnly: false,
    members: [
      { userId: ana, name: "Ana", defaultShareWeight: 1 },
      { userId: sam, name: "Sam", defaultShareWeight: 1 },
    ],
    leftAt: null,
    ...overrides,
  };
}

const flat = summary(flatId, "Flat");
const trip = summary(tripId, "Trip", {
  readOnly: true,
  leftAt: "2026-10-25T12:00:00+00:00",
});
const personal = summary(personalId, "Just me", { isPersonal: true });

function expense(
  id: string,
  groupId: string,
  payerId: string,
  shares: [string, number][],
  spentOn = "2026-11-02",
): Expense {
  return {
    id,
    groupId,
    description: `Cost ${id}`,
    amountCents: shares.reduce((sum, [, cents]) => sum + cents, 0),
    payerId,
    spentOn,
    settled: false,
    createdAt: `${spentOn}T10:00:00+00:00`,
    editedAt: null,
    shares: shares.map(([userId, shareCents]) => ({ userId, shareCents })),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  groupService.listGroups.mockResolvedValue([personal, flat, trip]);
  // A current member reads everything; Ana left Trip.
  access.requireGroupAccess.mockImplementation(
    async (_userId: string, groupId: string) => ({
      readUntil: groupId === tripId ? trip.leftAt : null,
    }),
  );
  expensesDb.listExpenses.mockResolvedValue([]);
  settlements.findOpenSettlement.mockResolvedValue(null);
});

describe("listExpenseHistory", () => {
  it("lists the expenses the user shares across every group, newest first", async () => {
    expensesDb.listExpenses.mockImplementation(async (groupId: string) => {
      if (groupId === flatId) {
        return [
          expense(
            "flat",
            flatId,
            sam,
            [
              [sam, 500],
              [ana, 500],
            ],
            "2026-11-01",
          ),
        ];
      }
      if (groupId === personalId) {
        return [expense("me", personalId, ana, [[ana, 700]], "2026-11-02")];
      }
      return [expense("trip", tripId, ana, [[ana, 900]], "2026-10-20")];
    });

    const history = await listExpenseHistory(ana);

    expect(
      history.map((row) => [row.id, row.groupName, row.yourShareCents]),
    ).toEqual([
      ["me", "Just me", 700],
      ["flat", "Flat", 500],
      ["trip", "Trip", 900],
    ]);
    expect(history.map((row) => row.editLock)).toEqual([
      null,
      "not-payer",
      "read-only",
    ]);
  });

  it("leaves out an expense in the user's group that they don't share", async () => {
    expensesDb.listExpenses.mockImplementation(async (groupId: string) =>
      groupId === flatId ? [expense("sams", flatId, sam, [[sam, 500]])] : [],
    );

    expect(await listExpenseHistory(ana)).toEqual([]);
  });

  it("checks access for every group and only reads the user's groups", async () => {
    await listExpenseHistory(ana);

    expect(
      access.requireGroupAccess.mock.calls.map((call) => call.slice(0, 3)),
    ).toEqual([
      [ana, personalId, "read"],
      [ana, flatId, "read"],
      [ana, tripId, "read"],
    ]);
    expect(
      expensesDb.listExpenses.mock.calls.map(([groupId]) => groupId),
    ).toEqual([personalId, flatId, tripId]);
  });

  it("gives a former member only what was added before they left", async () => {
    await listExpenseHistory(ana);

    expect(expensesDb.listExpenses).toHaveBeenCalledWith(
      tripId,
      "2026-10-25T12:00:00+00:00",
      expect.anything(),
    );
    expect(expensesDb.listExpenses).toHaveBeenCalledWith(
      flatId,
      null,
      expect.anything(),
    );
  });

  it("passes who paid and the days to every group's query", async () => {
    const filters = { paidBy: sam, from: "2026-10-01", to: "2026-10-31" };

    await listExpenseHistory(ana, filters);

    expect(expensesDb.listExpenses.mock.calls).toEqual([
      [personalId, null, filters],
      [flatId, null, filters],
      [tripId, trip.leftAt, filters],
    ]);
  });

  it("reads only the chosen group when groupId is given, with the other filters", async () => {
    await listExpenseHistory(ana, {
      groupId: flatId,
      paidBy: sam,
      from: "2026-10-01",
      to: "2026-10-31",
    });

    expect(expensesDb.listExpenses.mock.calls).toEqual([
      [flatId, null, { paidBy: sam, from: "2026-10-01", to: "2026-10-31" }],
    ]);
  });

  it("is 403 for a groupId the user isn't in, before anything is read", async () => {
    access.requireGroupAccess.mockRejectedValue(new ForbiddenError());

    await expect(
      listExpenseHistory(ana, { groupId: strangerGroupId }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(groupService.listGroups).not.toHaveBeenCalled();
    expect(expensesDb.listExpenses).not.toHaveBeenCalled();
  });

  it("locks an expense in a group's open settle-up", async () => {
    expensesDb.listExpenses.mockImplementation(async (groupId: string) =>
      groupId === flatId
        ? [
            expense("flat", flatId, ana, [
              [ana, 500],
              [sam, 500],
            ]),
          ]
        : [],
    );
    settlements.findOpenSettlement.mockResolvedValue({
      startedAt: "2026-11-03T00:00:00+00:00",
    });

    const [row] = await listExpenseHistory(ana);

    expect(row.editLock).toBe("settle-up");
  });

  it("asks for an open settle-up only where the user could still edit", async () => {
    await listExpenseHistory(ana);

    expect(settlements.findOpenSettlement.mock.calls).toEqual([[flatId]]);
  });
});
