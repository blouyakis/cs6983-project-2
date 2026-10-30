import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OverviewPage from "./page";

vi.mock("@/components/auth/SignedInAs", () => ({
  SignedInAs: () => <p>Signed in as Sam Lee</p>,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

describe("overview page", () => {
  it("shows the overview heading, the signed-in user and log out", () => {
    render(<OverviewPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Overview" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Signed in as Sam Lee")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });
});
