// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Expense } from "@/lib/db/expenses";
import type { Group } from "@/lib/db/group-members";
import { ForbiddenError, ValidationError } from "@/lib/http/errors";
import type { CreateExpenseInput } from "@/lib/validation/expense";
import { addExpense, listGroupExpenses } from "./expense-service";

const access = vi.hoisted(() => ({ requireGroupAccess: vi.fn() }));
vi.mock("./access", () => access);

const members = vi.hoisted(() => ({ listCurrentMemberWeights: vi.fn() }));
vi.mock("@/lib/db/group-members", () => members);

const expenses = vi.hoisted(() => ({
  createExpense: vi.fn(),
  findExpense: vi.fn(),
  listExpenses: vi.fn(),
}));
vi.mock("@/lib/db/expenses", () => expenses);

const ana = "6f1c2d4e-1111-4222-8333-944455556666";
const sam = "7a2d3e5f-1111-4222-8333-944455556666";
const jo = "8b3e4f60-1111-4222-8333-944455556666";
const stranger = "9c4f5071-1111-4222-8333-944455556666";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const expenseId = "1d5a6182-3333-4444-8555-b66677778888";

const flat: Group = {
  id: groupId,
  name: "Flat",
  isPersonal: false,
  createdBy: ana,
  archivedAt: null,
  createdAt: "2026-10-01T09:00:00+00:00",
};

const saved: Expense = {
  id: expenseId,
  groupId,
  description: "Electricity",
  amountCents: 1234,
  payerId: ana,
  spentOn: "2026-11-02",
  settled: false,
  createdAt: "2026-11-02T18:00:00+00:00",
  editedAt: null,
  shares: [],
};

function input(overrides: Partial<CreateExpenseInput> = {}) {
  return {
    description: "Electricity",
    amountCents: 1234,
    spentOn: "2026-11-02",
    mode: "even",
    sharedBy: [ana, sam, jo],
    ...overrides,
  } as CreateExpenseInput;
}

function sharesWritten() {
  return expenses.createExpense.mock.calls[0][0].shares;
}

beforeEach(() => {
  vi.resetAllMocks();
  access.requireGroupAccess.mockResolvedValue({ group: flat, readUntil: null });
  members.listCurrentMemberWeights.mockResolvedValue([
    { userId: ana, weight: 1 },
    { userId: sam, weight: 1 },
    { userId: jo, weight: 1 },
  ]);
  expenses.createExpense.mockResolvedValue(expenseId);
  expenses.findExpense.mockResolvedValue(saved);
});

