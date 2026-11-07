import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GroupSummary } from "@/lib/services/group-service";
import type { GroupStanding, Overview } from "@/lib/services/overview-service";
import { SettleUpBoard } from "./SettleUpBoard";

const mocks = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  getOverview: vi.fn(),
  listOpenSettlementGroupIds: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`);
  }),
}));

vi.mock("@/lib/auth/cookies", () => ({
  getSessionUserId: mocks.getSessionUserId,
}));
vi.mock("@/lib/services/overview-service", () => ({
  getOverview: mocks.getOverview,
}));
vi.mock("@/lib/services/settlement-service", () => ({
  listOpenSettlementGroupIds: mocks.listOpenSettlementGroupIds,
}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

const anaId = "6f1c2d4e-1111-4222-8333-944455556666";

function group(overrides: Partial<GroupSummary>): GroupSummary {
  return {
    id: "g",
    name: "Group",
    isPersonal: false,
    archivedAt: null,
    createdAt: "2026-10-01T09:00:00+00:00",
    readOnly: false,
    leftAt: null,
    members: [{ userId: anaId, name: "Ana", defaultShareWeight: 1 }],
    ...overrides,
  };
}

function standing(
  overrides: Partial<GroupSummary>,
  balanceCents = 0,
): GroupStanding {
  return {
    ...group(overrides),
    balanceCents,
    shareThisPeriodCents: 0,
    openItemCount: 0,
  };
}

const personal = group({ id: "p", name: "Personal space", isPersonal: true });

function overviewData(groups: GroupStanding[] = []): Overview {
  return {
    netCents: 0,
    owingCents: 0,
    owedCents: 0,
    groupShareThisPeriodCents: 0,
    personal: {
      group: personal,
      spentThisMonthCents: 0,
      openEstimateCents: 0,
      openItems: [],
    },
    groups,
    readOnlyGroups: [],
  };
}

describe("SettleUpBoard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.redirect.mockImplementation((path: string) => {
      throw new Error(`NEXT_REDIRECT ${path}`);
    });
    mocks.getSessionUserId.mockResolvedValue(anaId);
    mocks.listOpenSettlementGroupIds.mockResolvedValue(new Set());
  });

  it("redirects a visitor without a session to login", async () => {
    mocks.getSessionUserId.mockResolvedValue(null);

    await expect(SettleUpBoard()).rejects.toThrow("NEXT_REDIRECT /login");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("writes each balance in words and links to that group's settle-up page", async () => {
    mocks.getOverview.mockResolvedValue(
      overviewData([
        standing({ id: "dorm", name: "🏠 Dorm 4B" }, -883),
        standing({ id: "trip", name: "✈️ Trip" }, 500),
        standing({ id: "dinner", name: "🍕 Dinner" }, 0),
      ]),
    );

    render(await SettleUpBoard());

    const dormLink = screen.getByRole("link", { name: /🏠 Dorm 4B/ });
    expect(dormLink).toHaveAttribute("href", "/groups/dorm/settle-up");
    expect(dormLink).toHaveTextContent("You owe $8.83");

    const tripLink = screen.getByRole("link", { name: /✈️ Trip/ });
    expect(tripLink).toHaveAttribute("href", "/groups/trip/settle-up");
    expect(tripLink).toHaveTextContent("You are owed $5.00");

    const dinnerLink = screen.getByRole("link", { name: /🍕 Dinner/ });
    expect(dinnerLink).toHaveAttribute("href", "/groups/dinner/settle-up");
    expect(dinnerLink).toHaveTextContent("You are all settled up");
  });

  it("marks a group with an open settle-up as Settle-up in progress", async () => {
    mocks.getOverview.mockResolvedValue(
      overviewData([standing({ id: "dorm", name: "🏠 Dorm 4B" }, -883)]),
    );
    mocks.listOpenSettlementGroupIds.mockResolvedValue(new Set(["dorm"]));

    render(await SettleUpBoard());

    expect(screen.getByText("Settle-up in progress")).toBeInTheDocument();
  });

  it("does not show groups the user left or archived groups", async () => {
    const data = overviewData([
      standing({ id: "active", name: "Active group" }, 0),
    ]);
    data.readOnlyGroups = [
      group({ id: "left", name: "Old roommates", readOnly: true }),
      group({ id: "archived", name: "Archived trip", readOnly: true }),
    ];
    mocks.getOverview.mockResolvedValue(data);

    render(await SettleUpBoard());

    expect(screen.getByText("Active group")).toBeInTheDocument();
    expect(screen.queryByText("Old roommates")).not.toBeInTheDocument();
    expect(screen.queryByText("Archived trip")).not.toBeInTheDocument();
  });

  it("shows an empty message with a link to create a group when the user has no shared groups", async () => {
    mocks.getOverview.mockResolvedValue(overviewData([]));

    render(await SettleUpBoard());

    expect(screen.getByText(/There is nothing to settle/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create a group" }),
    ).toHaveAttribute("href", "/groups");
    expect(screen.queryByText("Personal space")).not.toBeInTheDocument();
  });
});
