import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedError } from "@/lib/http/errors";
import OverviewPage from "./page";

const mocks = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  getCurrentUser: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`);
  }),
}));

vi.mock("@/lib/auth/cookies", () => ({
  getSessionUserId: mocks.getSessionUserId,
}));
vi.mock("@/lib/services/auth-service", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

const sam = {
  id: "6f1c2d4e-1111-4222-8333-944455556666",
  email: "sam@example.com",
  name: "Sam Lee",
  createdAt: "2026-10-30T12:00:00+00:00",
  updatedAt: "2026-10-30T12:00:00+00:00",
};

beforeEach(() => {
  mocks.getSessionUserId.mockReset();
  mocks.getCurrentUser.mockReset();
  mocks.redirect.mockClear();
});

describe("overview page", () => {
  it("greets the signed-in user and offers log out", async () => {
    mocks.getSessionUserId.mockResolvedValue(sam.id);
    mocks.getCurrentUser.mockResolvedValue(sam);

    render(await OverviewPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Overview" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Signed in as Sam Lee")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
    expect(mocks.getCurrentUser).toHaveBeenCalledWith(sam.id);
  });

  it("sends a visitor without a session to login", async () => {
    mocks.getSessionUserId.mockResolvedValue(null);

    await expect(OverviewPage()).rejects.toThrow("NEXT_REDIRECT /login");
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
  });

  it("sends a session whose user is gone to login", async () => {
    mocks.getSessionUserId.mockResolvedValue(sam.id);
    mocks.getCurrentUser.mockRejectedValue(new UnauthorizedError());

    await expect(OverviewPage()).rejects.toThrow("NEXT_REDIRECT /login");
  });
});
