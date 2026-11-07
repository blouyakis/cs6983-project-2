// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Expense } from "@/lib/db/expenses";
import type { ListItem } from "@/lib/db/list-items";
import type { GroupSummary } from "./group-service";
import { getOverview, listGroupStandings } from "./overview-service";

const groupService = vi.hoisted(() => ({ listGroups: vi.fn() }));
vi.mock("./group-service", () => groupService);

const balanceService = vi.hoisted(() => ({ getGroupPeriod: vi.fn() }));
vi.mock("./balance-service", () => balanceService);

const expenseService = vi.hoisted(() => ({ listGroupExpenses: vi.fn() }));
vi.mock("./expense-service", () => expenseService);

const listItemService = vi.hoisted(() => ({ listGroupListItems: vi.fn() }));
vi.mock("./list-item-service", () => listItemService);

const listItems = vi.hoisted(() => ({ countOpenListItems: vi.fn() }));
vi.mock("@/lib/db/list-items", () => listItems);

const ana = "6f1c2d4e-1111-4222-8333-944455556666";
const sam = "7a2d3e5f-1111-4222-8333-944455556666";
const personalId = "0a1b2c3d-1111-4222-8333-944455550001";
const dormId = "0a1b2c3d-1111-4222-8333-944455550002";
const picnicId = "0a1b2c3d-1111-4222-8333-944455550003";
const leftId = "0a1b2c3d-1111-4222-8333-944455550004";

const now = new Date("2026-11-05T12:00:00Z");

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

const personal = summary(personalId, "Personal space", {
  isPersonal: true,
  members: [{ userId: ana, name: "Ana", defaultShareWeight: 1 }],
});
const dorm = summary(dormId, "🏠 Dorm 4B");
const picnic = summary(picnicId, "🧺 Saturday picnic");
const left = summary(leftId, "🍝 Date nights", {
  readOnly: true,
  leftAt: "2026-09-02T15:00:00+00:00",
});

function expense(spentOn: string, amountCents: number): Expense {
  return {
    id: `expense-${spentOn}-${amountCents}`,
    groupId: personalId,
    description: "Something",
    amountCents,
    payerId: ana,
    spentOn,
    settled: false,
    createdAt: `${spentOn}T10:00:00+00:00`,
    editedAt: null,
    shares: [{ userId: ana, shareCents: amountCents }],
  };
}

function item(
  title: string,
  estimatedCents: number | null,
  status: "open" | "done" = "open",
): ListItem {
  return {
    id: `item-${title}`,
    groupId: personalId,
    title,
    quantity: null,
    note: null,
    estimatedCents,
    status,
    addedBy: ana,
    completedBy: status === "done" ? ana : null,
    completedAt: status === "done" ? "2026-11-03T10:00:00+00:00" : null,
    createdAt: "2026-11-01T10:00:00+00:00",
  };
}

// A group period in which the user's balance is `balanceCents` and their
// share of its expenses is `shareCents`.
function period(balanceCents: number, shareCents: number) {
  return {
    balances: [
      { userId: ana, balanceCents },
      { userId: sam, balanceCents: -balanceCents },
    ],
    expenses: [
      {
        payerId: sam,
        amountCents: shareCents * 2,
        shares: [
          { userId: ana, shareCents },
          { userId: sam, shareCents },
        ],
      },
    ],
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  groupService.listGroups.mockResolvedValue([personal]);
  expenseService.listGroupExpenses.mockResolvedValue([]);
  listItemService.listGroupListItems.mockResolvedValue([]);
  listItems.countOpenListItems.mockImplementation(async (ids: string[]) => {
    return new Map(ids.map((id) => [id, 0]));
  });
});

