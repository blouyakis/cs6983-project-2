import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarGroups } from "./SidebarGroups";

const mocks = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  listSidebarGroups: vi.fn(),
  usePathname: vi.fn(),
}));
vi.mock("@/lib/auth/cookies", () => ({
  getSessionUserId: mocks.getSessionUserId,
}));
vi.mock("@/lib/services/sidebar-service", () => ({
  listSidebarGroups: mocks.listSidebarGroups,
}));
vi.mock("next/navigation", () => ({ usePathname: mocks.usePathname }));

const anaId = "6f1c2d4e-1111-4222-8333-944455556666";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.usePathname.mockReturnValue("/");
});

describe("SidebarGroups", () => {
  it("links the user's sidebar groups with their balances", async () => {
    mocks.getSessionUserId.mockResolvedValue(anaId);
    mocks.listSidebarGroups.mockResolvedValue([
      { id: "p", name: "Personal space", isPersonal: true },
      { id: "a", name: "🏠 Dorm 4B", isPersonal: false, balanceCents: -3100 },
    ]);

    render(await SidebarGroups());

    expect(mocks.listSidebarGroups).toHaveBeenCalledWith(anaId);
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(
      ["🏠 Dorm 4BYou owe $31.00", "Personal space"],
    );
  });

  it("lists a group without a balance when its balance couldn't be loaded", async () => {
    mocks.getSessionUserId.mockResolvedValue(anaId);
    mocks.listSidebarGroups.mockResolvedValue([
      { id: "a", name: "🏠 Dorm 4B", isPersonal: false },
    ]);

    render(await SidebarGroups());

    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(
      ["🏠 Dorm 4B"],
    );
  });

  it("renders nothing without a session, because the proxy sends the user to login", async () => {
    mocks.getSessionUserId.mockResolvedValue(null);

    const { container } = render(await SidebarGroups());

    expect(container).toBeEmptyDOMElement();
    expect(mocks.listSidebarGroups).not.toHaveBeenCalled();
  });
});
