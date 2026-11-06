import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PersonalSpaceCard } from "./PersonalSpaceCard";
import type { GroupSummary } from "@/lib/services/group-service";

const anaId = "6f1c2d4e-1111-4222-8333-944455556666";

const personal: GroupSummary = {
  id: "p1",
  name: "Personal space",
  isPersonal: true,
  archivedAt: null,
  createdAt: "2026-10-01T09:00:00+00:00",
  readOnly: false,
  leftAt: null,
  members: [{ userId: anaId, name: "Ana", defaultShareWeight: 1 }],
};

describe("PersonalSpaceCard", () => {
  it("says the space is private and links to it", () => {
    render(
      <PersonalSpaceCard
        group={personal}
        openItemCount={0}
        spentThisMonthCents={0}
      />,
    );

    expect(
      screen.getByText(/nothing here is split or visible to anyone/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Personal space/ }),
    ).toHaveAttribute("href", "/groups/p1");
  });

  it("gives its open items and this month's spending", () => {
    render(
      <PersonalSpaceCard
        group={personal}
        openItemCount={4}
        spentThisMonthCents={9600}
      />,
    );

    expect(screen.getByText(/Private/)).toHaveTextContent(
      "Private · 4 open items · $96.00 spent this month · nothing here is split or visible to anyone",
    );
  });

  it("says one open item in the singular", () => {
    render(
      <PersonalSpaceCard
        group={personal}
        openItemCount={1}
        spentThisMonthCents={0}
      />,
    );

    expect(screen.getByText(/Private/)).toHaveTextContent(
      "Private · 1 open item · $0.00 spent this month",
    );
  });
});
