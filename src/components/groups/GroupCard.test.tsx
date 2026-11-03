import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GroupCard } from "./GroupCard";
import type { GroupSummary } from "@/lib/services/group-service";

const anaId = "6f1c2d4e-1111-4222-8333-944455556666";
const samId = "7a2d3e5f-1111-4222-8333-944455556666";

function summary(overrides: Partial<GroupSummary> = {}): GroupSummary {
  return {
    id: "0b7e8a10-2222-4333-8444-a55566667777",
    name: "🏠 Dorm 4B",
    isPersonal: false,
    archivedAt: null,
    createdAt: "2026-10-01T09:00:00+00:00",
    readOnly: false,
    leftAt: null,
    members: [
      { userId: anaId, name: "Ana", defaultShareWeight: 1 },
      { userId: samId, name: "Sam", defaultShareWeight: 1 },
    ],
    ...overrides,
  };
}

describe("GroupCard", () => {
  it("names the group, with its emoji in the tile", () => {
    render(<GroupCard group={summary()} currentUserId={anaId} />);

    expect(
      screen.getByRole("heading", { name: "🏠 Dorm 4B" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("group-tile")).toHaveTextContent("🏠");
  });

  it("lists the members with the current user as You, and the split", () => {
    render(<GroupCard group={summary()} currentUserId={anaId} />);

    expect(screen.getByText("You, Sam · even split")).toBeInTheDocument();
  });

  it("writes a default ratio as percents", () => {
    const group = summary({
      members: [
        { userId: anaId, name: "Ana", defaultShareWeight: 3 },
        { userId: samId, name: "Sam", defaultShareWeight: 2 },
      ],
    });
    render(<GroupCard group={group} currentUserId={anaId} />);

    expect(screen.getByText("You, Sam · 60/40 default")).toBeInTheDocument();
  });

  it("opens the group page", () => {
    render(<GroupCard group={summary()} currentUserId={anaId} />);

    expect(screen.getByRole("link", { name: /Open/ })).toHaveAttribute(
      "href",
      "/groups/0b7e8a10-2222-4333-8444-a55566667777",
    );
  });
});
