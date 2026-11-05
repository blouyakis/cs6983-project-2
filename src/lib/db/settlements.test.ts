// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError } from "@/lib/http/errors";
import {
  cancelOpenSettlement,
  confirmPayment,
  findOpenSettlement,
  findPayment,
  findSettlement,
  insertSettlement,
  listClosedSettlements,
  listSettlementPayments,
  markPaymentPaid,
} from "./settlements";

type Result = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

const calls: { method: string; args: unknown[] }[] = [];
// One result per terminal call, in order, so a function that runs two
// queries can be given both answers.
let results: Result[];

function nextResult(): Result {
  const next = results.shift();
  if (!next) {
    throw new Error("no result queued");
  }
  return next;
}

function queryBuilder() {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "update", "eq", "in", "is", "lte", "order"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.maybeSingle = async () => {
    calls.push({ method: "maybeSingle", args: [] });
    return nextResult();
  };
  builder.then = (resolve: (value: Result) => unknown) => resolve(nextResult());
  return builder;
}

vi.mock("./client", () => ({
  getDb: () => ({
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return queryBuilder();
    },
    rpc: async (name: string, params: unknown) => {
      calls.push({ method: "rpc", args: [name, params] });
      return nextResult();
    },
  }),
}));

const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const settlementId = "5e6f7a8b-5555-4666-8777-d88899990000";
const paymentId = "9c8d7e6f-6666-4777-8888-e99900001111";
const anaId = "6f1c2d4e-1111-4222-8333-944455556666";
const samId = "7a2d3e5f-1111-4222-8333-944455556666";

const settlementRow = {
  id: settlementId,
  group_id: groupId,
  status: "open",
  started_by: anaId,
  started_at: "2026-11-01T10:00:00+00:00",
  closed_at: null,
};

const paymentRow = {
  id: paymentId,
  group_id: groupId,
  from_user_id: samId,
  to_user_id: anaId,
  amount_cents: 1500,
  status: "suggested",
  settlement_id: settlementId,
  created_at: "2026-11-01T10:00:00+00:00",
  paid_at: null,
  confirmed_at: null,
};

const payment = {
  id: paymentId,
  groupId,
  fromUserId: samId,
  toUserId: anaId,
  amountCents: 1500,
  status: "suggested",
  settlementId,
  createdAt: "2026-11-01T10:00:00+00:00",
  paidAt: null,
  confirmedAt: null,
};

function argsOf(method: string): unknown[] {
  return calls.find((call) => call.method === method)?.args ?? [];
}

function allArgsOf(method: string): unknown[][] {
  return calls.filter((call) => call.method === method).map((c) => c.args);
}

beforeEach(() => {
  calls.length = 0;
  results = [];
});

describe("insertSettlement", () => {
  it("starts a settle-up through start_settlement with the payments in columns", async () => {
    results = [{ data: settlementId, error: null }];

    const id = await insertSettlement(groupId, anaId, [
      { fromUserId: samId, toUserId: anaId, amountCents: 1500 },
    ]);

    expect(id).toBe(settlementId);
    expect(argsOf("rpc")).toEqual([
      "start_settlement",
      {
        p_group_id: groupId,
        p_started_by: anaId,
        p_payments: [
          { from_user_id: samId, to_user_id: anaId, amount_cents: 1500 },
        ],
      },
    ]);
  });

  it("is a conflict when a settle-up is already open", async () => {
    results = [
      { data: null, error: { message: "already open", code: "P0001" } },
    ];

    await expect(insertSettlement(groupId, anaId, [])).rejects.toThrow(
      ConflictError,
    );
  });

  it("throws on any other database error", async () => {
    results = [{ data: null, error: { message: "boom" } }];

    await expect(insertSettlement(groupId, anaId, [])).rejects.toThrow("boom");
  });
});

