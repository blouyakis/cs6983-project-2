import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@/lib/http/errors";
import type { GroupDetails, GroupSummary } from "@/lib/services/group-service";
import { GroupDetail } from "./GroupDetail";

const mocks = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  getGroup: vi.fn(),
  listGroups: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));
vi.mock("@/lib/auth/cookies", () => ({
  getSessionUserId: mocks.getSessionUserId,
}));
vi.mock("@/lib/services/group-service", () => ({
  getGroup: mocks.getGroup,
  listGroups: mocks.listGroups,
}));
// The button is a Client Component with its own tests. Here it only has to be
// given the right groups.
vi.mock("@/components/expenses/AddExpenseButton", () => ({
  AddExpenseButton: (props: object) => (
    <div data-testid="add-expense" data-props={JSON.stringify(props)} />
  ),
}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
  useRouter: () => ({ refresh: vi.fn() }),
}));

const anaId = "6f1c2d4e-1111-4222-8333-944455556666";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";

function details(overrides: Partial<GroupDetails> = {}): GroupDetails {
  return {
    id: groupId,
    name: "🏠 Dorm 4B",
    isPersonal: false,
    archivedAt: null,
    createdAt: "2026-10-01T09:00:00+00:00",
    readOnly: false,
    members: [
      { userId: anaId, name: "Ana", defaultShareWeight: 1 },
      {
        userId: "7a2d3e5f-1111-4222-8333-944455556666",
        name: "Sam",
        defaultShareWeight: 1,
      },
    ],
    ...overrides,
  };
}

function summary(overrides: Partial<GroupSummary> = {}): GroupSummary {
  return { ...details(), leftAt: null, ...overrides };
}

function addExpenseProps() {
  return JSON.parse(
    screen.getByTestId("add-expense").getAttribute("data-props") ?? "{}",
  );
}

function detail(id = groupId) {
  return GroupDetail({ params: Promise.resolve({ groupId: id }) });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.redirect.mockImplementation((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`);
  });
  mocks.notFound.mockImplementation(() => {
    throw new Error("NEXT_NOT_FOUND");
  });
  mocks.getSessionUserId.mockResolvedValue(anaId);
  mocks.listGroups.mockResolvedValue([]);
});

describe("GroupDetail", () => {
  it("shows the group's name, its members and the invite form", async () => {
    mocks.getGroup.mockResolvedValue(details());

    render(await detail());

    expect(mocks.getGroup).toHaveBeenCalledWith(anaId, groupId);
    expect(
      screen.getByRole("heading", { level: 1, name: "🏠 Dorm 4B" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ana (you)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Invite" })).toBeInTheDocument();
  });

  it("has no invite form in the personal space", async () => {
    mocks.getGroup.mockResolvedValue(
      details({ name: "Personal space", isPersonal: true }),
    );

    render(await detail());

    expect(
      screen.queryByRole("button", { name: "Invite" }),
    ).not.toBeInTheDocument();
  });

  it("has no invite form and says so when the group is read-only", async () => {
    mocks.getGroup.mockResolvedValue(details({ readOnly: true }));

    render(await detail());

    expect(
      screen.queryByRole("button", { name: "Invite" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Read only")).toBeInTheDocument();
  });

  it("offers to log a cost in this group, and in the other groups the user can add to", async () => {
    const trip = summary({
      id: "1c8f9b21-2222-4333-8444-a55566667777",
      name: "✈️ Trip",
    });
    const left = summary({
      id: "2d90ac32-2222-4333-8444-a55566667777",
      name: "Old flat",
      readOnly: true,
      leftAt: "2026-09-02T10:00:00+00:00",
    });
    mocks.getGroup.mockResolvedValue(details());
    mocks.listGroups.mockResolvedValue([summary(), trip, left]);

    render(await detail());

    expect(mocks.listGroups).toHaveBeenCalledWith(anaId);
    const props = addExpenseProps();
    expect(props.currentUserId).toBe(anaId);
    expect(props.defaultGroupId).toBe(groupId);
    expect(props.groups.map((group: { id: string }) => group.id)).toEqual([
      groupId,
      trip.id,
    ]);
    expect(props.groups[0]).toEqual({
      id: groupId,
      name: "🏠 Dorm 4B",
      isPersonal: false,
      members: details().members,
    });
  });

  it("offers it in the personal space too", async () => {
    mocks.getGroup.mockResolvedValue(
      details({ name: "Personal space", isPersonal: true }),
    );
    mocks.listGroups.mockResolvedValue([
      summary({ name: "Personal space", isPersonal: true }),
    ]);

    render(await detail());

    expect(addExpenseProps().groups[0].isPersonal).toBe(true);
  });

  it("does not offer it when the group is read-only", async () => {
    mocks.getGroup.mockResolvedValue(details({ readOnly: true }));

    render(await detail());

    expect(screen.queryByTestId("add-expense")).not.toBeInTheDocument();
  });

  it("shows not found for a group the user can't see, without saying it exists", async () => {
    mocks.getGroup.mockRejectedValue(new ForbiddenError());

    await expect(detail()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("shows not found for an id that is not a UUID, without asking the service", async () => {
    await expect(detail("nope")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.getGroup).not.toHaveBeenCalled();
  });

  it("sends a visitor without a session to login", async () => {
    mocks.getSessionUserId.mockResolvedValue(null);

    await expect(detail()).rejects.toThrow("NEXT_REDIRECT /login");
  });

  it("does not hide other failures behind not found", async () => {
    mocks.getGroup.mockRejectedValue(new Error("database down"));

    await expect(detail()).rejects.toThrow("database down");
  });
});
