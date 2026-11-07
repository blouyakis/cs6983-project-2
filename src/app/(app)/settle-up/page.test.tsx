import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SettleUpPage from "./page";

vi.mock("@/components/settle-up/SettleUpBoard", () => ({
  SettleUpBoard: () => <p>The settle-up board</p>,
}));

describe("SettleUpPage", () => {
  it("has the page heading and renders the settle-up board in a Suspense boundary", () => {
    render(<SettleUpPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Settle up" }),
    ).toBeInTheDocument();
    expect(screen.getByText("The settle-up board")).toBeInTheDocument();
  });
});
