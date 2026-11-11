import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Expense } from "@/lib/db/expenses";
import type { Member } from "@/lib/db/group-members";
import type { ExpenseHistoryRow } from "@/lib/services/expense-history-service";
import { ExpenseTable } from "./ExpenseTable";

// The button is a Client Component with its own tests. Here it only has to
// appear on the right rows, with the right expense and its group's members.
vi.mock("./EditExpenseButton", () => ({
  EditExpenseButton: (props: {
    expense: Expense;
    groupName: string;
    members: Member[];
  }) => (
    <button type="button">
      Edit {props.expense.description} in {props.groupName} with{" "}
      {props.members.length} members
    </button>
  ),
}));

const ana = "6f1c2d4e-1111-4222-8333-944455556666";
const sam = "7a2d3e5f-1111-4222-8333-944455556666";
const gone = "9c4f5071-1111-4222-8333-944455556666";
const flatId = "0b7e8a10-2222-4333-8444-a55566667777";
const personalId = "3d4e5f6a-2222-4333-8444-a55566667777";

const membersByGroup: Record<string, Member[]> = {
  [flatId]: [
    { userId: ana, name: "Ana", defaultShareWeight: 1 },
    { userId: sam, name: "Sam", defaultShareWeight: 1 },
  ],
  [personalId]: [{ userId: ana, name: "Ana", defaultShareWeight: 1 }],
};

function row(overrides: Partial<ExpenseHistoryRow>): ExpenseHistoryRow {
  return {
    id: "e",
    groupId: flatId,
    groupName: "🏠 Flat",
    isPersonal: false,
    description: "Groceries",
    amountCents: 4510,
    payerId: ana,
    spentOn: "2026-10-12",
    settled: false,
    createdAt: "2026-10-12T18:00:00+00:00",
    editedAt: null,
    shares: [],
    yourShareCents: 2255,
    editLock: null,
    ...overrides,
  };
}

function setup(expenses: ExpenseHistoryRow[]) {
  return render(
    <ExpenseTable
      expenses={expenses}
      currentUserId={ana}
      membersByGroup={membersByGroup}
      emptyMessage="No expenses match these filters."
    />,
  );
}

function cellsOf(description: string) {
  const header = screen.getByRole("rowheader", { name: description });
  return within(header.closest("tr") as HTMLElement).getAllByRole("cell");
}

describe("ExpenseTable", () => {
  it("has the columns Date, Expense, Group, Paid by, Total, Your share and Edit", () => {
    setup([row({})]);

    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual([
      "Date",
      "Expense",
      "Group",
      "Paid by",
      "Total",
      "Your share",
      "Edit",
    ]);
  });

  it("shows each expense's day, group, payer, total and the user's share", () => {
    setup([
      row({ id: "a" }),
      row({
        id: "b",
        description: "Electricity",
        payerId: sam,
        amountCents: 3001,
        yourShareCents: 1500,
        spentOn: "2026-10-20",
        editLock: "not-payer",
      }),
    ]);

    expect(
      cellsOf("Groceries")
        .slice(0, 5)
        .map((cell) => cell.textContent),
    ).toEqual(["Oct 12", "🏠 Flat", "You", "$45.10", "$22.55"]);
    expect(
      cellsOf("Electricity")
        .slice(0, 5)
        .map((cell) => cell.textContent),
    ).toEqual(["Oct 20", "🏠 Flat", "Sam", "$30.01", "$15.00"]);
  });

  it("keeps the rows in the order the server gave them", () => {
    setup([
      row({ id: "a", description: "Newest" }),
      row({ id: "b", description: "Older" }),
    ]);

    expect(
      screen.getAllByRole("rowheader").map((header) => header.textContent),
    ).toEqual(["Newest", "Older"]);
  });

  it("names a payer who is no longer in the group's member list", () => {
    setup([row({ payerId: gone, editLock: "not-payer" })]);

    const cells = cellsOf("Groceries");
    expect(cells[2]).toHaveTextContent("A former member");
    expect(cells[5]).toHaveTextContent("Only a former member can edit this");
  });

  it("marks an edited expense", () => {
    setup([row({ editedAt: "2026-10-13T09:00:00+00:00" })]);

    expect(
      within(screen.getByRole("rowheader", { name: /Groceries/ })).getByText(
        "Edited",
      ),
    ).toBeInTheDocument();
  });

  it("shows the pencil only on an expense the user can edit, with its group's members", () => {
    setup([
      row({ id: "a", description: "Mine" }),
      row({
        id: "b",
        description: "Sams",
        payerId: sam,
        editLock: "not-payer",
      }),
      row({ id: "c", description: "Old", settled: true, editLock: "settled" }),
      row({
        id: "d",
        description: "Lunch",
        groupId: personalId,
        groupName: "Just me",
        isPersonal: true,
      }),
    ]);

    expect(
      screen.getAllByRole("button").map((button) => button.textContent),
    ).toEqual([
      "Edit Mine in 🏠 Flat with 2 members",
      "Edit Lunch in Just me with 1 members",
    ]);
  });

  it.each([
    ["settled", "Settled"],
    ["not-payer", "Only Sam can edit this"],
    ["settle-up", "In the open settle-up"],
    ["read-only", "Read only"],
    ["member-left", "Shared with someone who left"],
  ] as const)(
    "says why a %s expense is locked, in words",
    (editLock, label) => {
      setup([row({ payerId: editLock === "not-payer" ? sam : ana, editLock })]);

      expect(cellsOf("Groceries")[5]).toHaveTextContent(label);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    },
  );

  it("explains the pencil and the lock in a legend under the table", () => {
    setup([row({})]);

    expect(
      screen.getByText(
        /You paid it and it isn't settled, so you can edit it\./,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Someone else paid\s+it, or it is settled/),
    ).toBeInTheDocument();
  });

  it("is a labelled region that a keyboard can reach to scroll it", () => {
    setup([row({})]);

    const region = screen.getByRole("region", { name: "Expenses table" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(within(region).getByRole("table")).toHaveAccessibleName(
      "The expenses you share, newest first",
    );
  });

  it("says so instead of an empty table when there is nothing to list", () => {
    setup([]);

    expect(
      screen.getByText("No expenses match these filters."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
