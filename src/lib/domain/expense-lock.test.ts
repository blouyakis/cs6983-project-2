import { describe, expect, it } from "vitest";
import { expenseLock } from "./expense-lock";

const startedAt = "2026-11-05T12:00:00+00:00";
const ana = "6f1c2d4e-1111-4222-8333-944455556666";
const ren = "7a2d3e5f-1111-4222-8333-944455556666";

// Ana and Ren are both still in the group unless a test says otherwise.
const bothCurrent = new Set([ana, ren]);
const shared = [
  { userId: ana, shareCents: 500 },
  { userId: ren, shareCents: 500 },
];

describe("expenseLock", () => {
  it("is settled once a settle-up has claimed the expense", () => {
    expect(
      expenseLock(
        {
          settled: true,
          createdAt: "2026-11-01T09:00:00+00:00",
          shares: shared,
        },
        null,
        bothCurrent,
      ),
    ).toBe("settled");
  });

  it("is settle-up for an expense created on or before the open settle-up started (#86)", () => {
    expect(
      expenseLock(
        {
          settled: false,
          createdAt: "2026-11-05T11:59:59+00:00",
          shares: shared,
        },
        startedAt,
        bothCurrent,
      ),
    ).toBe("settle-up");
    expect(
      expenseLock(
        { settled: false, createdAt: startedAt, shares: shared },
        startedAt,
        bothCurrent,
      ),
    ).toBe("settle-up");
  });

  it("is null for an expense created after the open settle-up started", () => {
    expect(
      expenseLock(
        {
          settled: false,
          createdAt: "2026-11-05T12:00:01+00:00",
          shares: shared,
        },
        startedAt,
        bothCurrent,
      ),
    ).toBeNull();
  });

  it("is null for an unsettled expense with no settle-up open", () => {
    expect(
      expenseLock(
        {
          settled: false,
          createdAt: "2026-11-01T09:00:00+00:00",
          shares: shared,
        },
        null,
        bothCurrent,
      ),
    ).toBeNull();
  });

  it("is member-left while someone who has left has a share in it (#22)", () => {
    expect(
      expenseLock(
        {
          settled: false,
          createdAt: "2026-11-01T09:00:00+00:00",
          shares: shared,
        },
        null,
        new Set([ana]),
      ),
    ).toBe("member-left");
  });

  it("is null when the share of someone who has left is zero", () => {
    expect(
      expenseLock(
        {
          settled: false,
          createdAt: "2026-11-01T09:00:00+00:00",
          shares: [
            { userId: ana, shareCents: 1000 },
            { userId: ren, shareCents: 0 },
          ],
        },
        null,
        new Set([ana]),
      ),
    ).toBeNull();
  });

  it("says settled or settle-up first, since those last longer than a member's absence", () => {
    const gone = new Set([ana]);
    expect(
      expenseLock(
        {
          settled: true,
          createdAt: "2026-11-01T09:00:00+00:00",
          shares: shared,
        },
        null,
        gone,
      ),
    ).toBe("settled");
    expect(
      expenseLock(
        {
          settled: false,
          createdAt: "2026-11-01T09:00:00+00:00",
          shares: shared,
        },
        startedAt,
        gone,
      ),
    ).toBe("settle-up");
  });
});