describe("getOverview", () => {
  it("gives a new user with only a personal space no groups and $0.00 everywhere", async () => {
    const overview = await getOverview(ana, now);

    expect(overview).toEqual({
      netCents: 0,
      owingCents: 0,
      owedCents: 0,
      groupShareThisPeriodCents: 0,
      personal: {
        group: personal,
        spentThisMonthCents: 0,
        openEstimateCents: 0,
        openItems: [],
      },
      groups: [],
      readOnlyGroups: [],
    });
    expect(balanceService.getGroupPeriod).not.toHaveBeenCalled();
  });

  it("nets −883 in one group and +500 in another to −383, owing $8.83 and owed $5.00", async () => {
    groupService.listGroups.mockResolvedValue([personal, dorm, picnic]);
    balanceService.getGroupPeriod.mockImplementation(
      async (_userId: string, groupId: string) =>
        groupId === dormId ? period(-883, 5421) : period(500, 1850),
    );

    const overview = await getOverview(ana, now);

    expect(overview.netCents).toBe(-383);
    expect(overview.owingCents).toBe(883);
    expect(overview.owedCents).toBe(500);
    expect(overview.groupShareThisPeriodCents).toBe(5421 + 1850);
  });

  it("gives each current group the user's balance, share this period and open items", async () => {
    groupService.listGroups.mockResolvedValue([personal, dorm, picnic]);
    balanceService.getGroupPeriod.mockImplementation(
      async (_userId: string, groupId: string) =>
        groupId === dormId ? period(-3100, 5421) : period(1850, 1850),
    );
    listItems.countOpenListItems.mockResolvedValue(
      new Map([
        [dormId, 3],
        [picnicId, 2],
      ]),
    );

    const overview = await getOverview(ana, now);

    expect(overview.groups).toEqual([
      {
        ...dorm,
        balanceCents: -3100,
        shareThisPeriodCents: 5421,
        openItemCount: 3,
      },
      {
        ...picnic,
        balanceCents: 1850,
        shareThisPeriodCents: 1850,
        openItemCount: 2,
      },
    ]);
    expect(balanceService.getGroupPeriod).toHaveBeenCalledWith(ana, dormId);
    expect(balanceService.getGroupPeriod).toHaveBeenCalledWith(ana, picnicId);
    expect(listItems.countOpenListItems).toHaveBeenCalledWith([
      dormId,
      picnicId,
    ]);
  });

  it("lists groups the user left or that were archived apart, and leaves them out of the net", async () => {
    groupService.listGroups.mockResolvedValue([personal, dorm, left]);
    balanceService.getGroupPeriod.mockResolvedValue(period(-500, 500));

    const overview = await getOverview(ana, now);

    expect(overview.groups.map((group) => group.id)).toEqual([dormId]);
    expect(overview.readOnlyGroups).toEqual([left]);
    expect(overview.netCents).toBe(-500);
    expect(balanceService.getGroupPeriod).toHaveBeenCalledTimes(1);
  });

  it("counts as personal spending only expenses dated this month in the personal space", async () => {
    expenseService.listGroupExpenses.mockResolvedValue([
      expense("2026-11-01", 3500),
      expense("2026-11-04", 6100),
      expense("2026-10-31", 9900),
      expense("2025-11-05", 1200),
    ]);

    const overview = await getOverview(ana, now);

    expect(expenseService.listGroupExpenses).toHaveBeenCalledWith(
      ana,
      personalId,
    );
    expect(overview.personal?.spentThisMonthCents).toBe(9600);
  });

  it("leaves the personal space out of the net and of the share in groups", async () => {
    groupService.listGroups.mockResolvedValue([personal, dorm]);
    balanceService.getGroupPeriod.mockResolvedValue(period(0, 0));
    expenseService.listGroupExpenses.mockResolvedValue([
      expense("2026-11-02", 4000),
    ]);

    const overview = await getOverview(ana, now);

    expect(overview.netCents).toBe(0);
    expect(overview.groupShareThisPeriodCents).toBe(0);
    expect(balanceService.getGroupPeriod).not.toHaveBeenCalledWith(
      ana,
      personalId,
    );
  });

  it("shows the personal space's open items and their estimated total", async () => {
    const haircut = item("💇 Haircut", 3500);
    const stamps = item("📮 Stamps", 400);
    const card = item("Birthday card", null);
    listItemService.listGroupListItems.mockResolvedValue([
      haircut,
      stamps,
      card,
      item("🥛 Milk", 450, "done"),
    ]);

    const overview = await getOverview(ana, now);

    expect(listItemService.listGroupListItems).toHaveBeenCalledWith(
      ana,
      personalId,
    );
    expect(overview.personal?.openItems).toEqual([haircut, stamps, card]);
    expect(overview.personal?.openEstimateCents).toBe(3900);
  });

  it("has no personal part when the user has no personal space", async () => {
    groupService.listGroups.mockResolvedValue([dorm]);
    balanceService.getGroupPeriod.mockResolvedValue(period(0, 0));

    const overview = await getOverview(ana, now);

    expect(overview.personal).toBeNull();
    expect(expenseService.listGroupExpenses).not.toHaveBeenCalled();
    expect(listItemService.listGroupListItems).not.toHaveBeenCalled();
  });
});

describe("listGroupStandings", () => {
  it("gives every current shared group its balance, share and open items, and nothing else", async () => {
    groupService.listGroups.mockResolvedValue([personal, dorm, left]);
    balanceService.getGroupPeriod.mockResolvedValue(period(-883, 617));
    listItems.countOpenListItems.mockResolvedValue(new Map([[dormId, 1]]));

    const standings = await listGroupStandings(ana);

    expect(standings).toEqual([
      {
        ...dorm,
        balanceCents: -883,
        shareThisPeriodCents: 617,
        openItemCount: 1,
      },
    ]);
  });

  it("uses the groups it is given instead of loading them again", async () => {
    balanceService.getGroupPeriod.mockResolvedValue(period(1850, 0));

    const standings = await listGroupStandings(ana, [personal, picnic]);

    expect(groupService.listGroups).not.toHaveBeenCalled();
    expect(standings.map((group) => group.balanceCents)).toEqual([1850]);
  });
});
