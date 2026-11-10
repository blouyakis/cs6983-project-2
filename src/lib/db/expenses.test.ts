// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError } from "@/lib/http/errors";
import {
  createExpense,
  deleteExpense,
  findExpense,
  listExpenses,
  listExpensesSpentBetween,
  updateExpense,
} from "./expenses";

type Result = {
  data: unknown;
  error: { message: string; code?: string; hint?: string } | null;
};

const calls: { name: string; args: unknown }[] = [];
const queries: { method: string; args: unknown[] }[] = [];
let result: Result;

function queryBuilder() {
  const builder: Record<string, unknown> = {};
  for (const method of [
    "select",
    "eq",
    "gte",
    "lt",
    "lte",
    "order",
    "delete",
  ]) {
    builder[method] = (...args: unknown[]) => {
      queries.push({ method, args });
      return builder;
    };
  }
  builder.maybeSingle = async () => {
    queries.push({ method: "maybeSingle", args: [] });
    return result;
  };
  // A list query is awaited directly, without maybeSingle.
  builder.then = (resolve: (value: Result) => unknown) => resolve(result);
  return builder;
}

vi.mock("./client", () => ({
  getDb: () => ({
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return result;
    },
    from: (table: string) => {
      queries.push({ method: "from", args: [table] });
      return queryBuilder();
    },
  }),
}));

const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const payerId = "6f1c2d4e-1111-4222-8333-944455556666";
const samId = "1a2b3c4d-3333-4444-8555-b66677778888";
const expenseId = "9c8d7e6f-4444-4555-8666-c77788889999";

const newExpense = {
  groupId,
  description: "Electricity",
  amountCents: 1001,
  payerId,
  spentOn: "2026-10-20",
  shares: [
    { userId: payerId, shareCents: 601 },
    { userId: samId, shareCents: 400 },
  ],
};

beforeEach(() => {
  calls.length = 0;
  queries.length = 0;
  result = { data: expenseId, error: null };
});

describe("createExpense", () => {
  it("writes the expense and its shares in one call to create_expense", async () => {
    await createExpense(newExpense);

    expect(calls).toEqual([
      {
        name: "create_expense",
        args: {
          p_group_id: groupId,
          p_description: "Electricity",
          p_amount_cents: 1001,
          p_payer_id: payerId,
          p_spent_on: "2026-10-20",
          p_shares: [
            { user_id: payerId, share_cents: 601 },
            { user_id: samId, share_cents: 400 },
          ],
        },
      },
    ]);
  });

  it("returns the new expense id", async () => {
    expect(await createExpense(newExpense)).toBe(expenseId);
  });

  it("turns a refusal for someone who left the group into a 409 with its message (#22)", async () => {
    const message =
      "This would change the balance of someone who has left this group.";
    result = {
      data: null,
      error: { message, code: "P0001", hint: "member_left" },
    };

    await expect(createExpense(newExpense)).rejects.toEqual(
      new ConflictError(message),
    );
  });

  it("throws when the database rejects it", async () => {
    result = { data: null, error: { message: "boom" } };

    await expect(createExpense(newExpense)).rejects.toThrow(
      "Could not create the expense: boom",
    );
  });
});

const row = {
  id: expenseId,
  group_id: groupId,
  description: "Electricity",
  amount_cents: 1001,
  payer_id: payerId,
  spent_on: "2026-10-20",
  settlement_id: null,
  created_at: "2026-10-20T18:00:00+00:00",
  edited_at: null,
  expense_shares: [
    { user_id: payerId, share_cents: 601 },
    { user_id: samId, share_cents: 400 },
  ],
};

const expense = {
  id: expenseId,
  groupId,
  description: "Electricity",
  amountCents: 1001,
  payerId,
  spentOn: "2026-10-20",
  settled: false,
  createdAt: "2026-10-20T18:00:00+00:00",
  editedAt: null,
  shares: [
    { userId: payerId, shareCents: 601 },
    { userId: samId, shareCents: 400 },
  ],
};

describe("listExpenses", () => {
  beforeEach(() => {
    result = { data: [], error: null };
  });

  it("maps the rows and their shares to camelCase", async () => {
    result = { data: [row], error: null };

    expect(await listExpenses(groupId, null)).toEqual([expense]);
  });

  it("says an expense is settled once it has a settlement", async () => {
    result = {
      data: [{ ...row, settlement_id: "5d4c3b2a-5555-4666-8777-d88899990000" }],
      error: null,
    };

    expect((await listExpenses(groupId, null))[0].settled).toBe(true);
  });

  it("asks for the group's expenses, newest day first, then newest entry first", async () => {
    await listExpenses(groupId, null);

    expect(queries).toContainEqual({ method: "from", args: ["expenses"] });
    expect(queries).toContainEqual({
      method: "eq",
      args: ["group_id", groupId],
    });
    const orders = queries.filter((query) => query.method === "order");
    expect(orders).toEqual([
      { method: "order", args: ["spent_on", { ascending: false }] },
      { method: "order", args: ["created_at", { ascending: false }] },
    ]);
  });

  it("does not limit a current member to a time", async () => {
    await listExpenses(groupId, null);

    expect(queries.some((query) => query.method === "lte")).toBe(false);
  });

  it("leaves out what was added after a former member left", async () => {
    await listExpenses(groupId, "2026-10-25T12:00:00+00:00");

    expect(queries).toContainEqual({
      method: "lte",
      args: ["created_at", "2026-10-25T12:00:00+00:00"],
    });
  });

  it("returns an empty list when there are no expenses", async () => {
    result = { data: [], error: null };

    expect(await listExpenses(groupId, null)).toEqual([]);
  });

  it("throws when the query fails", async () => {
    result = { data: null, error: { message: "boom" } };

    await expect(listExpenses(groupId, null)).rejects.toThrow(
      "Could not load expenses: boom",
    );
  });
});

