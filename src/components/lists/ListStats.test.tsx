import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListStats } from "./ListStats";

describe("ListStats", () => {
  it("shows what is still to buy in a group", () => {
    render(
      <ListStats
        openEstimateCents={1550}
        isPersonal={false}
        spentThisMonthCents={null}
      />,
    );

    expect(screen.getByText("Still to buy")).toBeInTheDocument();
    expect(screen.getByText("$15.50")).toBeInTheDocument();
  });

  it("calls it planned in the personal space", () => {
    render(
      <ListStats openEstimateCents={9900} isPersonal spentThisMonthCents={0} />,
    );

    expect(screen.getByText("Planned")).toBeInTheDocument();
    expect(screen.getByText("$99.00")).toBeInTheDocument();
  });

  it("shows $0.00 when nothing open has an estimate", () => {
    render(
      <ListStats
        openEstimateCents={0}
        isPersonal={false}
        spentThisMonthCents={null}
      />,
    );

    expect(screen.getByText("$0.00")).toBeInTheDocument();
  });

  it("shows what was spent this month in the personal space (#23)", () => {
    render(
      <ListStats
        openEstimateCents={9900}
        isPersonal
        spentThisMonthCents={8200}
      />,
    );

    expect(screen.getByText("Spent this month")).toBeInTheDocument();
    expect(screen.getByText("$82.00")).toBeInTheDocument();
  });

  it("shows $0.00 spent in a personal space with nothing this month", () => {
    render(
      <ListStats openEstimateCents={0} isPersonal spentThisMonthCents={0} />,
    );

    expect(screen.getByText("Spent this month")).toBeInTheDocument();
  });

  it("doesn't show spent this month in a shared group", () => {
    render(
      <ListStats
        openEstimateCents={1550}
        isPersonal={false}
        spentThisMonthCents={null}
      />,
    );

    expect(screen.queryByText("Spent this month")).not.toBeInTheDocument();
  });
});
