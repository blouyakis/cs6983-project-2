import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Expense } from "@/lib/db/expenses";
import type { Member } from "@/lib/db/group-members";
import { ExpenseList } from "./ExpenseList";

// The button is a Client Component with its own tests. Here it only has to
// appear on the right rows, with the right expense.
vi.mock("./EditExpenseButton", () => ({
  EditExpenseButton: (props: { expense: Expense }) => (
    <button type="button">Edit {props.expense.description}</button>
  ),
}));

const ana = "6f1c2d4e-1111-4222-8333-944455556666";
const sam = "7a2d3e5f-1111-4222-8333-944455556666";
const gone = "9c4f5071-1111-4222-8333-944455556666";

const members: Member[] = [
  { userId: ana, name: "Ana", defaultShareWeight: 1 },
  { userId: sam, name: "Sam", defaultShareWeight: 1 },
];

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: "e",
    groupId: "g",
    description: "Groceries",
    amountCents: 4510,
    payerId: ana,
    spentOn: "2026-10-12",
    settled: false,
    createdAt: "2026-10-12T18:00:00+00:00",
    editedAt: null,
    shares: [],
    ...overrides,
  };
}

function setup(
  expenses: Expense[],
  readOnly = false,
  settleUpStartedAt: string | null = null,
) {
  return render(
    <ExpenseList
      expenses={expenses}
      members={members}
      currentUserId={ana}
      settleUpStartedAt={settleUpStartedAt}
      groupName="🏠 Flat"
      readOnly={readOnly}
    />,
  );
}

describe("ExpenseList", () => {
  it("is titled Costs and lists each expense with its amount, who paid and the day", () => {
    setup([
      expense({ id: "a" }),
      expense({
        id: "b",
        description: "Internet",
        amountCents: 3000,
        payerId: sam,
        spentOn: "2026-10-15",
      }),
    ]);

    expect(screen.getByRole("heading", { name: "Costs" })).toBeInTheDocument();
    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Groceries");
    expect(rows[0]).toHaveTextContent("$45.10");
    expect(rows[0]).toHaveTextContent("You paid · Oct 12");
    expect(rows[1]).toHaveTextContent("Sam paid · Oct 15");
  });

  it("says when there are no costs yet", () => {
    setup([]);

    expect(screen.getByText(/No costs yet/)).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("offers Edit only on the user's own unsettled expenses", () => {
    setup([
      expense({ id: "mine" }),
      expense({ id: "theirs", description: "Internet", payerId: sam }),
      expense({ id: "done", description: "Rent", settled: true }),
    ]);

    expect(
      screen.getByRole("button", { name: "Edit Groceries" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Internet" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit Rent" })).toBeNull();
  });

  it("marks the rest with a lock that says why", () => {
    setup([
      expense({ id: "theirs", description: "Internet", payerId: sam }),
      expense({ id: "done", description: "Rent", settled: true }),
    ]);

    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(
      within(rows[0]).getByText("Only Sam can edit this"),
    ).toBeInTheDocument();
    expect(within(rows[1]).getByText("Settled")).toBeInTheDocument();
  });

  it("locks the user's own expenses that are in an open settle-up, and says so (#86)", () => {
    setup(
      [
        expense({ id: "before", description: "Rent" }),
        expense({
          id: "after",
          description: "Pizza",
          createdAt: "2026-10-13T10:00:00+00:00",
        }),
      ],
      false,
      "2026-10-12T20:00:00+00:00",
    );

    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(within(rows[0]).queryByRole("button")).toBeNull();
    expect(
      within(rows[0]).getByText("In the open settle-up"),
    ).toBeInTheDocument();
    expect(
      within(rows[1]).getByRole("button", { name: /Edit Pizza/ }),
    ).toBeInTheDocument();
  });

  it("locks the user's own expense while someone who has left has a share in it, and says so (#22)", () => {
    setup([
      expense({
        id: "a",
        shares: [
          { userId: ana, shareCents: 2255 },
          { userId: gone, shareCents: 2255 },
        ],
      }),
      expense({
        id: "b",
        description: "Pizza",
        shares: [
          { userId: ana, shareCents: 4510 },
          { userId: gone, shareCents: 0 },
        ],
      }),
    ]);

    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(within(rows[0]).queryByRole("button")).toBeNull();
    expect(
      within(rows[0]).getByText("Shared with someone who left"),
    ).toBeInTheDocument();
    // A zero share doesn't count: deleting or editing it changes no balance.
    expect(
      within(rows[1]).getByRole("button", { name: /Edit Pizza/ }),
    ).toBeInTheDocument();
  });

  it("offers no Edit in a read-only group, even on the user's own", () => {
    setup([expense({ id: "mine" })], true);

    expect(screen.queryByRole("button", { name: /Edit/ })).toBeNull();
  });

  it("shows an Edited badge on an expense that was edited", () => {
    setup([
      expense({ id: "a", editedAt: "2026-10-13T09:00:00+00:00" }),
      expense({ id: "b", description: "Internet" }),
    ]);

    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(within(rows[0]).getByText("Edited")).toBeInTheDocument();
    expect(within(rows[1]).queryByText("Edited")).toBeNull();
  });

  it("names a payer who has since left the group", () => {
    setup([expense({ payerId: gone })]);

    expect(screen.getByText(/A former member paid/)).toBeInTheDocument();
  });
});
