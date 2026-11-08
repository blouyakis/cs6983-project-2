import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError } from "@/lib/http/errors";
import type { GroupDetails, GroupSummary } from "@/lib/services/group-service";
import { GroupDetail } from "./GroupDetail";

const mocks = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  getGroup: vi.fn(),
  listGroups: vi.fn(),
  getGroupBalances: vi.fn(),
  getCurrentSettleUp: vi.fn(),
  listGroupListItems: vi.fn(),
  listGroupExpenses: vi.fn(),
  listPayments: vi.fn(),
  getMyBill: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));
vi.mock("@/lib/auth/cookies", () => ({
  getSessionUserId: mocks.getSessionUserId,
}));
vi.mock("@/lib/services/group-service", () => ({
  getGroup: mocks.getGroup,
  listGroups: mocks.listGroups,
}));
vi.mock("@/lib/services/balance-service", () => ({
  getGroupBalances: mocks.getGroupBalances,
}));
vi.mock("@/lib/services/settlement-service", () => ({
  getCurrentSettleUp: mocks.getCurrentSettleUp,
}));
vi.mock("@/lib/services/list-item-service", () => ({
  listGroupListItems: mocks.listGroupListItems,
}));
// The list is a Client Component with its own tests. Here it only has to be
// given the right items, names and groups.
vi.mock("@/components/lists/GroupList", () => ({
  GroupList: (props: object) => (
    <div data-testid="group-list" data-props={JSON.stringify(props)} />
  ),
}));
vi.mock("@/components/ui/NoticeProvider", () => ({
  NoticeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="notice-provider">{children}</div>
  ),
  NoticeLine: () => <p data-testid="notice-line" />,
}));
vi.mock("@/lib/services/expense-service", () => ({
  listGroupExpenses: mocks.listGroupExpenses,
}));
// The list has its own tests. Here it only has to be given the expenses.
vi.mock("@/components/expenses/ExpenseList", () => ({
  ExpenseList: (props: object) => (
    <div data-testid="expense-list" data-props={JSON.stringify(props)} />
  ),
}));
// The button is a Client Component with its own tests. Here it only has to be
// given the right groups.
vi.mock("@/components/expenses/AddExpenseButton", () => ({
  AddExpenseButton: (props: object) => (
    <div data-testid="add-expense" data-props={JSON.stringify(props)} />
  ),
}));
vi.mock("@/lib/services/payment-service", () => ({
  listPayments: mocks.listPayments,
}));
// The payment list is a Client Component with its own tests (#14).
vi.mock("@/components/payments/PaymentHistory", () => ({
  PaymentHistory: (props: object) => (
    <div data-testid="payment-history" data-props={JSON.stringify(props)} />
  ),
}));
vi.mock("@/lib/services/bill-service", () => ({
  getMyBill: mocks.getMyBill,
}));
// The bill has its own tests (#21). Here it only has to be given the bill.
vi.mock("@/components/bills/ItemizedBill", () => ({
  ItemizedBill: (props: object) => (
    <div data-testid="itemized-bill" data-props={JSON.stringify(props)} />
  ),
}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
  useRouter: () => ({ refresh: vi.fn() }),
}));

const anaId = "6f1c2d4e-1111-4222-8333-944455556666";
const samId = "7a2d3e5f-1111-4222-8333-944455556666";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";

function details(overrides: Partial<GroupDetails> = {}): GroupDetails {
  return {
    id: groupId,
    name: "🏠 Dorm 4B",
    isPersonal: false,
    archivedAt: null,
    createdAt: "2026-10-01T09:00:00+00:00",
    readOnly: false,
    members: [
      { userId: anaId, name: "Ana", defaultShareWeight: 1 },
      {
        userId: "7a2d3e5f-1111-4222-8333-944455556666",
        name: "Sam",
        defaultShareWeight: 1,
      },
    ],
    ...overrides,
  };
}

function summary(overrides: Partial<GroupSummary> = {}): GroupSummary {
  return { ...details(), leftAt: null, ...overrides };
}

function addExpenseProps() {
  return JSON.parse(
    screen.getByTestId("add-expense").getAttribute("data-props") ?? "{}",
  );
}

function groupListProps() {
  return JSON.parse(
    screen.getByTestId("group-list").getAttribute("data-props") ?? "{}",
  );
}

function detail(id = groupId, search: { period?: string | string[] } = {}) {
  return GroupDetail({
    params: Promise.resolve({ groupId: id }),
    searchParams: Promise.resolve(search),
  });
}

const octoberId = "4d5e6f7a-6666-4777-8888-e99900001111";
const emptyBill = { settlementId: null, pastPeriods: [], lines: [], owed: [] };

