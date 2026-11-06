import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PastPeriods } from "./PastPeriods";

const period = {
  id: "5e6f7a8b-5555-4666-8777-d88899990000",
  groupId: "g",
  status: "closed" as const,
  startedBy: "u",
  startedAt: "2026-09-01T10:00:00+00:00",
  closedAt: "2026-09-30T10:00:00+00:00",
  expenseCount: 7,
  paymentCount: 2,
};

describe("PastPeriods", () => {
  it("shows one card per closed period with its counts and a CLOSED badge", () => {
    render(
      <PastPeriods
        periods={[
          period,
          {
            ...period,
            id: "older",
            startedAt: "2026-08-01T10:00:00+00:00",
            closedAt: "2026-08-31T10:00:00+00:00",
            expenseCount: 4,
            paymentCount: 1,
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /Past periods/ }),
    ).toBeInTheDocument();
    const cards = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent("Sep 1 – Sep 30");
    expect(cards[0]).toHaveTextContent("7 expenses · 2 payments");
    expect(cards[0]).toHaveTextContent("Closed");
    expect(cards[1]).toHaveTextContent("4 expenses · 1 payment");
  });

  it("says so when no period has closed yet", () => {
    render(<PastPeriods periods={[]} />);

    expect(screen.getByText("No period has closed yet.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
