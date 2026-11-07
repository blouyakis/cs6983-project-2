// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findOpenSettlementId,
  findOpenSettlementGroupIds,
  listPeriodConfirmedPayments,
  listPeriodExpenses,
} from "./periods";

type Result = { data: unknown; error: { message: string } | null };

const queries: { method: string; args: unknown[] }[] = [];
let result: Result;

function queryBuilder() {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "is", "or", "lte", "order"]) {
    builder[method] = (...args: unknown[]) => {
      queries.push({ method, args });
      return builder;
    };
  }
  builder.maybeSingle = async () => {
    queries.push({ method: "maybeSingle", args: [] });
    return result;
  };
  builder.then = (resolve: (value: Result) => unknown) => resolve(result);
  return builder;
}

vi.mock("./client", () => ({
  getDb: () => ({
    from: (table: string) => {
      queries.push({ method: "from", args: [table] });
      return queryBuilder();
    },
  }),
}));

const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const settlementId = "5e6f7a8b-5555-4666-8777-d88899990000";
const demoId = "6f1c2d4e-1111-4222-8333-944455556666";
const joId = "1a2b3c4d-3333-4444-8555-b66677778888";

function methods(): string[] {
  return queries.map((query) => query.method);
}

function argsOf(method: string): unknown[] {
  return queries.find((query) => query.method === method)?.args ?? [];
}

beforeEach(() => {
  queries.length = 0;
  result = { data: [], error: null };
});

describe("findOpenSettlementId", () => {
  it("returns the id of the group's open settlement", async () => {
    result = { data: { id: settlementId }, error: null };

    expect(await findOpenSettlementId(groupId)).toBe(settlementId);
    expect(argsOf("from")).toEqual(["settlements"]);
    expect(queries.filter((q) => q.method === "eq").map((q) => q.args)).toEqual(
      [
        ["group_id", groupId],
        ["status", "open"],
      ],
    );
  });

  it("returns null when no settle-up is open", async () => {
    result = { data: null, error: null };

    expect(await findOpenSettlementId(groupId)).toBeNull();
  });

  it("throws on a database error", async () => {
    result = { data: null, error: { message: "boom" } };

    await expect(findOpenSettlementId(groupId)).rejects.toThrow("boom");
  });
});

describe("findOpenSettlementGroupIds", () => {
  it("returns a set of group ids with an open settlement", async () => {
    result = { data: [{ group_id: "g1" }, { group_id: "g3" }], error: null };

    const open = await findOpenSettlementGroupIds(["g1", "g2", "g3"]);
    expect(open).toEqual(new Set(["g1", "g3"]));
    expect(queries.find((q) => q.method === "in")?.args).toEqual([
      "group_id",
      ["g1", "g2", "g3"],
    ]);
    expect(queries.find((q) => q.method === "eq")?.args).toEqual([
      "status",
      "open",
    ]);
  });

  it("returns an empty set without querying when given no group ids", async () => {
    const open = await findOpenSettlementGroupIds([]);
    expect(open).toEqual(new Set());
    expect(queries.find((q) => q.method === "from")).toBeUndefined();
  });

  it("throws on a database error", async () => {
    result = { data: null, error: { message: "db failure" } };

    await expect(findOpenSettlementGroupIds(["g1"])).rejects.toThrow(
      "db failure",
    );
  });
});

describe("listPeriodExpenses", () => {
  it("loads unsettled expenses with their shares as the domain wants them", async () => {
    result = {
      data: [
        {
          payer_id: demoId,
          amount_cents: 6000,
          expense_shares: [
            { user_id: demoId, share_cents: 3000 },
            { user_id: joId, share_cents: 3000 },
          ],
        },
      ],
      error: null,
    };

    const expenses = await listPeriodExpenses(groupId, null, null);

    expect(expenses).toEqual([
      {
        payerId: demoId,
        amountCents: 6000,
        shares: [
          { userId: demoId, shareCents: 3000 },
          { userId: joId, shareCents: 3000 },
        ],
      },
    ]);
    expect(argsOf("from")).toEqual(["expenses"]);
    expect(argsOf("eq")).toEqual(["group_id", groupId]);
    expect(argsOf("is")).toEqual(["settlement_id", null]);
    expect(methods()).not.toContain("or");
    expect(methods()).not.toContain("lte");
  });

  it("also counts expenses in the open settlement, which is still the current period", async () => {
    await listPeriodExpenses(groupId, settlementId, null);

    expect(argsOf("or")).toEqual([
      `settlement_id.is.null,settlement_id.eq.${settlementId}`,
    ]);
    expect(methods()).not.toContain("is");
  });

  it("stops at the day a former member left", async () => {
    await listPeriodExpenses(groupId, null, "2026-09-02T15:00:00Z");

    expect(argsOf("lte")).toEqual(["created_at", "2026-09-02T15:00:00Z"]);
  });

  it("throws on a database error", async () => {
    result = { data: null, error: { message: "boom" } };

    await expect(listPeriodExpenses(groupId, null, null)).rejects.toThrow(
      "boom",
    );
  });
});

describe("listPeriodConfirmedPayments", () => {
  it("stops at a cut-off by confirmed_at, for a settle-up's snapshot", async () => {
    result = { data: [], error: null };

    await listPeriodConfirmedPayments(
      groupId,
      null,
      null,
      "2026-11-01T10:00:00+00:00",
    );

    expect(argsOf("lte")).toEqual([
      "confirmed_at",
      "2026-11-01T10:00:00+00:00",
    ]);
  });

  it("loads only confirmed payments of the period", async () => {
    result = {
      data: [{ from_user_id: joId, to_user_id: demoId, amount_cents: 1000 }],
      error: null,
    };

    const payments = await listPeriodConfirmedPayments(groupId, null, null);

    expect(payments).toEqual([
      { fromUserId: joId, toUserId: demoId, amountCents: 1000 },
    ]);
    expect(argsOf("from")).toEqual(["payments"]);
    expect(queries.filter((q) => q.method === "eq").map((q) => q.args)).toEqual(
      [
        ["group_id", groupId],
        ["status", "confirmed"],
      ],
    );
    expect(argsOf("is")).toEqual(["settlement_id", null]);
  });

  it("also counts payments in the open settlement", async () => {
    await listPeriodConfirmedPayments(groupId, settlementId, null);

    expect(argsOf("or")).toEqual([
      `settlement_id.is.null,settlement_id.eq.${settlementId}`,
    ]);
  });

  it("stops at the day a former member left", async () => {
    await listPeriodConfirmedPayments(groupId, null, "2026-09-02T15:00:00Z");

    expect(argsOf("lte")).toEqual(["created_at", "2026-09-02T15:00:00Z"]);
  });

  it("throws on a database error", async () => {
    result = { data: null, error: { message: "boom" } };

    await expect(
      listPeriodConfirmedPayments(groupId, null, null),
    ).rejects.toThrow("boom");
  });
});