function billProps() {
  return JSON.parse(
    screen.getByTestId("itemized-bill").getAttribute("data-props") ?? "{}",
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.redirect.mockImplementation((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`);
  });
  mocks.notFound.mockImplementation(() => {
    throw new Error("NEXT_NOT_FOUND");
  });
  mocks.getSessionUserId.mockResolvedValue(anaId);
  mocks.listGroups.mockResolvedValue([]);
  mocks.getGroupBalances.mockResolvedValue([]);
  mocks.getCurrentSettleUp.mockRejectedValue(new NotFoundError("none"));
  mocks.listGroupListItems.mockResolvedValue([]);
  mocks.listGroupExpenses.mockResolvedValue([]);
  mocks.listPayments.mockResolvedValue([]);
  mocks.getMyBill.mockResolvedValue(emptyBill);
});

function expenseListProps() {
  return JSON.parse(
    screen.getByTestId("expense-list").getAttribute("data-props") ?? "{}",
  );
}

describe("GroupDetail", () => {
  it("shows each member's balance in words on the group page (#9)", async () => {
    mocks.getGroup.mockResolvedValue(details());
    mocks.getGroupBalances.mockResolvedValue([
      { userId: anaId, balanceCents: -883 },
      { userId: samId, balanceCents: 883 },
    ]);

    render(await detail());

    expect(mocks.getGroupBalances).toHaveBeenCalledWith(anaId, groupId);
    // MoneyText puts the amount in its own element, so match the row's text.
    const rows = screen.getAllByRole("listitem").map((row) => row.textContent);
    expect(rows).toContainEqual(expect.stringContaining("You owe $8.83"));
    expect(rows).toContainEqual(expect.stringContaining("Sam is owed $8.83"));
  });

  it("asks for no balances in the personal space, which has nothing to split", async () => {
    mocks.getGroup.mockResolvedValue(
      details({ name: "Personal space", isPersonal: true }),
    );

    render(await detail());

    expect(mocks.getGroupBalances).not.toHaveBeenCalled();
  });

  it("lists the group's costs, with what the edit form needs (#20)", async () => {
    mocks.getGroup.mockResolvedValue(details());
    const groceries = { id: "e", description: "Groceries" };
    mocks.listGroupExpenses.mockResolvedValue([groceries]);

    render(await detail());

    expect(mocks.listGroupExpenses).toHaveBeenCalledWith(anaId, groupId);
    expect(expenseListProps()).toMatchObject({
      expenses: [groceries],
      members: details().members,
      currentUserId: anaId,
      groupName: "🏠 Dorm 4B",
      readOnly: false,
    });
  });

  it("tells the list when the group is read-only, so nothing offers an edit", async () => {
    mocks.getGroup.mockResolvedValue(
      details({ readOnly: true, archivedAt: "2026-10-20T00:00:00+00:00" }),
    );

    render(await detail());

    expect(expenseListProps().readOnly).toBe(true);
  });

  it("shows the group's name, its members and the invite form", async () => {
    mocks.getGroup.mockResolvedValue(details());

    render(await detail());

    expect(mocks.getGroup).toHaveBeenCalledWith(anaId, groupId);
    expect(
      screen.getByRole("heading", { level: 1, name: "🏠 Dorm 4B" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ana (you)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Invite" })).toBeInTheDocument();
  });

  it("links to the group's settle-up page (#19)", async () => {
    mocks.getGroup.mockResolvedValue(details());

    render(await detail());

    expect(
      screen.getByRole("link", { name: "Settle up 🏠 Dorm 4B" }),
    ).toHaveAttribute("href", `/groups/${groupId}/settle-up`);
  });

  it("has no settle-up link in the personal space, which has nothing to settle", async () => {
    mocks.getGroup.mockResolvedValue(
      details({ name: "Personal space", isPersonal: true }),
    );

    render(await detail());

    expect(
      screen.queryByRole("link", { name: /Settle up/ }),
    ).not.toBeInTheDocument();
  });

  it("has no invite form in the personal space", async () => {
    mocks.getGroup.mockResolvedValue(
      details({ name: "Personal space", isPersonal: true }),
    );

    render(await detail());

    expect(
      screen.queryByRole("button", { name: "Invite" }),
    ).not.toBeInTheDocument();
  });

  it("has no invite form and says so when the group is read-only", async () => {
    mocks.getGroup.mockResolvedValue(details({ readOnly: true }));

    render(await detail());

    expect(
      screen.queryByRole("button", { name: "Invite" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Read only")).toBeInTheDocument();
  });

  it("offers to log a cost in this group, and in the other groups the user can add to", async () => {
    const trip = summary({
      id: "1c8f9b21-2222-4333-8444-a55566667777",
      name: "✈️ Trip",
    });
    const left = summary({
      id: "2d90ac32-2222-4333-8444-a55566667777",
      name: "Old flat",
      readOnly: true,
      leftAt: "2026-09-02T10:00:00+00:00",
    });
    mocks.getGroup.mockResolvedValue(details());
    mocks.listGroups.mockResolvedValue([summary(), trip, left]);

    render(await detail());

    expect(mocks.listGroups).toHaveBeenCalledWith(anaId);
    const props = addExpenseProps();
    expect(props.currentUserId).toBe(anaId);
    expect(props.defaultGroupId).toBe(groupId);
    expect(props.groups.map((group: { id: string }) => group.id)).toEqual([
      groupId,
      trip.id,
    ]);
    expect(props.groups[0]).toEqual({
      id: groupId,
      name: "🏠 Dorm 4B",
      isPersonal: false,
      members: details().members,
    });
  });

  it("offers it in the personal space too", async () => {
    mocks.getGroup.mockResolvedValue(
      details({ name: "Personal space", isPersonal: true }),
    );
    mocks.listGroups.mockResolvedValue([
      summary({ name: "Personal space", isPersonal: true }),
    ]);

    render(await detail());

    expect(addExpenseProps().groups[0].isPersonal).toBe(true);
  });

  it("does not offer it when the group is read-only", async () => {
    mocks.getGroup.mockResolvedValue(details({ readOnly: true }));

    render(await detail());

    expect(screen.queryByTestId("add-expense")).not.toBeInTheDocument();
  });

  it("shows not found for a group the user can't see, without saying it exists", async () => {
    mocks.getGroup.mockRejectedValue(new ForbiddenError());

    await expect(detail()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("shows not found for an id that is not a UUID, without asking the service", async () => {
    await expect(detail("nope")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.getGroup).not.toHaveBeenCalled();
  });

  it("sends a visitor without a session to login", async () => {
    mocks.getSessionUserId.mockResolvedValue(null);

    await expect(detail()).rejects.toThrow("NEXT_REDIRECT /login");
  });

  it("tells the cost list when a settle-up is open, so its costs show as locked (#86)", async () => {
    mocks.getGroup.mockResolvedValue(details());
    mocks.getCurrentSettleUp.mockResolvedValue({
      id: "s",
      status: "open",
      startedAt: "2026-11-01T10:00:00+00:00",
      payments: [],
    });

    render(await detail());

    expect(mocks.getCurrentSettleUp).toHaveBeenCalledWith(anaId, groupId);
    expect(expenseListProps().settleUpStartedAt).toBe(
      "2026-11-01T10:00:00+00:00",
    );
  });

  it("gives the cost list no settle-up when none is open, or in the personal space", async () => {
    mocks.getGroup.mockResolvedValue(details());
    render(await detail());
    expect(expenseListProps().settleUpStartedAt).toBeNull();

    mocks.getCurrentSettleUp.mockClear();
    mocks.getGroup.mockResolvedValue(
      details({ name: "Personal space", isPersonal: true }),
    );
    render(await detail());
    expect(mocks.getCurrentSettleUp).not.toHaveBeenCalled();
  });

  it("does not hide other failures behind not found", async () => {
    mocks.getGroup.mockRejectedValue(new Error("database down"));

    await expect(detail()).rejects.toThrow("database down");
  });

  describe("the list", () => {
    const milk = {
      id: "1d5a6182-3333-4444-8555-b66677778888",
      groupId,
      title: "Milk",
      quantity: null,
      note: null,
      estimatedCents: 450,
      status: "open",
      addedBy: samId,
      completedBy: null,
      completedAt: null,
      expenseId: null,
      createdAt: "2026-11-04T18:00:00+00:00",
    };

    it("shows the group's items, with the members' names for who added each", async () => {
      mocks.getGroup.mockResolvedValue(details());
      mocks.listGroupListItems.mockResolvedValue([milk]);

      render(await detail());

      expect(mocks.listGroupListItems).toHaveBeenCalledWith(anaId, groupId);
      expect(groupListProps()).toMatchObject({
        groupId,
        isPersonal: false,
        readOnly: false,
        items: [milk],
        names: { [anaId]: "Ana", [samId]: "Sam" },
        currentUserId: anaId,
      });
    });

    it("lets the list add to this group and the other groups the user can add to", async () => {
      mocks.getGroup.mockResolvedValue(details());
      mocks.listGroups.mockResolvedValue([
        summary(),
        summary({ id: "left", name: "Old flat", readOnly: true }),
      ]);

      render(await detail());

      expect(
        groupListProps().entryGroups.map((g: { id: string }) => g.id),
      ).toEqual([groupId]);
    });

    it("shows the list in the personal space too", async () => {
      mocks.getGroup.mockResolvedValue(
        details({ name: "Personal space", isPersonal: true }),
      );

      render(await detail());

      expect(groupListProps()).toMatchObject({ isPersonal: true });
    });

    it("gives the personal list what was spent there this month (#23)", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
      mocks.getGroup.mockResolvedValue(
        details({ name: "Personal space", isPersonal: true }),
      );
      mocks.listGroupExpenses.mockResolvedValue([
        { id: "a", amountCents: 400, spentOn: "2026-11-02" },
        { id: "b", amountCents: 900, spentOn: "2026-10-28" },
      ]);

      try {
        render(await detail());
      } finally {
        vi.useRealTimers();
      }

      expect(groupListProps()).toMatchObject({ spentThisMonthCents: 400 });
    });

    it("gives a shared group's list no spent this month", async () => {
      mocks.getGroup.mockResolvedValue(details());
      mocks.listGroupExpenses.mockResolvedValue([
        { id: "a", amountCents: 400, spentOn: "2026-11-02" },
      ]);

      render(await detail());

      expect(groupListProps()).toMatchObject({ spentThisMonthCents: null });
    });

    it("shows a read-only group's list as read-only", async () => {
      mocks.getGroup.mockResolvedValue(details({ readOnly: true }));

      render(await detail());

      expect(groupListProps()).toMatchObject({
        readOnly: true,
        entryGroups: [],
      });
    });
  });

  it("shows every notice in one place, right above the list", async () => {
    mocks.getGroup.mockResolvedValue(details());

    render(await detail());

    const provider = screen.getByTestId("notice-provider");
    const line = screen.getByTestId("notice-line");
    expect(provider).toContainElement(screen.getByTestId("add-expense"));
    expect(provider).toContainElement(screen.getByTestId("group-list"));
    expect(line.nextElementSibling).toBe(screen.getByTestId("group-list"));
  });

  describe("the payments (#14)", () => {
    function paymentHistoryProps() {
      return JSON.parse(
        screen.getByTestId("payment-history").getAttribute("data-props") ??
          "{}",
      );
    }

    it("lists the group's payments with the members' names", async () => {
      const payments = [{ id: "p1", status: "paid" }];
      mocks.getGroup.mockResolvedValue(details());
      mocks.listPayments.mockResolvedValue(payments);

      render(await detail());

      expect(mocks.listPayments).toHaveBeenCalledWith(anaId, groupId);
      expect(paymentHistoryProps()).toEqual({
        groupId,
        payments,
        names: { [anaId]: "Ana", [samId]: "Sam" },
        currentUserId: anaId,
        readOnly: false,
      });
    });

    it("shows a read-only group's payments as read-only", async () => {
      mocks.getGroup.mockResolvedValue(details({ readOnly: true }));

      render(await detail());

      expect(paymentHistoryProps().readOnly).toBe(true);
    });

    it("has no payments in the personal space", async () => {
      mocks.getGroup.mockResolvedValue(details({ isPersonal: true }));

      render(await detail());

      expect(mocks.listPayments).not.toHaveBeenCalled();
      expect(screen.queryByTestId("payment-history")).toBeNull();
    });
  });

  describe("the itemized bill (#21)", () => {
    it("shows the user's bill for the current period", async () => {
      mocks.getGroup.mockResolvedValue(details());

      render(await detail());

      expect(mocks.getMyBill).toHaveBeenCalledWith(anaId, groupId, null);
      expect(billProps()).toMatchObject({
        groupId,
        bill: emptyBill,
        currentUserId: anaId,
        readOnly: false,
        settleUpStartedAt: null,
      });
    });

    it("shows a past period picked with ?period=", async () => {
      mocks.getGroup.mockResolvedValue(details());

      render(await detail(groupId, { period: octoberId }));

      expect(mocks.getMyBill).toHaveBeenCalledWith(anaId, groupId, octoberId);
    });

    it("shows the current period for a ?period= that isn't an id", async () => {
      mocks.getGroup.mockResolvedValue(details());

      render(await detail(groupId, { period: ["a", "b"] }));
      expect(mocks.getMyBill).toHaveBeenLastCalledWith(anaId, groupId, null);
    });

    it("falls back to the current period when the one asked for isn't there", async () => {
      mocks.getGroup.mockResolvedValue(details());
      mocks.getMyBill.mockImplementation(
        async (_user: string, _group: string, period: string | null) => {
          if (period !== null) {
            throw new NotFoundError("This period doesn't exist.");
          }
          return emptyBill;
        },
      );

      render(await detail(groupId, { period: octoberId }));

      expect(mocks.getMyBill).toHaveBeenLastCalledWith(anaId, groupId, null);
      expect(billProps().bill).toEqual(emptyBill);
    });

    it("has no bill in the personal space, which has nothing to split", async () => {
      mocks.getGroup.mockResolvedValue(
        details({ name: "Personal space", isPersonal: true }),
      );

      render(await detail());

      expect(mocks.getMyBill).not.toHaveBeenCalled();
      expect(screen.queryByTestId("itemized-bill")).toBeNull();
    });
  });
});
