// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GroupSummary } from "./group-service";
import { listSidebarGroups } from "./sidebar-service";

const groupService = vi.hoisted(() => ({ listGroups: vi.fn() }));
vi.mock("./group-service", () => groupService);

const balanceService = vi.hoisted(() => ({ getGroupPeriod: vi.fn() }));
vi.mock("./balance-service", () => balanceService);

const ana = "6f1c2d4e-1111-4222-8333-944455556666";
const sam = "7a2d3e5f-1111-4222-8333-944455556666";
const personalId = "0a1b2c3d-1111-4222-8333-944455550001";
const dormId = "0a1b2c3d-1111-4222-8333-944455550002";
const picnicId = "0a1b2c3d-1111-4222-8333-944455550003";
const leftId = "0a1b2c3d-1111-4222-8333-944455550004";

function summary(
  id: string,
  name: string,
  overrides: Partial<GroupSummary> = {},
): GroupSummary {
  return {
    id,
    name,
    isPersonal: false,
    archivedAt: null,
    createdAt: "2026-10-01T09:00:00+00:00",
    readOnly: false,
    leftAt: null,
    members: [
      { userId: ana, name: "Ana", defaultShareWeight: 1 },
      { userId: sam, name: "Sam", defaultShareWeight: 1 },
    ],
    ...overrides,
  };
}

const personal = summary(personalId, "Personal space", { isPersonal: true });
const dorm = summary(dormId, "🏠 Dorm 4B");
const picnic = summary(picnicId, "🧺 Saturday picnic");
const left = summary(leftId, "🍝 Date nights", {
  readOnly: true,
  leftAt: "2026-09-02T15:00:00+00:00",
});

function period(anaCents: number) {
  return {
    balances: [
      { userId: ana, balanceCents: anaCents },
      { userId: sam, balanceCents: -anaCents },
    ],
    expenses: [],
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listSidebarGroups", () => {
  it("lists the user's current groups with their balance in each shared one, leaving out read-only groups", async () => {
    groupService.listGroups.mockResolvedValue([personal, dorm, picnic, left]);
    balanceService.getGroupPeriod.mockImplementation(
      async (_userId: string, groupId: string) =>
        period(groupId === dormId ? -3100 : 1850),
    );

    const groups = await listSidebarGroups(ana);

    expect(groups).toEqual([
      { id: personalId, name: "Personal space", isPersonal: true },
      {
        id: dormId,
        name: "🏠 Dorm 4B",
        isPersonal: false,
        balanceCents: -3100,
      },
      {
        id: picnicId,
        name: "🧺 Saturday picnic",
        isPersonal: false,
        balanceCents: 1850,
      },
    ]);
    expect(groupService.listGroups).toHaveBeenCalledWith(ana);
    // Only the shared groups the user is in now have a balance to load, and
    // getGroupPeriod (#9) checks access for each.
    expect(balanceService.getGroupPeriod.mock.calls).toEqual([
      [ana, dormId],
      [ana, picnicId],
    ]);
  });

  it("gives a member with no balance row a balance of zero", async () => {
    groupService.listGroups.mockResolvedValue([dorm]);
    balanceService.getGroupPeriod.mockResolvedValue({
      balances: [],
      expenses: [],
    });

    expect(await listSidebarGroups(ana)).toEqual([
      { id: dormId, name: "🏠 Dorm 4B", isPersonal: false, balanceCents: 0 },
    ]);
  });

  it("still lists a group whose balance can't be loaded, without a balance", async () => {
    groupService.listGroups.mockResolvedValue([dorm, picnic]);
    balanceService.getGroupPeriod.mockImplementation(
      async (_userId: string, groupId: string) => {
        if (groupId === dormId) {
          throw new Error("database unavailable");
        }
        return period(1850);
      },
    );

    expect(await listSidebarGroups(ana)).toEqual([
      { id: dormId, name: "🏠 Dorm 4B", isPersonal: false },
      {
        id: picnicId,
        name: "🧺 Saturday picnic",
        isPersonal: false,
        balanceCents: 1850,
      },
    ]);
  });

  it("logs why a balance couldn't be loaded, so the fallback doesn't hide the failure", async () => {
    const error = new Error("database unavailable");
    groupService.listGroups.mockResolvedValue([dorm]);
    balanceService.getGroupPeriod.mockRejectedValue(error);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await listSidebarGroups(ana);

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0]).toContain(error);
    expect(String(consoleError.mock.calls[0][0])).toContain(dormId);
    consoleError.mockRestore();
  });

  it("fails when the groups themselves can't be loaded", async () => {
    groupService.listGroups.mockRejectedValue(
      new Error("database unavailable"),
    );

    await expect(listSidebarGroups(ana)).rejects.toThrow(
      "database unavailable",
    );
  });
});
