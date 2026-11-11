import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@/lib/http/errors";
import type { ExpenseHistoryRow } from "@/lib/services/expense-history-service";
import type { GroupSummary } from "@/lib/services/group-service";
import { ExpenseHistory } from "./ExpenseHistory";

const mocks = vi.hoisted(() => ({ listExpenseHistory: vi.fn() }));
vi.mock("@/lib/services/expense-history-service", () => ({
  listExpenseHistory: mocks.listExpenseHistory,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const ana = "6f1c2d4e-1111-4222-8333-944455556666";
const sam = "7a2d3e5f-1111-4222-8333-944455556666";
const jo = "1a2b3c4d-3333-4444-8555-b66677778888";
const flatId = "0b7e8a10-2222-4333-8444-a55566667777";
const tripId = "2c3d4e5f-2222-4333-8444-a55566667777";
const personalId = "3d4e5f6a-2222-4333-8444-a55566667777";

function group(
  id: string,
  name: string,
  memberNames: [string, string][],
  overrides: Partial<GroupSummary> = {},
): GroupSummary {
  return {
    id,
    name,
    isPersonal: false,
    archivedAt: null,
    createdAt: "2026-10-01T09:00:00+00:00",
    readOnly: false,
    leftAt: null,
    members: memberNames.map(([userId, memberName]) => ({
      userId,
      name: memberName,
      defaultShareWeight: 1,
    })),
    ...overrides,
  };
}

const groups = [
  group(personalId, "Just me", [[ana, "Ana"]], { isPersonal: true }),
  group(flatId, "🏠 Flat", [
    [ana, "Ana"],
    [sam, "Sam"],
  ]),
  group(
    tripId,
    "🏖️ Trip",
    [
      [ana, "Ana"],
      [sam, "Sam"],
      [jo, "Jo"],
    ],
    { readOnly: true, leftAt: "2026-10-25T12:00:00+00:00" },
  ),
];

function row(overrides: Partial<ExpenseHistoryRow>): ExpenseHistoryRow {
  return {
    id: "e",
    groupId: flatId,
    groupName: "🏠 Flat",
    isPersonal: false,
    description: "Groceries",
    amountCents: 4510,
    payerId: sam,
    spentOn: "2026-10-12",
    settled: false,
    createdAt: "2026-10-12T18:00:00+00:00",
    editedAt: null,
    shares: [],
    yourShareCents: 2255,
    editLock: "not-payer",
    ...overrides,
  };
}

async function setup(query: Record<string, string | string[] | undefined>) {
  return render(await ExpenseHistory({ userId: ana, groups, query }));
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.listExpenseHistory.mockResolvedValue([row({})]);
});

describe("ExpenseHistory", () => {
  it("is a section titled Your expenses that links can jump to", async () => {
    await setup({});

    const section = screen.getByRole("region", { name: /Your expenses/ });
    expect(section).toHaveAttribute("id", "expenses");
    expect(
      within(section).getByRole("form", { name: "Filter expenses" }),
    ).toHaveAttribute("action", "/#expenses");
  });

  it("asks the server for the session user's history with no filters, and lists it", async () => {
    await setup({});

    expect(mocks.listExpenseHistory).toHaveBeenCalledWith(ana, {});
    expect(
      screen.getByRole("rowheader", { name: "Groceries" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 expense matches.")).toBeInTheDocument();
  });

  it("passes the filters in the address to the server and shows them in the form", async () => {
    await setup({
      groupId: flatId,
      paidBy: sam,
      from: "2026-10-01",
      to: "2026-10-31",
    });

    expect(mocks.listExpenseHistory).toHaveBeenCalledWith(ana, {
      groupId: flatId,
      paidBy: sam,
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(screen.getByLabelText("Group")).toHaveValue(flatId);
    expect(screen.getByLabelText("Paid by")).toHaveValue(sam);
    expect(screen.getByLabelText("From")).toHaveValue("2026-10-01");
    expect(screen.getByLabelText("To")).toHaveValue("2026-10-31");
    expect(
      screen.getByText("1 expense matches these filters."),
    ).toBeInTheDocument();
  });

  it("reads an empty filter as not set, and a repeated one by its first value", async () => {
    await setup({ groupId: "", paidBy: [sam, jo], to: "" });

    expect(mocks.listExpenseHistory).toHaveBeenCalledWith(ana, {
      paidBy: sam,
    });
  });

  it("offers every group the user is or was in, and everyone in them with the user first as You, then anyone who left", async () => {
    await setup({});

    expect(
      within(screen.getByLabelText("Group"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["All groups", "Just me", "🏠 Flat", "🏖️ Trip"]);
    expect(
      within(screen.getByLabelText("Paid by"))
        .getAllByRole("option")
        .map((option) => [option.textContent, option.getAttribute("value")]),
    ).toEqual([
      ["Anyone", ""],
      ["You", ana],
      ["Jo", jo],
      ["Sam", sam],
      ["A former member", "former"],
    ]);
  });

  // Nobody can leave a personal space, so there is no former member to offer.
  it("doesn't offer a former member to a user with only a personal space", async () => {
    render(
      await ExpenseHistory({
        userId: ana,
        groups: [groups[0]],
        query: {},
      }),
    );

    expect(
      within(screen.getByLabelText("Paid by"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Anyone", "You"]);
  });

  it("filters by a former member, and keeps it chosen in the form", async () => {
    await setup({ paidBy: "former" });

    expect(mocks.listExpenseHistory).toHaveBeenCalledWith(ana, {
      paidBy: "former",
    });
    expect(screen.getByLabelText("Paid by")).toHaveValue("former");
  });

  it("gives the table each group's members, for names and the edit form", async () => {
    mocks.listExpenseHistory.mockResolvedValue([
      row({ id: "a", description: "Flights", groupId: tripId, payerId: jo }),
    ]);

    await setup({});

    const cells = within(
      screen.getByRole("rowheader", { name: "Flights" }).closest("tr")!,
    ).getAllByRole("cell");
    expect(cells[2]).toHaveTextContent("Jo");
  });

  it("says there is nothing yet when the user has no expenses", async () => {
    mocks.listExpenseHistory.mockResolvedValue([]);

    await setup({});

    expect(
      screen.getByText(
        "No expenses yet. A cost you add or share shows up here.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("No expenses match.")).toBeInTheDocument();
  });

  it("says nothing matches when the filters leave no expense", async () => {
    mocks.listExpenseHistory.mockResolvedValue([]);

    await setup({ paidBy: jo });

    expect(
      screen.getByText(
        "Nothing matches. Change or clear the filters to see more.",
      ),
    ).toBeInTheDocument();
  });

  it("shows a From after To next to To, without asking the server or showing a table", async () => {
    await setup({ from: "2026-11-02", to: "2026-11-01" });

    expect(mocks.listExpenseHistory).not.toHaveBeenCalled();
    expect(screen.getByLabelText("To")).toHaveAccessibleDescription(
      "To can't be before From.",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.getByText("Fix the highlighted filters to see your expenses."),
    ).toBeInTheDocument();
  });

  it("shows a group the user isn't in as a problem with Group, not an error page", async () => {
    mocks.listExpenseHistory.mockRejectedValue(new ForbiddenError());

    await setup({ groupId: "4e5f6a7b-2222-4333-8444-a55566667777" });

    expect(screen.getByLabelText("Group")).toHaveAccessibleDescription(
      "Choose one of your groups.",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("lets any other failure through", async () => {
    mocks.listExpenseHistory.mockRejectedValue(new Error("boom"));

    await expect(
      ExpenseHistory({ userId: ana, groups, query: {} }),
    ).rejects.toThrow("boom");
  });
});
