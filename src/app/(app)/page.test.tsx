import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OverviewPage from "./page";

vi.mock("@/components/auth/SignedInAs", () => ({
  SignedInAs: () => <p>Signed in as Sam Lee</p>,
}));
vi.mock("@/components/overview/OverviewBoard", () => ({
  OverviewBoard: () => <p>The overview board</p>,
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

  it("has no Groups link of its own, because the app shell provides one", () => {
    render(<OverviewPage />);

    expect(screen.queryByRole("link", { name: /Groups/ })).toBeNull();
  });

  it("shows the overview board", () => {
    render(<OverviewPage />);

    expect(screen.getByText("The overview board")).toBeInTheDocument();
  });
});
