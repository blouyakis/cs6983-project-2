// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createExpense } from "./expenses";

type Result = { data: unknown; error: { message: string } | null };

const calls: { name: string; args: unknown }[] = [];
let result: Result;

vi.mock("./client", () => ({
  getDb: () => ({
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return result;
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

  it("throws when the database rejects it", async () => {
    result = { data: null, error: { message: "boom" } };

    await expect(createExpense(newExpense)).rejects.toThrow(
      "Could not create the expense: boom",
    );
  });
});
