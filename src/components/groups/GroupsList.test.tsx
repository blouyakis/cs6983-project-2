import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GroupSummary } from "@/lib/services/group-service";
import type { GroupStanding, Overview } from "@/lib/services/overview-service";
import { GroupsList } from "./GroupsList";

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
  openItemCount = 0,
): GroupStanding {
  return {
    ...group(overrides),
    balanceCents,
    shareThisPeriodCents: 0,
    openItemCount,
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
});

describe("GroupsList", () => {
  it("shows the personal space, the shared groups and the read-only ones in sections", async () => {
    mocks.getSessionUserId.mockResolvedValue(anaId);
    mocks.getOverview.mockResolvedValue(
      overview({
        groups: [
          standing({ id: "a", name: "🏠 Dorm 4B" }),
          standing({ id: "b", name: "🧺 Saturday picnic" }),
        ],
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

    render(await GroupsList());

    expect(mocks.getOverview).toHaveBeenCalledWith(anaId);
    expect(
      screen.getByRole("heading", { level: 2, name: "Just you" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Shared · 2 groups" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Left or archived · read-only history",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Read only")).toBeInTheDocument();
  });

  it("gives each shared group its balance in words and its open items", async () => {
    mocks.getSessionUserId.mockResolvedValue(anaId);
    mocks.getOverview.mockResolvedValue(
      overview({
        groups: [standing({ id: "a", name: "🏠 Dorm 4B" }, -3100, 3)],
      }),
    );

    render(await GroupsList());

    expect(screen.getByText(/You owe/)).toHaveTextContent("You owe $31.00");
    expect(screen.getByText("3 open on the list")).toBeInTheDocument();
  });

  it("gives the personal space its open items and this month's spending", async () => {
    mocks.getSessionUserId.mockResolvedValue(anaId);
    mocks.getOverview.mockResolvedValue(
      overview({
        personal: {
          group: personal,
          spentThisMonthCents: 9600,
          openEstimateCents: 0,
          openItems: [],
        },
      }),
    );

    render(await GroupsList());

    expect(screen.getByText(/Private/)).toHaveTextContent(
      "Private · 0 open items · $96.00 spent this month",
    );
  });

  it("says one group, not one groups", async () => {
    mocks.getSessionUserId.mockResolvedValue(anaId);
    mocks.getOverview.mockResolvedValue(
      overview({ groups: [standing({ id: "a" })] }),
    );

    render(await GroupsList());

    expect(
      screen.getByRole("heading", { level: 2, name: "Shared · 1 group" }),
    ).toBeInTheDocument();
  });

  it("invites the user to create a first group when there is none", async () => {
    mocks.getSessionUserId.mockResolvedValue(anaId);
    mocks.getOverview.mockResolvedValue(overview({ personal: null }));

    render(await GroupsList());

    expect(screen.getByText(/No shared groups yet/)).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Left or archived/ }),
    ).not.toBeInTheDocument();
  });

  it("sends a visitor without a session to login", async () => {
    mocks.getSessionUserId.mockResolvedValue(null);

    await expect(GroupsList()).rejects.toThrow("NEXT_REDIRECT /login");
    expect(mocks.getOverview).not.toHaveBeenCalled();
  });
});
