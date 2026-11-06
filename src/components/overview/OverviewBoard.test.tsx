import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GroupSummary } from "@/lib/services/group-service";
import type { GroupStanding, Overview } from "@/lib/services/overview-service";
import { OverviewBoard } from "./OverviewBoard";

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
  useRouter: () => ({ refresh: vi.fn() }),
}));

const ana = "6f1c2d4e-1111-4222-8333-944455556666";

function group(overrides: Partial<GroupSummary>): GroupSummary {
  return {
    id: "g",
    name: "Group",
    isPersonal: false,
    archivedAt: null,
    createdAt: "2026-10-01T09:00:00+00:00",
    readOnly: false,
    leftAt: null,
    members: [{ userId: ana, name: "Ana", defaultShareWeight: 1 }],
    ...overrides,
  };
}

function standing(
  id: string,
  name: string,
  balanceCents: number,
): GroupStanding {
  return {
    ...group({ id, name }),
    balanceCents,
    shareThisPeriodCents: 0,
    openItemCount: 0,
  };
}

const personal = group({ id: "p", name: "Personal space", isPersonal: true });

function overview(overrides: Partial<Overview> = {}): Overview {
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
    groups: [],
    readOnlyGroups: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.redirect.mockImplementation((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`);
  });
  mocks.getSessionUserId.mockResolvedValue(ana);
});

describe("OverviewBoard", () => {
  it("gives a new user with only a personal space no group cards and $0.00 spending", async () => {
    mocks.getOverview.mockResolvedValue(overview());

    render(await OverviewBoard());

    expect(mocks.getOverview).toHaveBeenCalledWith(ana);
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.getByText(/No shared groups yet/)).toBeInTheDocument();
    const stats = screen
      .getByRole("heading", { name: /Your spending/ })
      .closest("section");
    expect(stats).not.toBeNull();
    expect(within(stats as HTMLElement).getAllByText("$0.00")).toHaveLength(3);
  });

  it("states the net in the headline and gives each group a card", async () => {
    mocks.getOverview.mockResolvedValue(
      overview({
        netCents: -383,
        owingCents: 883,
        owedCents: 500,
        groups: [
          standing("a", "🏠 Dorm 4B", -883),
          standing("b", "🧺 Saturday picnic", 500),
        ],
      }),
    );

    render(await OverviewBoard());

    expect(
      screen.getByRole("heading", { level: 2, name: /across your groups/ }),
    ).toHaveTextContent("You owe $3.83 across your groups.");
    expect(
      screen
        .getAllByRole("article")
        .map(
          (card) => within(card).getByRole("heading", { level: 3 }).textContent,
        ),
    ).toEqual(["🏠 Dorm 4B", "🧺 Saturday picnic"]);
  });

  it("puts the personal space first in the corner chips", async () => {
    mocks.getOverview.mockResolvedValue(
      overview({
        groups: [
          standing("a", "🏠 Dorm 4B", -883),
          standing("b", "🧺 Saturday picnic", 500),
        ],
      }),
    );

    render(await OverviewBoard());

    const chips = screen
      .getByRole("heading", { name: "Your corners of life" })
      .closest("section") as HTMLElement;
    const links = within(chips)
      .getAllByRole("listitem")
      .map((item) => within(item).getByRole("link"));
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/groups/p",
      "/groups/a",
      "/groups/b",
    ]);
  });

  it("shows the personal space's open items under My list", async () => {
    mocks.getOverview.mockResolvedValue(
      overview({
        personal: {
          group: personal,
          spentThisMonthCents: 0,
          openEstimateCents: 3500,
          openItems: [
            {
              id: "i1",
              groupId: "p",
              title: "💇 Haircut",
              quantity: null,
              note: null,
              estimatedCents: 3500,
              status: "open",
              addedBy: ana,
              completedBy: null,
              completedAt: null,
              createdAt: "2026-11-02T10:00:00+00:00",
            },
          ],
        },
      }),
    );

    render(await OverviewBoard());

    expect(screen.getByRole("heading", { name: /My list/ })).toBeVisible();
    expect(screen.getByText("Haircut")).toBeInTheDocument();
  });

  it("shows groups the user left or that were archived below the rest", async () => {
    mocks.getOverview.mockResolvedValue(
      overview({
        groups: [standing("a", "🏠 Dorm 4B", 0)],
        readOnlyGroups: [
          group({
            id: "c",
            name: "🏖️ Cape weekend",
            readOnly: true,
            leftAt: "2026-09-02T15:00:00Z",
          }),
        ],
      }),
    );

    render(await OverviewBoard());

    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings.at(-1)).toBe("Left or archived · read-only history");
    expect(screen.getByText("Read only")).toBeInTheDocument();
  });

  it("offers Add a plan or cost", async () => {
    mocks.getOverview.mockResolvedValue(overview());

    render(await OverviewBoard());

    expect(
      screen.getByRole("button", { name: /Add a plan or cost/ }),
    ).toBeInTheDocument();
  });

  it("sends a visitor without a session to login", async () => {
    mocks.getSessionUserId.mockResolvedValue(null);

    await expect(OverviewBoard()).rejects.toThrow("NEXT_REDIRECT /login");
    expect(mocks.getOverview).not.toHaveBeenCalled();
  });
});
