import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GroupSummary } from "@/lib/services/group-service";
import type { GroupStanding, Overview } from "@/lib/services/overview-service";
import { ListsBoard } from "./ListsBoard";

const mocks = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  getOverview: vi.fn(),
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
  openItemCount = 0,
): GroupStanding {
  return {
    ...group(overrides),
    balanceCents: 0,
    shareThisPeriodCents: 0,
    openItemCount,
  };
}

const personal = group({ id: "p", name: "Personal space", isPersonal: true });

function overviewData(overrides: Partial<Overview> = {}): Overview {
  return {
    netCents: 0,
    owingCents: 0,
    owedCents: 0,
    groupShareThisPeriodCents: 0,
    personal: {
      group: personal,
      spentThisMonthCents: 0,
      openEstimateCents: 0,
      openItems: [
        {
          id: "item-1",
          groupId: "p",
          name: "Apples",
          estimatedCostCents: 400,
          status: "open",
          addedBy: anaId,
          completedBy: null,
          completedAt: null,
          expenseId: null,
          createdAt: "2026-11-01T10:00:00Z",
          updatedAt: "2026-11-01T10:00:00Z",
        },
      ],
    },
    groups: [],
    readOnlyGroups: [],
    ...overrides,
  };
}

describe("ListsBoard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.redirect.mockImplementation((path: string) => {
      throw new Error(`NEXT_REDIRECT ${path}`);
    });
    mocks.getSessionUserId.mockResolvedValue(anaId);
  });

  it("redirects a visitor without a session to login", async () => {
    mocks.getSessionUserId.mockResolvedValue(null);

    await expect(ListsBoard()).rejects.toThrow("NEXT_REDIRECT /login");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("shows the personal space first, then each shared group with its open item count", async () => {
    mocks.getOverview.mockResolvedValue(
      overviewData({
        groups: [
          standing({ id: "dorm", name: "🏠 Dorm 4B" }, 3),
          standing({ id: "trip", name: "✈️ Trip" }, 0),
        ],
      }),
    );

    render(await ListsBoard());

    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/groups/p");
    expect(links[0]).toHaveTextContent("Personal space");
    expect(links[0]).toHaveTextContent("1 open on the list");

    expect(screen.getByRole("link", { name: /🏠 Dorm 4B/ })).toHaveAttribute(
      "href",
      "/groups/dorm",
    );
    expect(screen.getByText("3 open on the list")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /✈️ Trip/ })).toHaveAttribute(
      "href",
      "/groups/trip",
    );
    expect(screen.getByText("Nothing open on the list")).toBeInTheDocument();
  });

  it("does not show groups the user left or archived groups", async () => {
    mocks.getOverview.mockResolvedValue(
      overviewData({
        groups: [standing({ id: "active", name: "Active group" }, 2)],
        readOnlyGroups: [
          group({ id: "left", name: "Old roommates", readOnly: true }),
          group({
            id: "archived",
            name: "Archived trip",
            readOnly: true,
            archivedAt: "2026-10-31T00:00:00Z",
          }),
        ],
      }),
    );

    render(await ListsBoard());

    expect(screen.getByText("Active group")).toBeInTheDocument();
    expect(screen.queryByText("Old roommates")).not.toBeInTheDocument();
    expect(screen.queryByText("Archived trip")).not.toBeInTheDocument();
  });

  it("shows the personal space and a helpful empty message when there are no shared groups", async () => {
    mocks.getOverview.mockResolvedValue(overviewData({ groups: [] }));

    render(await ListsBoard());

    expect(screen.getByText("Personal space")).toBeInTheDocument();
    expect(screen.getByText(/No shared groups yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create one" })).toHaveAttribute(
      "href",
      "/groups",
    );
  });
});
