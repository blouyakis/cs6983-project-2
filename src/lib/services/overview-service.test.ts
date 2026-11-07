// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ListItem } from "@/lib/db/list-items";
import type { GroupSummary } from "./group-service";
import { getOverview, listGroupStandings } from "./overview-service";

const groupService = vi.hoisted(() => ({ listGroups: vi.fn() }));
vi.mock("./group-service", () => groupService);

const balanceService = vi.hoisted(() => ({ getGroupPeriod: vi.fn() }));
vi.mock("./balance-service", () => balanceService);

const expenseService = vi.hoisted(() => ({
  listGroupExpensesSpentBetween: vi.fn(),
}));
vi.mock("./expense-service", () => expenseService);

const listItemService = vi.hoisted(() => ({
  listGroupOpenListItems: vi.fn(),
}));
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

function expense(spentOn: string, amountCents: number) {
  return { spentOn, amountCents };
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
  expenseService.listGroupExpensesSpentBetween.mockResolvedValue([]);
  listItemService.listGroupOpenListItems.mockResolvedValue([]);
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

  it("asks only for this month's personal expenses and adds them up", async () => {
    expenseService.listGroupExpensesSpentBetween.mockResolvedValue([
      expense("2026-11-01", 3500),
      expense("2026-11-04", 6100),
    ]);

    const overview = await getOverview(ana, now);

    expect(expenseService.listGroupExpensesSpentBetween).toHaveBeenCalledWith(
      ana,
      personalId,
      "2026-11-01",
      "2026-12-01",
    );
    expect(overview.personal?.spentThisMonthCents).toBe(9600);
  });

  it("asks for January of the next year's range in December", async () => {
    await getOverview(ana, new Date("2026-12-31T23:00:00Z"));

    expect(expenseService.listGroupExpensesSpentBetween).toHaveBeenCalledWith(
      ana,
      personalId,
      "2026-12-01",
      "2027-01-01",
    );
  });

  it("leaves the personal space out of the net and of the share in groups", async () => {
    groupService.listGroups.mockResolvedValue([personal, dorm]);
    balanceService.getGroupPeriod.mockResolvedValue(period(0, 0));
    expenseService.listGroupExpensesSpentBetween.mockResolvedValue([
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

  it("asks only for the personal space's open items and shows their estimated total", async () => {
    const haircut = item("💇 Haircut", 3500);
    const stamps = item("📮 Stamps", 400);
    const card = item("Birthday card", null);
    listItemService.listGroupOpenListItems.mockResolvedValue([
      haircut,
      stamps,
      card,
    ]);

    const overview = await getOverview(ana, now);

    expect(listItemService.listGroupOpenListItems).toHaveBeenCalledWith(
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
    expect(expenseService.listGroupExpensesSpentBetween).not.toHaveBeenCalled();
    expect(listItemService.listGroupOpenListItems).not.toHaveBeenCalled();
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
