import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { GroupStanding } from "@/lib/services/overview-service";
import { CornerChips } from "./CornerChips";

const ana = "6f1c2d4e-1111-4222-8333-944455556666";

function standing(
  id: string,
  name: string,
  balanceCents: number,
): GroupStanding {
  return {
    id,
    name,
    isPersonal: false,
    archivedAt: null,
    createdAt: "2026-10-01T09:00:00+00:00",
    readOnly: false,
    leftAt: null,
    members: [{ userId: ana, name: "Ana", defaultShareWeight: 1 }],
    balanceCents,
    shareThisPeriodCents: 0,
    openItemCount: 0,
  };
}

describe("CornerChips", () => {
  it("puts the personal space first as Just me, then each group with its balance in words", () => {
    render(
      <CornerChips
        personal={{ id: "p", spentThisMonthCents: 9600 }}
        groups={[
          standing("a", "🏠 Dorm 4B", -3100),
          standing("b", "🧺 Sat picnic", 1850),
        ]}
      />,
    );

    const chips = screen.getAllByRole("link", { name: /Just me|Dorm|picnic/ });
    expect(chips.map((chip) => chip.textContent)).toEqual([
      "🙋Just me$96.00 this month",
      "🏠 Dorm 4BYou owe $31.00",
      "🧺 Sat picnicYou are owed $18.50",
    ]);
    expect(chips[0]).toHaveAttribute("href", "/groups/p");
    expect(chips[1]).toHaveAttribute("href", "/groups/a");
  });

  it("has a heading and a link to all groups", () => {
    render(<CornerChips personal={null} groups={[]} />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Your corners of life" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /all groups/ })).toHaveAttribute(
      "href",
      "/groups",
    );
  });

  it("shows only Just me for a user with no shared groups", () => {
    render(
      <CornerChips
        personal={{ id: "p", spentThisMonthCents: 0 }}
        groups={[]}
      />,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("$0.00 this month")).toBeInTheDocument();
  });
});
