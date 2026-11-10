// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Expense } from "@/lib/db/expenses";
import type { Group } from "@/lib/db/group-members";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/http/errors";
import type { UpdateExpenseInput } from "@/lib/validation/expense";
import { editExpense, removeExpense } from "./expense-edit-service";

const access = vi.hoisted(() => ({ requireGroupAccess: vi.fn() }));
vi.mock("./access", () => access);

const members = vi.hoisted(() => ({ listCurrentMemberWeights: vi.fn() }));
vi.mock("@/lib/db/group-members", () => members);

const expenses = vi.hoisted(() => ({
  findExpense: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
}));
vi.mock("@/lib/db/expenses", () => expenses);

const ana = "6f1c2d4e-1111-4222-8333-944455556666";
const sam = "7a2d3e5f-1111-4222-8333-944455556666";
const jo = "8b3e4f60-1111-4222-8333-944455556666";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const otherGroupId = "2c8f9b21-2222-4333-8444-a55566667777";
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
  shares: [
    { userId: ana, shareCents: 617 },
    { userId: sam, shareCents: 617 },
  ],
};

function input(overrides: Partial<UpdateExpenseInput> = {}) {
  return {
    description: "Power",
    amountCents: 3000,
    spentOn: "2026-11-03",
    mode: "even",
    sharedBy: [ana, sam, jo],
    ...overrides,
  } as UpdateExpenseInput;
}

beforeEach(() => {
  vi.resetAllMocks();
  access.requireGroupAccess.mockResolvedValue({ group: flat, readUntil: null });
  members.listCurrentMemberWeights.mockResolvedValue([
    { userId: ana, weight: 1 },
    { userId: sam, weight: 1 },
    { userId: jo, weight: 1 },
  ]);
  expenses.findExpense.mockResolvedValue(saved);
  expenses.updateExpense.mockResolvedValue(undefined);
  expenses.deleteExpense.mockResolvedValue(undefined);
});

