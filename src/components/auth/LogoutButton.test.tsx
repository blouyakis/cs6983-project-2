import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LogoutButton } from "./LogoutButton";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LogoutButton", () => {
  it("clears the session and goes to login", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    render(<LogoutButton />);

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
    });
    expect(router.refresh).toHaveBeenCalled();
  });
});
