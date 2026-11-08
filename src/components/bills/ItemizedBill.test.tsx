import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Member } from "@/lib/db/group-members";
import type { ClosedPeriod } from "@/lib/db/settlements";
import type { Bill, BillLine } from "@/lib/services/bill-service";
import { ItemizedBill } from "./ItemizedBill";

const ana = "6f1c2d4e-1111-4222-8333-944455556666";
const sam = "7a2d3e5f-1111-4222-8333-944455556666";
const jo = "1a2b3c4d-3333-4444-8555-b66677778888";
const gone = "9c4f5071-1111-4222-8333-944455556666";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const octoberId = "4d5e6f7a-6666-4777-8888-e99900001111";

const members: Member[] = [
  { userId: ana, name: "Ana", defaultShareWeight: 1 },
  { userId: sam, name: "Sam", defaultShareWeight: 1 },
  { userId: jo, name: "Jo", defaultShareWeight: 1 },
];

function line(overrides: Partial<BillLine>): BillLine {
  return {
    id: "e",
    groupId,
    description: "Groceries",
    amountCents: 3001,
    payerId: sam,
    spentOn: "2026-11-02",
    settled: false,
    createdAt: "2026-11-02T18:00:00+00:00",
    editedAt: null,
    shares: [],
    shareCents: 1000,
    ...overrides,
  };
}

const october: ClosedPeriod = {
  id: octoberId,
  groupId,
  status: "closed",
  startedBy: sam,
  startedAt: "2026-10-01T09:00:00+00:00",
  closedAt: "2026-10-31T21:00:00+00:00",
  expenseCount: 4,
  paymentCount: 2,
};

function bill(overrides: Partial<Bill> = {}): Bill {
  return {
    settlementId: null,
    pastPeriods: [october],
    lines: [],
    owed: [
      { userId: sam, owedCents: 0 },
      { userId: jo, owedCents: 0 },
    ],
    ...overrides,
  };
}

function setup(
  value: Bill,
  options: { readOnly?: boolean; settleUpStartedAt?: string | null } = {},
) {
  return render(
    <ItemizedBill
      groupId={groupId}
      groupName="🏠 Flat"
      bill={value}
      members={members}
      currentUserId={ana}
      readOnly={options.readOnly ?? false}
      settleUpStartedAt={options.settleUpStartedAt ?? null}
    />,
  );
}

describe("ItemizedBill", () => {
  it("is a section titled Your bill that links can jump to", () => {
    setup(bill());

    const section = screen.getByRole("region", { name: /Your bill/ });
    expect(section).toHaveAttribute("id", "bill");
  });

  it("lists each expense with who paid, when, the total and the user's share", () => {
    setup(bill({ lines: [line({ id: "a" })] }));

    const row = screen.getByRole("listitem", { name: "Groceries" });
    expect(within(row).getByText("Sam paid · Nov 2")).toBeInTheDocument();
    expect(within(row).getByText("of $30.01")).toBeInTheDocument();
    expect(within(row).getByText("Your share")).toBeInTheDocument();
    expect(within(row).getByText("$10.00")).toHaveAttribute("data-tone", "owe");
  });

  it("says You paid on the user's own costs, and names a former member", () => {
    setup(
      bill({
        lines: [
          line({ id: "a", description: "Internet", payerId: ana }),
          line({ id: "b", description: "Pizza", payerId: gone }),
        ],
      }),
    );

    expect(
      within(screen.getByRole("listitem", { name: "Internet" })).getByText(
        "You paid · Nov 2",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("listitem", { name: "Pizza" })).getByText(
        "A former member paid · Nov 2",
      ),
    ).toBeInTheDocument();
  });

  it("leaves editing to Costs: no pencil, a lock on what the user can't change", () => {
    setup(
      bill({
        lines: [
          line({ id: "a", description: "Internet", payerId: ana }),
          line({ id: "b", description: "Groceries", payerId: sam }),
          line({
            id: "c",
            description: "Rent",
            payerId: ana,
            settled: true,
          }),
        ],
      }),
    );

    // Costs already has a pencil for Internet; a second "Edit Internet" on
    // the page would be two controls with one name.
    expect(screen.queryByRole("button")).toBeNull();
    expect(
      within(screen.getByRole("listitem", { name: "Internet" })).queryByText(
        /🔒/,
      ),
    ).toBeNull();
    expect(
      within(screen.getByRole("listitem", { name: "Groceries" })).getByText(
        "Only Sam can edit this",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("listitem", { name: "Rent" })).getByText(
        "Settled",
      ),
    ).toBeInTheDocument();
  });

  it("locks the user's costs in an open settle-up, and everything when read only", () => {
    const { unmount } = setup(
      bill({
        lines: [
          line({
            description: "Internet",
            payerId: ana,
            createdAt: "2026-11-02T18:00:00+00:00",
          }),
        ],
      }),
      { settleUpStartedAt: "2026-11-03T09:00:00+00:00" },
    );
    expect(screen.getByText("In the open settle-up")).toBeInTheDocument();
    unmount();

    setup(bill({ lines: [line({ description: "Internet", payerId: ana })] }), {
      readOnly: true,
    });
    expect(screen.getByText("Read only")).toBeInTheDocument();
  });

  it("says when the user has no costs in the period", () => {
    setup(bill());

    expect(
      screen.getByText("You aren't part of any cost in this period."),
    ).toBeInTheDocument();
  });

  it("writes one line per member, in words, and the total", () => {
    setup(
      bill({
        owed: [
          { userId: sam, owedCents: 3100 },
          { userId: jo, owedCents: -500 },
          { userId: gone, owedCents: 0 },
        ],
      }),
    );

    const owed = screen.getByRole("list", { name: "What you owe each member" });
    const rows = within(owed).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "You owe Sam $31.00",
      "Jo owes you $5.00",
      "You and a former member are even",
    ]);
    expect(within(rows[0]).getByText("$31.00")).toHaveAttribute(
      "data-tone",
      "owe",
    );
    expect(within(rows[1]).getByText("$5.00")).toHaveAttribute(
      "data-tone",
      "owed",
    );
    expect(screen.getByText(/In all,/).textContent).toBe(
      "In all, you owe $26.00",
    );
  });

  it("has a chip for this period and each past one, marking the one shown", () => {
    setup(bill());

    const chips = screen.getByRole("navigation", { name: "Bill period" });
    const current = within(chips).getByRole("link", { name: "This period" });
    expect(current).toHaveAttribute("href", `/groups/${groupId}#bill`);
    expect(current).toHaveAttribute("aria-current", "page");
    const past = within(chips).getByRole("link", { name: "Oct 1 – Oct 31" });
    expect(past).toHaveAttribute(
      "href",
      `/groups/${groupId}?period=${octoberId}#bill`,
    );
    expect(past).not.toHaveAttribute("aria-current");
  });

  it("shows a past period as settled, with its chip marked", () => {
    setup(
      bill({
        settlementId: octoberId,
        lines: [line({ settled: true })],
        owed: [
          { userId: sam, owedCents: 0 },
          { userId: jo, owedCents: 0 },
        ],
      }),
    );

    expect(
      screen.getByRole("link", { name: "Oct 1 – Oct 31" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: "This period" }),
    ).not.toHaveAttribute("aria-current");
    expect(
      screen.getByText("This period is closed: everything in it was paid."),
    ).toBeInTheDocument();
  });
});
