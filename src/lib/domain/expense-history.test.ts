import { describe, expect, it } from "vitest";
import { expenseHistory, type GroupExpenses } from "./expense-history";

const ana = "6f1c2d4e-1111-4222-8333-944455556666";
const sam = "7a2d3e5f-1111-4222-8333-944455556666";
const jo = "1a2b3c4d-3333-4444-8555-b66677778888";

type TestExpense = GroupExpenses<{
  id: string;
  description: string;
  payerId: string;
  spentOn: string;
  settled: boolean;
  createdAt: string;
  shares: { userId: string; shareCents: number }[];
}>["expenses"][number];

function expense(
  id: string,
  payerId: string,
  shares: [string, number][],
  overrides: Partial<TestExpense> = {},
): TestExpense {
  return {
    id,
    description: `Cost ${id}`,
    payerId,
    spentOn: "2026-11-02",
    settled: false,
    createdAt: "2026-11-02T10:00:00+00:00",
    shares: shares.map(([userId, shareCents]) => ({ userId, shareCents })),
    ...overrides,
  };
}

function group(
  expenses: TestExpense[],
  overrides: Partial<GroupExpenses<TestExpense>> = {},
): GroupExpenses<TestExpense> {
  return {
    groupId: "0b7e8a10-2222-4333-8444-a55566667777",
    groupName: "Flat",
    isPersonal: false,
    readOnly: false,
    openSettleUpStartedAt: null,
    currentMemberIds: new Set([ana, sam, jo]),
    expenses,
    ...overrides,
  };
}

describe("expenseHistory", () => {
  it("is empty with no groups, or groups with no expenses", () => {
    expect(expenseHistory(ana, [])).toEqual([]);
    expect(expenseHistory(ana, [group([])])).toEqual([]);
  });

  it("gives each row its group and the user's share", () => {
    const rows = expenseHistory(ana, [
      group([
        expense("a", sam, [
          [sam, 1001],
          [ana, 1000],
        ]),
      ]),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "a",
      description: "Cost a",
      groupName: "Flat",
      isPersonal: false,
      yourShareCents: 1000,
    });
  });

  it("leaves out an expense in the user's group that they don't share", () => {
    const rows = expenseHistory(ana, [
      group([
        expense("others", sam, [
          [sam, 500],
          [jo, 500],
        ]),
        expense("mine", sam, [
          [sam, 500],
          [ana, 500],
        ]),
      ]),
    ]);

    expect(rows.map((row) => row.id)).toEqual(["mine"]);
  });

  it("keeps a cost the user paid only for others, with their share of 0", () => {
    const rows = expenseHistory(ana, [
      group([
        expense("treat", ana, [
          [ana, 0],
          [sam, 501],
          [jo, 500],
        ]),
      ]),
    ]);

    expect(rows[0].yourShareCents).toBe(0);
  });

  it("puts the expenses of every group in one list, newest day first, then newest entry first", () => {
    const flat = group([
      expense("flat-old", ana, [[ana, 100]], { spentOn: "2026-10-30" }),
      expense("flat-new", ana, [[ana, 100]], {
        spentOn: "2026-11-02",
        createdAt: "2026-11-02T09:00:00+00:00",
      }),
    ]);
    const personal = group(
      [
        expense("me-middle", ana, [[ana, 100]], { spentOn: "2026-11-01" }),
        expense("me-newest", ana, [[ana, 100]], {
          spentOn: "2026-11-02",
          createdAt: "2026-11-02T12:00:00+00:00",
        }),
      ],
      { groupName: "Just me", isPersonal: true },
    );

    const rows = expenseHistory(ana, [flat, personal]);

    expect(rows.map((row) => row.id)).toEqual([
      "me-newest",
      "flat-new",
      "me-middle",
      "flat-old",
    ]);
    expect(rows[0]).toMatchObject({ groupName: "Just me", isPersonal: true });
    // The order doesn't depend on which group was read first.
    expect(expenseHistory(ana, [personal, flat])).toEqual(rows);
  });

  it("orders two entries from the same moment by id, whichever group came first", () => {
    const first = group([expense("b", ana, [[ana, 100]])]);
    const second = group([expense("a", ana, [[ana, 100]])]);

    expect(expenseHistory(ana, [first, second]).map((row) => row.id)).toEqual([
      "a",
      "b",
    ]);
    expect(expenseHistory(ana, [second, first]).map((row) => row.id)).toEqual([
      "a",
      "b",
    ]);
  });

  describe("the Edit column", () => {
    const shared: [string, number][] = [
      [ana, 500],
      [sam, 500],
    ];

    it("is a pencil on an unsettled expense the user paid", () => {
      const [row] = expenseHistory(ana, [group([expense("a", ana, shared)])]);

      expect(row.editLock).toBeNull();
    });

    it("is locked on an expense someone else paid", () => {
      const [row] = expenseHistory(ana, [group([expense("a", sam, shared)])]);

      expect(row.editLock).toBe("not-payer");
    });

    it("is locked as settled once a settle-up has claimed it, whoever paid", () => {
      const rows = expenseHistory(ana, [
        group([
          expense("mine", ana, shared, { settled: true }),
          expense("sams", sam, shared, { settled: true }),
        ]),
      ]);

      expect(rows.map((row) => row.editLock)).toEqual(["settled", "settled"]);
    });

    it("is locked while the expense is in the group's open settle-up", () => {
      const rows = expenseHistory(ana, [
        group(
          [
            expense("before", ana, shared, {
              createdAt: "2026-11-02T10:00:00+00:00",
            }),
            expense("after", ana, shared, {
              createdAt: "2026-11-02T12:00:00+00:00",
            }),
          ],
          { openSettleUpStartedAt: "2026-11-02T11:00:00+00:00" },
        ),
      ]);

      expect(rows.map((row) => [row.id, row.editLock])).toEqual([
        ["after", null],
        ["before", "settle-up"],
      ]);
    });

    it("says someone else paid before it says the settle-up is open", () => {
      const [row] = expenseHistory(ana, [
        group([expense("a", sam, shared)], {
          openSettleUpStartedAt: "2026-11-03T00:00:00+00:00",
        }),
      ]);

      expect(row.editLock).toBe("not-payer");
    });

    it("is locked in a group the user left or that is archived", () => {
      const [row] = expenseHistory(ana, [
        group([expense("a", ana, shared)], { readOnly: true }),
      ]);

      expect(row.editLock).toBe("read-only");
    });

    // Someone who has left keeps the balance they left with, so a cost they
    // share can't change until a settle-up claims it (#22).
    it("is locked while someone who has left shares it", () => {
      const rows = expenseHistory(ana, [
        group(
          [
            expense("with-jo", ana, [
              [ana, 500],
              [jo, 500],
            ]),
            expense("jo-at-zero", ana, [
              [ana, 1000],
              [jo, 0],
            ]),
          ],
          { currentMemberIds: new Set([ana, sam]) },
        ),
      ]);

      expect(rows.map((row) => [row.id, row.editLock])).toEqual([
        ["jo-at-zero", null],
        ["with-jo", "member-left"],
      ]);
    });

    it("says a group is read-only before it says someone left", () => {
      const [row] = expenseHistory(ana, [
        group(
          [
            expense("a", ana, [
              [ana, 500],
              [jo, 500],
            ]),
          ],
          { readOnly: true, currentMemberIds: new Set([ana, sam]) },
        ),
      ]);

      expect(row.editLock).toBe("read-only");
    });
  });
});
