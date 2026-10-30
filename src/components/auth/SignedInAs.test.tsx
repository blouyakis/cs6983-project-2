import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedError } from "@/lib/http/errors";
import { SignedInAs } from "./SignedInAs";

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
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

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

describe("SignedInAs", () => {
  it("names the signed-in user", async () => {
    mocks.getSessionUserId.mockResolvedValue(sam.id);
    mocks.getCurrentUser.mockResolvedValue(sam);

    render(await SignedInAs());

    expect(screen.getByText("Signed in as Sam Lee")).toBeInTheDocument();
    expect(mocks.getCurrentUser).toHaveBeenCalledWith(sam.id);
  });

  it("sends a visitor without a session to login", async () => {
    mocks.getSessionUserId.mockResolvedValue(null);

    await expect(SignedInAs()).rejects.toThrow("NEXT_REDIRECT /login");
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
  });

  it("sends a session whose user is gone to login", async () => {
    mocks.getSessionUserId.mockResolvedValue(sam.id);
    mocks.getCurrentUser.mockRejectedValue(new UnauthorizedError());

    await expect(SignedInAs()).rejects.toThrow("NEXT_REDIRECT /login");
  });

  it("does not hide other failures behind a redirect", async () => {
    mocks.getSessionUserId.mockResolvedValue(sam.id);
    mocks.getCurrentUser.mockRejectedValue(new Error("database down"));

    await expect(SignedInAs()).rejects.toThrow("database down");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
