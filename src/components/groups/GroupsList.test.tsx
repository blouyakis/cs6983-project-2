import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GroupSummary } from "@/lib/services/group-service";
import { GroupsList } from "./GroupsList";

const mocks = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  listGroups: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`);
  }),
}));
vi.mock("@/lib/auth/cookies", () => ({
  getSessionUserId: mocks.getSessionUserId,
}));
vi.mock("@/lib/services/group-service", () => ({
  listGroups: mocks.listGroups,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

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

beforeEach(() => {
  vi.resetAllMocks();
  mocks.redirect.mockImplementation((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`);
  });
});

describe("GroupsList", () => {
  it("shows the personal space, the shared groups and the read-only ones in sections", async () => {
    mocks.getSessionUserId.mockResolvedValue(anaId);
    mocks.listGroups.mockResolvedValue([
      group({ id: "p", name: "Personal space", isPersonal: true }),
      group({ id: "a", name: "🏠 Dorm 4B" }),
      group({ id: "b", name: "🧺 Saturday picnic" }),
      group({
        id: "c",
        name: "🏖️ Cape weekend",
        readOnly: true,
        leftAt: "2026-09-02T15:00:00Z",
      }),
    ]);

    render(await GroupsList());

    expect(mocks.listGroups).toHaveBeenCalledWith(anaId);
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

  it("says one group, not one groups", async () => {
    mocks.getSessionUserId.mockResolvedValue(anaId);
    mocks.listGroups.mockResolvedValue([group({ id: "a" })]);

    render(await GroupsList());

    expect(
      screen.getByRole("heading", { level: 2, name: "Shared · 1 group" }),
    ).toBeInTheDocument();
  });

  it("invites the user to create a first group when there is none", async () => {
    mocks.getSessionUserId.mockResolvedValue(anaId);
    mocks.listGroups.mockResolvedValue([]);

    render(await GroupsList());

    expect(screen.getByText(/No shared groups yet/)).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Left or archived/ }),
    ).not.toBeInTheDocument();
  });

  it("sends a visitor without a session to login", async () => {
    mocks.getSessionUserId.mockResolvedValue(null);

    await expect(GroupsList()).rejects.toThrow("NEXT_REDIRECT /login");
    expect(mocks.listGroups).not.toHaveBeenCalled();
  });
});
