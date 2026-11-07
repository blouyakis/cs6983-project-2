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
    // Each card's emoji is decorative, so only the words are checked.
    const [personal, share, total] = screen.getAllByRole("listitem");
    expect(personal).toHaveTextContent(/^\$96\.00.*Personal, this month$/);
    expect(share).toHaveTextContent(
      /^\$80\.97.*Your share in groups, this period$/,
    );
    expect(total).toHaveTextContent(/^\$176\.97.*Total$/);
  });

  it("shows $0.00 for a new user", () => {
    render(<SpendingStats personalThisMonthCents={0} groupShareCents={0} />);

    expect(screen.getAllByText("$0.00")).toHaveLength(3);
  });
});