describe("addExpense", () => {
  it("needs write access to the group", async () => {
    await addExpense(ana, groupId, input());

    expect(access.requireGroupAccess).toHaveBeenCalledWith(
      ana,
      groupId,
      "write",
    );
  });

  it("makes the current user the payer and returns the saved expense", async () => {
    const result = await addExpense(ana, groupId, input());

    expect(expenses.createExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId,
        description: "Electricity",
        amountCents: 1234,
        payerId: ana,
        spentOn: "2026-11-02",
      }),
    );
    expect(expenses.findExpense).toHaveBeenCalledWith(expenseId);
    expect(result).toBe(saved);
  });

  it("splits evenly, and the shares add up to the amount with the leftover cent on the payer", async () => {
    await addExpense(ana, groupId, input());

    expect(sharesWritten()).toEqual([
      { userId: ana, shareCents: 412 },
      { userId: sam, shareCents: 411 },
      { userId: jo, shareCents: 411 },
    ]);
  });

  it("gives the leftover cent to the payer even when someone else is listed first", async () => {
    await addExpense(
      sam,
      groupId,
      input({ amountCents: 1001, sharedBy: [ana, sam] }),
    );

    expect(expenses.createExpense.mock.calls[0][0].payerId).toBe(sam);
    expect(sharesWritten()).toEqual([
      { userId: ana, shareCents: 500 },
      { userId: sam, shareCents: 501 },
    ]);
  });

  it("splits an even expense 1:1 whatever the group's weights are", async () => {
    members.listCurrentMemberWeights.mockResolvedValue([
      { userId: ana, weight: 3 },
      { userId: sam, weight: 2 },
    ]);

    await addExpense(
      ana,
      groupId,
      input({ amountCents: 1000, sharedBy: [ana, sam] }),
    );

    expect(sharesWritten()).toEqual([
      { userId: ana, shareCents: 500 },
      { userId: sam, shareCents: 500 },
    ]);
  });

  it("splits only among the people chosen", async () => {
    await addExpense(
      ana,
      groupId,
      input({ amountCents: 1000, sharedBy: [ana, jo] }),
    );

    expect(sharesWritten()).toEqual([
      { userId: ana, shareCents: 500 },
      { userId: jo, shareCents: 500 },
    ]);
  });

  it("uses the amounts the payer entered for a custom split", async () => {
    await addExpense(
      ana,
      groupId,
      input({
        mode: "custom",
        sharedBy: [ana, sam],
        amountsCents: { [ana]: 0, [sam]: 1234 },
      } as Partial<CreateExpenseInput>),
    );

    expect(sharesWritten()).toEqual([
      { userId: ana, shareCents: 0 },
      { userId: sam, shareCents: 1234 },
    ]);
  });

  it("saves an amount of 0, and every share is 0", async () => {
    await addExpense(ana, groupId, input({ amountCents: 0 }));

    expect(expenses.createExpense).toHaveBeenCalledOnce();
    expect(sharesWritten()).toEqual([
      { userId: ana, shareCents: 0 },
      { userId: sam, shareCents: 0 },
      { userId: jo, shareCents: 0 },
    ]);
  });

  it("lets the only member of a personal space log a cost for themselves", async () => {
    access.requireGroupAccess.mockResolvedValue({
      group: { ...flat, isPersonal: true },
      readUntil: null,
    });
    members.listCurrentMemberWeights.mockResolvedValue([
      { userId: ana, weight: 1 },
    ]);

    await addExpense(ana, groupId, input({ sharedBy: [ana] }));

    expect(sharesWritten()).toEqual([{ userId: ana, shareCents: 1234 }]);
  });

  it("rejects a sharer who isn't a current member with a 400 on sharedBy", async () => {
    const attempt = addExpense(
      ana,
      groupId,
      input({ sharedBy: [ana, stranger] }),
    );

    await expect(attempt).rejects.toBeInstanceOf(ValidationError);
    await expect(attempt).rejects.toMatchObject({
      status: 400,
      fields: { sharedBy: "Everyone sharing this cost must be in the group." },
    });
    expect(expenses.createExpense).not.toHaveBeenCalled();
  });

  it("rejects sharers that leave out the payer with a 400 on sharedBy", async () => {
    const attempt = addExpense(ana, groupId, input({ sharedBy: [sam, jo] }));

    await expect(attempt).rejects.toMatchObject({
      status: 400,
      fields: { sharedBy: expect.stringContaining("payer") },
    });
    expect(expenses.createExpense).not.toHaveBeenCalled();
  });

  it("rejects custom amounts that don't add up with a 400 on amountsCents", async () => {
    const attempt = addExpense(
      ana,
      groupId,
      input({
        mode: "custom",
        sharedBy: [ana, sam],
        amountsCents: { [ana]: 100, [sam]: 100 },
      } as Partial<CreateExpenseInput>),
    );

    await expect(attempt).rejects.toMatchObject({
      status: 400,
      fields: { amountsCents: expect.stringContaining("add up") },
    });
    expect(expenses.createExpense).not.toHaveBeenCalled();
  });

  it("passes on a 403 for a former member or an archived group without writing", async () => {
    access.requireGroupAccess.mockRejectedValue(new ForbiddenError());

    await expect(addExpense(ana, groupId, input())).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(expenses.createExpense).not.toHaveBeenCalled();
  });

  it("throws when the expense it just saved can't be found", async () => {
    expenses.findExpense.mockResolvedValue(null);

    await expect(addExpense(ana, groupId, input())).rejects.toThrow(
      "The new expense could not be loaded.",
    );
  });
});

describe("listGroupExpenses", () => {
  it("lists a current member's expenses without a time limit", async () => {
    expenses.listExpenses.mockResolvedValue([saved]);

    expect(await listGroupExpenses(ana, groupId)).toEqual([saved]);
    expect(access.requireGroupAccess).toHaveBeenCalledWith(
      ana,
      groupId,
      "read",
    );
    expect(expenses.listExpenses).toHaveBeenCalledWith(groupId, null);
  });

  it("limits a former member to what was added before they left", async () => {
    access.requireGroupAccess.mockResolvedValue({
      group: flat,
      readUntil: "2026-10-25T12:00:00+00:00",
    });
    expenses.listExpenses.mockResolvedValue([]);

    await listGroupExpenses(ana, groupId);

    expect(expenses.listExpenses).toHaveBeenCalledWith(
      groupId,
      "2026-10-25T12:00:00+00:00",
    );
  });

  it("passes on a 403 for someone who isn't in the group", async () => {
    access.requireGroupAccess.mockRejectedValue(new ForbiddenError());

    await expect(listGroupExpenses(ana, groupId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(expenses.listExpenses).not.toHaveBeenCalled();
  });
});
