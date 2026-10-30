import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

describe("login page", () => {
  it("shows the LifeBoard heading and the login form", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(
      screen.getByRole("heading", { level: 1, name: "LifeBoard" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Log in" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("shows the expired message when proxy says the session expired", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({ expired: "1", next: "/groups" }),
      }),
    );
    expect(
      screen.getByText("Your session has expired. Please log in again."),
    ).toBeInTheDocument();
  });
});
