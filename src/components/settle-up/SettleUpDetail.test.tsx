import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError } from "@/lib/http/errors";
import type { GroupDetails } from "@/lib/services/group-service";
import { SettleUpDetail } from "./SettleUpDetail";

const mocks = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  getGroup: vi.fn(),
  getGroupBalances: vi.fn(),
  listGroupExpenses: vi.fn(),
  getCurrentSettleUp: vi.fn(),
  listPastPeriods: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));
vi.mock("@/lib/auth/cookies", () => ({
  getSessionUserId: mocks.getSessionUserId,
}));
vi.mock("@/lib/services/group-service", () => ({ getGroup: mocks.getGroup }));
vi.mock("@/lib/services/balance-service", () => ({
  getGroupBalances: mocks.getGroupBalances,
}));
vi.mock("@/lib/services/expense-service", () => ({
  listGroupExpenses: mocks.listGroupExpenses,
}));
vi.mock("@/lib/services/settlement-service", () => ({
  getCurrentSettleUp: mocks.getCurrentSettleUp,
  listPastPeriods: mocks.listPastPeriods,
}));
// The panel is a Client Component with its own tests. Here it only has to
// be given the right settle-up, names and flags.
vi.mock("./SettleUpPanel", () => ({
  SettleUpPanel: (props: object) => (
    <div data-testid="panel" data-props={JSON.stringify(props)} />
  ),
}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
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
      { userId: samId, name: "Sam", defaultShareWeight: 1 },
    ],
    ...overrides,
  };
}

function expense(settled: boolean) {
  return { id: `e-${Math.random()}`, settled };
}

function panelProps() {
  return JSON.parse(
    screen.getByTestId("panel").getAttribute("data-props") ?? "{}",
  );
}

function detail(id = groupId) {
  return SettleUpDetail({ params: Promise.resolve({ groupId: id }) });
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
  mocks.getGroup.mockResolvedValue(details());
  mocks.getGroupBalances.mockResolvedValue([
    { userId: anaId, balanceCents: -1500 },
    { userId: samId, balanceCents: 1500 },
  ]);
  mocks.listGroupExpenses.mockResolvedValue([
    expense(false),
    expense(false),
    expense(true),
  ]);
  mocks.getCurrentSettleUp.mockRejectedValue(new NotFoundError("none"));
  mocks.listPastPeriods.mockResolvedValue([]);
});

describe("SettleUpDetail", () => {
  it("heads the page with the group, the period and the unsettled count", async () => {
    render(await detail());

    expect(
      screen.getByRole("heading", { level: 1, name: /Settle up · 🏠 Dorm 4B/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Open period since Oct 1 · 2 unsettled expenses"),
    ).toBeInTheDocument();
  });

  it("dates the period from the last closed one", async () => {
    mocks.listPastPeriods.mockResolvedValue([
      {
        id: "p",
        groupId,
        status: "closed",
        startedBy: anaId,
        startedAt: "2026-10-01T09:00:00+00:00",
        closedAt: "2026-10-20T09:00:00+00:00",
        expenseCount: 3,
        paymentCount: 1,
      },
    ]);

    render(await detail());

    expect(screen.getByText(/Open period since Oct 20/)).toBeInTheDocument();
    expect(screen.getByText("3 expenses · 1 payment")).toBeInTheDocument();
  });

  it("shows where everyone stands in words", async () => {
    render(await detail());

    // MoneyText puts the amount in its own element, so match the row's text.
    const rows = screen.getAllByRole("listitem").map((row) => row.textContent);
    expect(rows).toContainEqual(expect.stringContaining("You owe $15.00"));
    expect(rows).toContainEqual(expect.stringContaining("Sam is owed $15.00"));
  });

  it("gives the panel no settle-up when none is open", async () => {
    render(await detail());

    expect(panelProps()).toMatchObject({
      groupId,
      settleUp: null,
      names: { [anaId]: "Ana", [samId]: "Sam" },
      currentUserId: anaId,
      memberCount: 2,
      readOnly: false,
    });
  });

  it("gives the panel the open settle-up", async () => {
    const settleUp = { id: "s", status: "open", payments: [] };
    mocks.getCurrentSettleUp.mockResolvedValue(settleUp);

    render(await detail());

    expect(panelProps().settleUp).toEqual(settleUp);
  });

  it("marks a read-only group for the panel", async () => {
    mocks.getGroup.mockResolvedValue(details({ readOnly: true }));

    render(await detail());

    expect(panelProps().readOnly).toBe(true);
    expect(screen.getByText("Read only")).toBeInTheDocument();
  });

  it("ends with the note that LifeBoard never moves money", async () => {
    render(await detail());

    expect(screen.getByText(/It never moves money\./)).toBeInTheDocument();
  });

  it("links back to the group on phones", async () => {
    render(await detail());

    expect(
      screen.getByRole("link", { name: /Back to 🏠 Dorm 4B/ }),
    ).toHaveAttribute("href", `/groups/${groupId}`);
  });

  it("is not found for a personal space, which has nothing to settle", async () => {
    mocks.getGroup.mockResolvedValue(details({ isPersonal: true }));

    await expect(detail()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("is not found for a group the user can't see", async () => {
    mocks.getGroup.mockRejectedValue(new ForbiddenError());

    await expect(detail()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("is not found for an id that is not a UUID, without asking the service", async () => {
    await expect(detail("nope")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.getGroup).not.toHaveBeenCalled();
  });

  it("sends a visitor without a session to login", async () => {
    mocks.getSessionUserId.mockResolvedValue(null);

    await expect(detail()).rejects.toThrow("NEXT_REDIRECT /login");
  });

  it("does not hide other failures behind not found", async () => {
    mocks.getCurrentSettleUp.mockRejectedValue(new Error("database down"));

    await expect(detail()).rejects.toThrow("database down");
  });
});
