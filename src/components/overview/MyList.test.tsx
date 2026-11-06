import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ListItem } from "@/lib/db/list-items";
import { MyList } from "./MyList";

const ana = "6f1c2d4e-1111-4222-8333-944455556666";

function item(id: string, title: string, estimatedCents: number | null) {
  return {
    id,
    groupId: "p",
    title,
    quantity: null,
    note: null,
    estimatedCents,
    status: "open",
    addedBy: ana,
    completedBy: null,
    completedAt: null,
    createdAt: "2026-11-02T10:00:00+00:00",
  } satisfies ListItem;
}

describe("MyList", () => {
  it("lists the personal space's open items with their estimated total", () => {
    render(
      <MyList
        items={[
          item("1", "💇 Haircut", 3500),
          item("2", "📶 Internet bill", 6000),
          item("3", "📮 Stamps", 400),
        ]}
        openEstimateCents={9900}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: /My list/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/open$/)).toHaveTextContent("est. $99.00 open");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("Haircut")).toBeInTheDocument();
  });

  it("offers no edit or delete, which live on the personal list", () => {
    render(
      <MyList
        items={[item("1", "💇 Haircut", 3500)]}
        openEstimateCents={3500}
      />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("says when nothing is planned", () => {
    render(<MyList items={[]} openEstimateCents={0} />);

    expect(screen.getByText("Nothing planned yet.")).toBeInTheDocument();
  });
});
