import { describe, expect, it } from "vitest";
import { expenseLock } from "./expense-lock";

const startedAt = "2026-11-05T12:00:00+00:00";

describe("expenseLock", () => {
  it("is settled once a settle-up has claimed the expense", () => {
    expect(
      expenseLock(
        { settled: true, createdAt: "2026-11-01T09:00:00+00:00" },
        null,
      ),
    ).toBe("settled");
  });

  it("is settle-up for an expense created on or before the open settle-up started (#86)", () => {
    expect(
      expenseLock(
        { settled: false, createdAt: "2026-11-05T11:59:59+00:00" },
        startedAt,
      ),
    ).toBe("settle-up");
    expect(
      expenseLock({ settled: false, createdAt: startedAt }, startedAt),
    ).toBe("settle-up");
  });

  it("is null for an expense created after the open settle-up started", () => {
    expect(
      expenseLock(
        { settled: false, createdAt: "2026-11-05T12:00:01+00:00" },
        startedAt,
      ),
    ).toBeNull();
  });

  it("is null for an unsettled expense with no settle-up open", () => {
    expect(
      expenseLock(
        { settled: false, createdAt: "2026-11-01T09:00:00+00:00" },
        null,
      ),
    ).toBeNull();
  });
});