describe("findExpense", () => {
  beforeEach(() => {
    result = { data: null, error: null };
  });

  it("returns the expense with its shares", async () => {
    result = { data: row, error: null };

    expect(await findExpense(expenseId)).toEqual(expense);
    expect(queries).toContainEqual({ method: "eq", args: ["id", expenseId] });
  });

  it("returns null when there is no such expense", async () => {
    expect(await findExpense(expenseId)).toBeNull();
  });

  it("throws when the lookup fails", async () => {
    result = { data: null, error: { message: "boom" } };

    await expect(findExpense(expenseId)).rejects.toThrow(
      "Could not load the expense: boom",
    );
  });
});

const edit = {
  description: "Power",
  amountCents: 5001,
  spentOn: "2026-10-21",
  shares: [
    { userId: payerId, shareCents: 2501 },
    { userId: samId, shareCents: 2500 },
  ],
};

describe("updateExpense", () => {
  beforeEach(() => {
    result = { data: null, error: null };
  });

  it("replaces the expense and its shares in one call to update_expense", async () => {
    await updateExpense(expenseId, edit);

    expect(calls).toEqual([
      {
        name: "update_expense",
        args: {
          p_expense_id: expenseId,
          p_description: "Power",
          p_amount_cents: 5001,
          p_spent_on: "2026-10-21",
          p_shares: [
            { user_id: payerId, share_cents: 2501 },
            { user_id: samId, share_cents: 2500 },
          ],
        },
      },
    ]);
  });

  it("turns the database's refusal into a 409 with its message", async () => {
    result = {
      data: null,
      error: { message: "A settled expense can't be changed.", code: "P0001" },
    };

    await expect(updateExpense(expenseId, edit)).rejects.toMatchObject({
      status: 409,
      message: "A settled expense can't be changed.",
    });
  });

  it("throws when the database rejects it for any other reason", async () => {
    result = { data: null, error: { message: "boom" } };

    await expect(updateExpense(expenseId, edit)).rejects.toThrow(
      "Could not update the expense: boom",
    );
  });
});

describe("deleteExpense", () => {
  beforeEach(() => {
    result = { data: null, error: null };
  });

  it("deletes through delete_expense, which checks the settle-up state too", async () => {
    await deleteExpense(expenseId);

    expect(calls).toEqual([
      { name: "delete_expense", args: { p_expense_id: expenseId } },
    ]);
  });

  it("turns the database's refusal into a 409 with its message", async () => {
    result = {
      data: null,
      error: {
        message: "This expense is in a settle-up that is still open.",
        code: "P0001",
      },
    };

    await expect(deleteExpense(expenseId)).rejects.toMatchObject({
      status: 409,
      message: "This expense is in a settle-up that is still open.",
    });
  });

  it("is not found for an unknown expense", async () => {
    result = { data: null, error: { message: "none", code: "P0002" } };

    await expect(deleteExpense(expenseId)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("throws when the database rejects it for any other reason", async () => {
    result = { data: null, error: { message: "boom" } };

    await expect(deleteExpense(expenseId)).rejects.toThrow(
      "Could not delete the expense: boom",
    );
  });
});

describe("listExpensesSpentBetween", () => {
  it("asks only for the day and amount of the group's expenses in the range", async () => {
    result = {
      data: [
        { spent_on: "2026-11-02", amount_cents: 3500 },
        { spent_on: "2026-11-04", amount_cents: 6100 },
      ],
      error: null,
    };

    const rows = await listExpensesSpentBetween(
      groupId,
      "2026-11-01",
      "2026-12-01",
      null,
    );

    expect(rows).toEqual([
      { spentOn: "2026-11-02", amountCents: 3500 },
      { spentOn: "2026-11-04", amountCents: 6100 },
    ]);
    expect(queries).toContainEqual({ method: "from", args: ["expenses"] });
    expect(queries).toContainEqual({
      method: "select",
      args: ["spent_on, amount_cents"],
    });
    expect(queries).toContainEqual({
      method: "eq",
      args: ["group_id", groupId],
    });
    expect(queries).toContainEqual({
      method: "gte",
      args: ["spent_on", "2026-11-01"],
    });
    expect(queries).toContainEqual({
      method: "lt",
      args: ["spent_on", "2026-12-01"],
    });
    expect(queries.some((query) => query.method === "lte")).toBe(false);
  });

  it("limits a former member to what was added before they left", async () => {
    result = { data: [], error: null };

    await listExpensesSpentBetween(
      groupId,
      "2026-11-01",
      "2026-12-01",
      "2026-11-03T12:00:00+00:00",
    );

    expect(queries).toContainEqual({
      method: "lte",
      args: ["created_at", "2026-11-03T12:00:00+00:00"],
    });
  });

  it("throws when the query fails", async () => {
    result = { data: null, error: { message: "boom" } };

    await expect(
      listExpensesSpentBetween(groupId, "2026-11-01", "2026-12-01", null),
    ).rejects.toThrow("Could not load expenses: boom");
  });
});
