import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArchivedGroupCard } from "./ArchivedGroupCard";
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

describe("ArchivedGroupCard", () => {
  it("says in words that the group is read-only and when the user left", () => {
    const group = summary({
      name: "🏖️ Cape weekend",
      readOnly: true,
      leftAt: "2026-09-02T15:00:00+00:00",
    });
    render(<ArchivedGroupCard group={group} />);

    expect(screen.getByText("Read only")).toBeInTheDocument();
    expect(
      screen.getByText(
        "You left Sep 2 · you can read everything up to that day, add nothing",
      ),
    ).toBeInTheDocument();
  });

  it("says when an archived group was archived", () => {
    const group = summary({
      readOnly: true,
      archivedAt: "2026-08-01T10:00:00+00:00",
    });
    render(<ArchivedGroupCard group={group} />);

    expect(
      screen.getByText(
        "Archived Aug 1 · everyone has left, you can read its history",
      ),
    ).toBeInTheDocument();
  });

  it("still links to the group's history", () => {
    render(
      <ArchivedGroupCard
        group={summary({ readOnly: true, leftAt: "2026-09-02T15:00:00Z" })}
      />,
    );

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/groups/0b7e8a10-2222-4333-8444-a55566667777",
    );
  });
});
