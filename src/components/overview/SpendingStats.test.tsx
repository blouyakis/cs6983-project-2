import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SpendingStats } from "./SpendingStats";

describe("SpendingStats", () => {
  it("shows personal spending first, then the share in groups, then the total", () => {
    render(
      <SpendingStats personalThisMonthCents={9600} groupShareCents={8097} />,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: /Your spending/ }),
    ).toBeInTheDocument();
    const cards = screen.getAllByRole("listitem");
    expect(cards.map((card) => card.textContent)).toEqual([
      "$96.00Personal, this month",
      "$80.97Your share in groups, this period",
      "$176.97Total",
    ]);
  });

  it("shows $0.00 for a new user", () => {
    render(<SpendingStats personalThisMonthCents={0} groupShareCents={0} />);

    expect(screen.getAllByText("$0.00")).toHaveLength(3);
  });
});