describe("findOpenSettlement", () => {
  it("returns the group's open settlement in camelCase", async () => {
    results = [{ data: settlementRow, error: null }];

    const found = await findOpenSettlement(groupId);

    expect(found).toEqual({
      id: settlementId,
      groupId,
      status: "open",
      startedBy: anaId,
      startedAt: "2026-11-01T10:00:00+00:00",
      closedAt: null,
    });
    expect(argsOf("from")).toEqual(["settlements"]);
    expect(allArgsOf("eq")).toEqual([
      ["group_id", groupId],
      ["status", "open"],
    ]);
  });

  it("returns null when none is open", async () => {
    results = [{ data: null, error: null }];

    expect(await findOpenSettlement(groupId)).toBeNull();
  });

  it("throws on a database error", async () => {
    results = [{ data: null, error: { message: "boom" } }];

    await expect(findOpenSettlement(groupId)).rejects.toThrow("boom");
  });
});

describe("findSettlement", () => {
  it("returns the settlement in camelCase", async () => {
    results = [{ data: settlementRow, error: null }];

    const found = await findSettlement(settlementId);

    expect(found?.id).toBe(settlementId);
    expect(found?.startedBy).toBe(anaId);
    expect(argsOf("from")).toEqual(["settlements"]);
    expect(argsOf("eq")).toEqual(["id", settlementId]);
  });

  it("returns null for an unknown settlement", async () => {
    results = [{ data: null, error: null }];

    expect(await findSettlement(settlementId)).toBeNull();
  });

  it("throws on a database error", async () => {
    results = [{ data: null, error: { message: "boom" } }];

    await expect(findSettlement(settlementId)).rejects.toThrow("boom");
  });
});

describe("listSettlementPayments", () => {
  it("lists a settlement's payments in camelCase, oldest first", async () => {
    results = [{ data: [paymentRow], error: null }];

    expect(await listSettlementPayments(settlementId)).toEqual([payment]);
    expect(argsOf("from")).toEqual(["payments"]);
    expect(argsOf("eq")).toEqual(["settlement_id", settlementId]);
    expect(argsOf("order")).toEqual(["created_at", { ascending: true }]);
  });

  it("throws on a database error", async () => {
    results = [{ data: null, error: { message: "boom" } }];

    await expect(listSettlementPayments(settlementId)).rejects.toThrow("boom");
  });
});

describe("listClosedSettlements", () => {
  it("lists closed periods, newest first, with their expense and payment counts", async () => {
    const older = {
      ...settlementRow,
      id: "1111aaaa-5555-4666-8777-d88899990000",
      status: "closed",
      started_at: "2026-09-01T10:00:00+00:00",
      closed_at: "2026-09-30T10:00:00+00:00",
    };
    const newer = {
      ...settlementRow,
      status: "closed",
      closed_at: "2026-10-31T10:00:00+00:00",
    };
    results = [
      { data: [newer, older], error: null },
      {
        data: [
          { settlement_id: settlementId },
          { settlement_id: settlementId },
          { settlement_id: older.id },
        ],
        error: null,
      },
      { data: [{ settlement_id: older.id }], error: null },
    ];

    const periods = await listClosedSettlements(groupId, null);

    expect(periods).toEqual([
      {
        id: settlementId,
        groupId,
        status: "closed",
        startedBy: anaId,
        startedAt: "2026-11-01T10:00:00+00:00",
        closedAt: "2026-10-31T10:00:00+00:00",
        expenseCount: 2,
        paymentCount: 0,
      },
      {
        id: older.id,
        groupId,
        status: "closed",
        startedBy: anaId,
        startedAt: "2026-09-01T10:00:00+00:00",
        closedAt: "2026-09-30T10:00:00+00:00",
        expenseCount: 1,
        paymentCount: 1,
      },
    ]);
    expect(allArgsOf("from")).toEqual([
      ["settlements"],
      ["expenses"],
      ["payments"],
    ]);
    expect(allArgsOf("eq")).toContainEqual(["status", "closed"]);
    expect(argsOf("order")).toEqual(["closed_at", { ascending: false }]);
    expect(allArgsOf("in")).toEqual([
      ["settlement_id", [settlementId, older.id]],
      ["settlement_id", [settlementId, older.id]],
    ]);
  });

  it("asks nothing more when there are no closed periods", async () => {
    results = [{ data: [], error: null }];

    expect(await listClosedSettlements(groupId, null)).toEqual([]);
    expect(allArgsOf("from")).toEqual([["settlements"]]);
  });

  it("stops at the day a former member left", async () => {
    results = [{ data: [], error: null }];

    await listClosedSettlements(groupId, "2026-09-02T15:00:00Z");

    expect(argsOf("lte")).toEqual(["started_at", "2026-09-02T15:00:00Z"]);
  });

  it("throws on a database error", async () => {
    results = [{ data: null, error: { message: "boom" } }];

    await expect(listClosedSettlements(groupId, null)).rejects.toThrow("boom");
  });
});

