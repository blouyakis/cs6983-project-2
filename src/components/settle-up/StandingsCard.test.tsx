import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StandingsCard } from "./StandingsCard";

const anaId = "6f1c2d4e-1111-4222-8333-944455556666";
const samId = "7a2d3e5f-1111-4222-8333-944455556666";
const joId = "1a2b3c4d-3333-4444-8555-b66677778888";

const members = [
  { userId: anaId, name: "Ana", defaultShareWeight: 1 },
  { userId: samId, name: "Sam", defaultShareWeight: 1 },
  { userId: joId, name: "Jo", defaultShareWeight: 1 },
];

const balances = [
  { userId: anaId, balanceCents: -3100 },
  { userId: samId, balanceCents: 4200 },
  { userId: joId, balanceCents: -1100 },
];

function card(unsettledExpenses = 9) {
  render(
    <StandingsCard
      members={members}
      balances={balances}
      currentUserId={anaId}
      unsettledExpenses={unsettledExpenses}
      billHref="/groups/g1"
    />,
  );
}

describe("StandingsCard", () => {
  it("is titled Where everyone stands", () => {
    card();

    expect(
      screen.getByRole("heading", { name: /Where everyone stands/ }),
    ).toBeInTheDocument();
  });

  it("writes each member's balance in words, the current user first as You", () => {
    card();

    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "AYou (Ana)You owe $31.00",
      "SSamSam is owed $42.00",
      "JJoJo owes $11.00",
    ]);
  });

  it("draws a bar for each balance that screen readers skip", () => {
    card();

    const bars = document.querySelectorAll("[data-bar]");
    expect(bars).toHaveLength(3);
    for (const bar of bars) {
      expect(bar).toHaveAttribute("aria-hidden", "true");
    }
    // Sam is owed the most, so his bar is the full width.
    const widths = Array.from(bars, (bar) =>
      bar.firstElementChild?.getAttribute("style"),
    );
    expect(widths[1]).toContain("100%");
    expect(widths[0]).toContain("73.8%");
  });

  it("says how many expenses are unsettled and links to the bill", () => {
    card(9);

    const link = screen.getByRole("link", { name: /9 unsettled expenses/ });
    expect(link).toHaveAttribute("href", "/groups/g1");
  });

  it("uses the singular for one expense", () => {
    card(1);

    expect(
      screen.getByRole("link", { name: /1 unsettled expense$/ }),
    ).toBeInTheDocument();
  });

  it("says everyone is settled up when every balance is zero", () => {
    render(
      <StandingsCard
        members={members}
        balances={members.map((m) => ({ userId: m.userId, balanceCents: 0 }))}
        currentUserId={anaId}
        unsettledExpenses={0}
        billHref="/groups/g1"
      />,
    );

    expect(screen.getByText("You are all settled up")).toBeInTheDocument();
    expect(document.querySelectorAll("[data-bar]")).toHaveLength(0);
  });
});
