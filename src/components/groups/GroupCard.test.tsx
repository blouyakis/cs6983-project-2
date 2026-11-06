import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { EntryGroup } from "@/components/expenses/EntryForm";
import { NoticeProvider } from "@/components/ui/NoticeProvider";
import type { GroupStanding } from "@/lib/services/overview-service";
import { GroupCard } from "./GroupCard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const anaId = "6f1c2d4e-1111-4222-8333-944455556666";
const samId = "7a2d3e5f-1111-4222-8333-944455556666";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";

function standing(overrides: Partial<GroupStanding> = {}): GroupStanding {
  return {
    id: groupId,
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
    balanceCents: -3100,
    shareThisPeriodCents: 5421,
    openItemCount: 3,
    ...overrides,
  };
}

function entryGroup(group: GroupStanding): EntryGroup {
  const { id, name, isPersonal, members } = group;
  return { id, name, isPersonal, members };
}

// Add plan here shows its notice in the page's NoticeProvider.
function WithNotices({ children }: { children: ReactNode }) {
  return <NoticeProvider>{children}</NoticeProvider>;
}

function renderCard(group: GroupStanding, wide = false) {
  render(
    <GroupCard
      group={group}
      currentUserId={anaId}
      addableGroups={[entryGroup(group)]}
      wide={wide}
    />,
    { wrapper: WithNotices },
  );
}

describe("GroupCard", () => {
  it("names the group, with its emoji in the tile", () => {
    renderCard(standing());

    expect(
      screen.getByRole("heading", { name: "🏠 Dorm 4B" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("group-tile")).toHaveTextContent("🏠");
  });

  it("lists the members with the current user as You, and the split", () => {
    renderCard(standing());

    expect(screen.getByText("You, Sam · even split")).toBeInTheDocument();
  });

  it("writes a default ratio as percents", () => {
    renderCard(
      standing({
        members: [
          { userId: anaId, name: "Ana", defaultShareWeight: 3 },
          { userId: samId, name: "Sam", defaultShareWeight: 2 },
        ],
      }),
    );

    expect(screen.getByText("You, Sam · 60/40 default")).toBeInTheDocument();
  });

  it("writes the user's balance in words", () => {
    renderCard(standing({ balanceCents: -3100 }));

    expect(screen.getByText(/You owe/)).toHaveTextContent("You owe $31.00");
  });

  it("writes being owed and being settled in words too", () => {
    renderCard(standing({ id: "g1", balanceCents: 1850 }));
    renderCard(standing({ id: "g2", balanceCents: 0 }));

    expect(screen.getByText(/You are owed/)).toHaveTextContent(
      "You are owed $18.50",
    );
    expect(screen.getByText("You are all settled up")).toBeInTheDocument();
  });

  it("says how many items are open on the list", () => {
    renderCard(standing({ openItemCount: 3 }));

    expect(screen.getByText("3 open on the list")).toBeInTheDocument();
  });

  it("says when nothing is open on the list", () => {
    renderCard(standing({ openItemCount: 0 }));

    expect(screen.getByText("Nothing open on the list")).toBeInTheDocument();
  });

  it("adds the user's share this period on the wide overview card", () => {
    renderCard(standing(), true);

    expect(screen.getByText(/your share/)).toHaveTextContent(
      "your share $54.21",
    );
  });

  it("leaves the share out on the Groups page", () => {
    renderCard(standing());

    expect(screen.queryByText(/your share/)).not.toBeInTheDocument();
  });

  it("opens the group page", () => {
    renderCard(standing());

    expect(screen.getByRole("link", { name: /Open/ })).toHaveAttribute(
      "href",
      `/groups/${groupId}`,
    );
  });

  it("offers Add plan here, named for the group", () => {
    renderCard(standing());

    const card = screen.getByRole("article");
    expect(
      within(card).getByRole("button", { name: "Add plan here, 🏠 Dorm 4B" }),
    ).toBeVisible();
  });

  it("links its settle-up icon to the group's settle-up, named for the group", () => {
    renderCard(standing());

    expect(
      screen.getByRole("link", { name: "Settle up 🏠 Dorm 4B" }),
    ).toHaveAttribute("href", `/groups/${groupId}/settle-up`);
  });
});