describe("editExpense", () => {
  it("needs write access, so a former member or an archived group is refused", async () => {
    access.requireGroupAccess.mockRejectedValue(
      new ForbiddenError(
        "You left this group, so you can only read its history.",
      ),
    );

    await expect(
      editExpense(ana, groupId, expenseId, input()),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(access.requireGroupAccess).toHaveBeenCalledWith(
      ana,
      groupId,
      "write",
    );
    expect(expenses.updateExpense).not.toHaveBeenCalled();
  });

  it("replaces the fields and the split, keeps the payer, and returns the saved expense", async () => {
    const edited = { ...saved, description: "Power", editedAt: "2026-11-04" };
    expenses.findExpense
      .mockResolvedValueOnce(saved)
      .mockResolvedValueOnce(edited);

    const result = await editExpense(ana, groupId, expenseId, input());

    expect(expenses.updateExpense).toHaveBeenCalledWith(expenseId, {
      description: "Power",
      amountCents: 3000,
      spentOn: "2026-11-03",
      shares: [
        { userId: ana, shareCents: 1000 },
        { userId: sam, shareCents: 1000 },
        { userId: jo, shareCents: 1000 },
      ],
    });
    expect(result).toBe(edited);
  });

  it("gives the leftover cent to the payer, whoever is listed first", async () => {
    await editExpense(
      ana,
      groupId,
      expenseId,
      input({ amountCents: 1001, sharedBy: [sam, ana] }),
    );

    expect(expenses.updateExpense.mock.calls[0][1].shares).toEqual([
      { userId: sam, shareCents: 500 },
      { userId: ana, shareCents: 501 },
    ]);
  });

  it("uses the amounts entered for a custom split", async () => {
    await editExpense(
      ana,
      groupId,
      expenseId,
      input({
        mode: "custom",
        sharedBy: [ana, sam],
        amountsCents: { [ana]: 0, [sam]: 3000 },
      } as Partial<UpdateExpenseInput>),
    );

    expect(expenses.updateExpense.mock.calls[0][1].shares).toEqual([
      { userId: ana, shareCents: 0 },
      { userId: sam, shareCents: 3000 },
    ]);
  });

  it("refuses anyone but the payer with 403", async () => {
    await expect(
      editExpense(sam, groupId, expenseId, input()),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(expenses.updateExpense).not.toHaveBeenCalled();
  });

  it("refuses a settled expense with 409", async () => {
    expenses.findExpense.mockResolvedValue({ ...saved, settled: true });

    await expect(
      editExpense(ana, groupId, expenseId, input()),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(expenses.updateExpense).not.toHaveBeenCalled();
  });

  it("rejects an edit whose sharers leave the payer out, with the field named", async () => {
    await expect(
      editExpense(ana, groupId, expenseId, input({ sharedBy: [sam, jo] })),
    ).rejects.toMatchObject({
      status: 400,
      fields: { sharedBy: expect.any(String) },
    });
    expect(expenses.updateExpense).not.toHaveBeenCalled();
  });

  it("rejects a sharer who isn't a current member", async () => {
    members.listCurrentMemberWeights.mockResolvedValue([
      { userId: ana, weight: 1 },
      { userId: sam, weight: 1 },
    ]);

    await expect(
      editExpense(ana, groupId, expenseId, input()),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(expenses.updateExpense).not.toHaveBeenCalled();
  });

  it("is a 404 for an expense that doesn't exist or is in another group", async () => {
    expenses.findExpense.mockResolvedValue(null);
    await expect(
      editExpense(ana, groupId, expenseId, input()),
    ).rejects.toBeInstanceOf(NotFoundError);

    expenses.findExpense.mockResolvedValue({ ...saved, groupId: otherGroupId });
    await expect(
      editExpense(ana, groupId, expenseId, input()),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(expenses.updateExpense).not.toHaveBeenCalled();
  });
});

describe("removeExpense", () => {
  it("needs write access to the group", async () => {
    access.requireGroupAccess.mockRejectedValue(new ForbiddenError("no"));

    await expect(removeExpense(ana, groupId, expenseId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(expenses.deleteExpense).not.toHaveBeenCalled();
  });

  it("deletes the payer's own unsettled expense", async () => {
    await removeExpense(ana, groupId, expenseId);

    expect(expenses.deleteExpense).toHaveBeenCalledWith(expenseId);
  });

  it("refuses anyone but the payer with 403", async () => {
    await expect(removeExpense(sam, groupId, expenseId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(expenses.deleteExpense).not.toHaveBeenCalled();
  });

  it("refuses a settled expense with 409", async () => {
    expenses.findExpense.mockResolvedValue({ ...saved, settled: true });

    await expect(removeExpense(ana, groupId, expenseId)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(expenses.deleteExpense).not.toHaveBeenCalled();
  });

  it("is a 404 for an expense that isn't in the group", async () => {
    expenses.findExpense.mockResolvedValue(null);

    await expect(removeExpense(ana, groupId, expenseId)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

// A member who has left keeps the balance they left with, so an expense they
// have a non-zero share in is locked like a settled one (#22, AGENTS.md
// Section 6.7).
describe("an expense someone who has left shares", () => {
  const leftMessage =
    "Someone who shares this expense has left the group, so it can't be changed until it's settled.";

  beforeEach(() => {
    // Sam has left.
    members.listCurrentMemberWeights.mockResolvedValue([
      { userId: ana, weight: 1 },
      { userId: jo, weight: 1 },
    ]);
  });

  it("can't be edited, not even its description, and nothing is written", async () => {
    await expect(
      editExpense(
        ana,
        groupId,
        expenseId,
        input({ sharedBy: [ana], description: "Power" }),
      ),
    ).rejects.toEqual(new ConflictError(leftMessage));
    expect(members.listCurrentMemberWeights).toHaveBeenCalledWith(groupId);
    expect(expenses.updateExpense).not.toHaveBeenCalled();
  });

  it("can't be deleted, and nothing is written", async () => {
    await expect(removeExpense(ana, groupId, expenseId)).rejects.toEqual(
      new ConflictError(leftMessage),
    );
    expect(expenses.deleteExpense).not.toHaveBeenCalled();
  });

  it("can still be changed when their share is zero", async () => {
    expenses.findExpense.mockResolvedValue({
      ...saved,
      shares: [
        { userId: ana, shareCents: 1234 },
        { userId: sam, shareCents: 0 },
      ],
    });

    await removeExpense(ana, groupId, expenseId);

    expect(expenses.deleteExpense).toHaveBeenCalledWith(expenseId);
  });
});
