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

  describe("spent and spent versus estimate in a group (#12)", () => {
    function renderGroup(overEstimateCents: number | null) {
      render(
        <ListStats
          openEstimateCents={1550}
          isPersonal={false}
          spentThisMonthCents={null}
          checkedOff={{ spentCents: 1450, overEstimateCents }}
        />,
      );
    }

    it("shows what the done items cost", () => {
      renderGroup(null);

      expect(screen.getByText("Spent")).toBeInTheDocument();
      expect(screen.getByText("$14.50")).toBeInTheDocument();
    });

    it("says in words how far over the estimate it came", () => {
      renderGroup(120);

      expect(screen.getByText("$1.20 over the estimate")).toBeInTheDocument();
    });

    it("says in words how far under the estimate it came", () => {
      renderGroup(-350);

      expect(screen.getByText("$3.50 under the estimate")).toBeInTheDocument();
    });

    it("says when it came to exactly the estimate", () => {
      renderGroup(0);

      expect(screen.getByText("Right on the estimate")).toBeInTheDocument();
    });

    it("leaves out the comparison when no done item had an estimate", () => {
      renderGroup(null);

      expect(screen.queryByText(/estimate$/)).not.toBeInTheDocument();
    });
  });
});
