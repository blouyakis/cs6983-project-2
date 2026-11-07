import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BalanceSummary } from "./BalanceSummary";

describe("BalanceSummary", () => {
  it("shows what the user owes and is owed side by side, and the net in words", () => {
    render(
      <BalanceSummary
        totals={{ netCents: -2350, owingCents: 4200, owedCents: 1850 }}
      />,
    );

    expect(screen.getByText("You owe", { selector: "dt" })).toBeVisible();
    expect(screen.getByText("$42.00")).toBeInTheDocument();
    expect(screen.getByText("You're owed", { selector: "dt" })).toBeVisible();
    expect(screen.getByText("$18.50")).toBeInTheDocument();
    expect(screen.getByText(/Net across all groups/)).toHaveTextContent(
      "Net across all groups: You owe $23.50",
    );
  });

  it("says the user is all settled up when the net is zero", () => {
    render(
      <BalanceSummary totals={{ netCents: 0, owingCents: 0, owedCents: 0 }} />,
    );

    expect(screen.getByText(/Net across all groups/)).toHaveTextContent(
      "Net across all groups: You are all settled up",
    );
  });

  it("links to the /settle-up page", () => {
    render(
      <BalanceSummary
        totals={{ netCents: -2350, owingCents: 4200, owedCents: 1850 }}
      />,
    );

    const settleLink = screen.getByRole("link", { name: /Settle/ });
    expect(settleLink).toHaveAttribute("href", "/settle-up");
  });
});