describe("cancelOpenSettlement", () => {
  it("cancels through cancel_settlement", async () => {
    results = [{ data: null, error: null }];

    await cancelOpenSettlement(groupId);

    expect(argsOf("rpc")).toEqual([
      "cancel_settlement",
      { p_group_id: groupId },
    ]);
  });

  it("is not found without an open settle-up", async () => {
    results = [{ data: null, error: { message: "none", code: "P0002" } }];

    await expect(cancelOpenSettlement(groupId)).rejects.toThrow(NotFoundError);
  });

  it("is a conflict once a payment is marked paid", async () => {
    results = [{ data: null, error: { message: "paid", code: "P0001" } }];

    await expect(cancelOpenSettlement(groupId)).rejects.toThrow(ConflictError);
  });

  it("throws on any other database error", async () => {
    results = [{ data: null, error: { message: "boom" } }];

    await expect(cancelOpenSettlement(groupId)).rejects.toThrow("boom");
  });
});

describe("findPayment", () => {
  it("returns the payment in camelCase", async () => {
    results = [{ data: paymentRow, error: null }];

    expect(await findPayment(paymentId)).toEqual(payment);
    expect(argsOf("from")).toEqual(["payments"]);
    expect(argsOf("eq")).toEqual(["id", paymentId]);
  });

  it("returns null for an unknown payment", async () => {
    results = [{ data: null, error: null }];

    expect(await findPayment(paymentId)).toBeNull();
  });

  it("throws on a database error", async () => {
    results = [{ data: null, error: { message: "boom" } }];

    await expect(findPayment(paymentId)).rejects.toThrow("boom");
  });
});

describe("markPaymentPaid", () => {
  it("moves a suggested payment to paid and returns it", async () => {
    const paid = {
      ...paymentRow,
      status: "paid",
      paid_at: "2026-11-02T10:00:00+00:00",
    };
    results = [{ data: paid, error: null }];

    const marked = await markPaymentPaid(paymentId);

    expect(marked).toEqual({
      ...payment,
      status: "paid",
      paidAt: "2026-11-02T10:00:00+00:00",
    });
    expect(argsOf("from")).toEqual(["payments"]);
    const [changes] = argsOf("update") as [Record<string, unknown>];
    expect(changes.status).toBe("paid");
    expect(typeof changes.paid_at).toBe("string");
    expect(allArgsOf("eq")).toEqual([
      ["id", paymentId],
      ["status", "suggested"],
    ]);
  });

  it("returns null when the payment is no longer suggested", async () => {
    results = [{ data: null, error: null }];

    expect(await markPaymentPaid(paymentId)).toBeNull();
  });

  it("throws on a database error", async () => {
    results = [{ data: null, error: { message: "boom" } }];

    await expect(markPaymentPaid(paymentId)).rejects.toThrow("boom");
  });
});

describe("confirmPayment", () => {
  it("confirms through confirm_payment and says whether the period closed", async () => {
    results = [{ data: true, error: null }];

    expect(await confirmPayment(paymentId)).toBe(true);
    expect(argsOf("rpc")).toEqual([
      "confirm_payment",
      { p_payment_id: paymentId },
    ]);
  });

  it("is not found for an unknown payment", async () => {
    results = [{ data: null, error: { message: "none", code: "P0002" } }];

    await expect(confirmPayment(paymentId)).rejects.toThrow(NotFoundError);
  });

  it("is a conflict for a payment that isn't marked paid", async () => {
    results = [{ data: null, error: { message: "not paid", code: "P0001" } }];

    await expect(confirmPayment(paymentId)).rejects.toThrow(ConflictError);
  });

  it("throws on any other database error", async () => {
    results = [{ data: null, error: { message: "boom" } }];

    await expect(confirmPayment(paymentId)).rejects.toThrow("boom");
  });
});
