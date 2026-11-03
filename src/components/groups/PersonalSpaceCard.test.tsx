import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PersonalSpaceCard } from "./PersonalSpaceCard";
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

describe("PersonalSpaceCard", () => {
  it("says the space is private and links to it", () => {
    const group = summary({
      id: "p1",
      name: "Personal space",
      isPersonal: true,
    });
    render(<PersonalSpaceCard group={group} />);

    expect(
      screen.getByText(/nothing here is split or visible to anyone/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Personal space/ }),
    ).toHaveAttribute("href", "/groups/p1");
  });
});
