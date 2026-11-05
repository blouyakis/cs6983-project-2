import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GroupSummary } from "@/lib/services/group-service";
import { SidebarGroups } from "./SidebarGroups";

const mocks = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  listGroups: vi.fn(),
  usePathname: vi.fn(),
}));
vi.mock("@/lib/auth/cookies", () => ({
  getSessionUserId: mocks.getSessionUserId,
}));
vi.mock("@/lib/services/group-service", () => ({
  listGroups: mocks.listGroups,
}));
vi.mock("next/navigation", () => ({ usePathname: mocks.usePathname }));

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
  mocks.usePathname.mockReturnValue("/");
});

describe("SidebarGroups", () => {
  it("links the user's current groups and personal space, leaving out read-only ones", async () => {
    mocks.getSessionUserId.mockResolvedValue(anaId);
    mocks.listGroups.mockResolvedValue([
      group({ id: "p", name: "Personal space", isPersonal: true }),
      group({ id: "a", name: "🏠 Dorm 4B" }),
      group({
        id: "c",
        name: "🏖️ Cape weekend",
        readOnly: true,
        leftAt: "2026-09-02T15:00:00Z",
      }),
    ]);

    render(await SidebarGroups());

    expect(mocks.listGroups).toHaveBeenCalledWith(anaId);
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(
      ["🏠 Dorm 4B", "Personal space"],
    );
  });

  it("renders nothing without a session, because the proxy sends the user to login", async () => {
    mocks.getSessionUserId.mockResolvedValue(null);

    const { container } = render(await SidebarGroups());

    expect(container).toBeEmptyDOMElement();
    expect(mocks.listGroups).not.toHaveBeenCalled();
  });
});
