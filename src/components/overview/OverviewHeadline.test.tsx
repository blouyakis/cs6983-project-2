import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OverviewHeadline } from "./OverviewHeadline";

const now = new Date("2026-10-29T15:00:00Z");

function totals(netCents: number, owingCents: number, owedCents: number) {
  return { netCents, owingCents, owedCents };
}

describe("OverviewHeadline", () => {
  it("says what the user owes across their groups", () => {
    render(<OverviewHeadline totals={totals(-2350, 4200, 1850)} now={now} />);

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "You owe $23.50 across your groups.",
    );
  });

  it("says what the user is owed across their groups", () => {
    render(<OverviewHeadline totals={totals(2350, 0, 2350)} now={now} />);

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "You are owed $23.50 across your groups.",
    );
  });

  it("says when the user is all settled up", () => {
    render(<OverviewHeadline totals={totals(0, 0, 0)} now={now} />);

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "You are all settled up across your groups.",
    );
  });

  it("gives the date and the totals owed each way", () => {
    render(<OverviewHeadline totals={totals(-2350, 4200, 1850)} now={now} />);

    expect(
      screen.getByText("Thu, Oct 29 · you owe $42.00 and are owed $18.50"),
    ).toBeInTheDocument();
  });

  it("holds the button it is given at the right", () => {
    render(
      <OverviewHeadline totals={totals(0, 0, 0)} now={now}>
        <button type="button">Add a plan or cost</button>
      </OverviewHeadline>,
    );

    expect(
      screen.getByRole("button", { name: "Add a plan or cost" }),
    ).toBeInTheDocument();
  });
});
