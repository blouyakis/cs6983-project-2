// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Group } from "@/lib/db/group-members";
import type { ListItem } from "@/lib/db/list-items";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/http/errors";
import {
  addListItem,
  completeListItem,
  editListItem,
  listGroupListItems,
  removeListItem,
  reopenListItem,
} from "./list-item-service";

const access = vi.hoisted(() => ({ requireGroupAccess: vi.fn() }));
vi.mock("./access", () => access);

const listItems = vi.hoisted(() => ({
  insertListItem: vi.fn(),
  listListItems: vi.fn(),
  findListItem: vi.fn(),
  updateOpenListItem: vi.fn(),
  deleteOpenListItem: vi.fn(),
  completeOpenListItem: vi.fn(),
  reopenDoneListItem: vi.fn(),
  listCheckOffExpenses: vi.fn(),
}));
vi.mock("@/lib/db/list-items", () => listItems);

const members = vi.hoisted(() => ({ listCurrentMemberWeights: vi.fn() }));
vi.mock("@/lib/db/group-members", () => members);

const settlements = vi.hoisted(() => ({ findOpenSettlement: vi.fn() }));
vi.mock("@/lib/db/settlements", () => settlements);

const ana = "6f1c2d4e-1111-4222-8333-944455556666";
const sam = "7a2d3e5f-1111-4222-8333-944455556666";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const itemId = "1d5a6182-3333-4444-8555-b66677778888";

const flat: Group = {
  id: groupId,
  name: "Flat",
  isPersonal: false,
  createdBy: ana,
  archivedAt: null,
  createdAt: "2026-10-01T09:00:00+00:00",
};

const milk: ListItem = {
  id: itemId,
  groupId,
  title: "Milk",
  quantity: null,
  note: null,
  estimatedCents: null,
  status: "open",
  addedBy: ana,
  completedBy: null,
  completedAt: null,
  expenseId: null,
  createdAt: "2026-11-04T18:00:00+00:00",
};

const doneMilk: ListItem = {
  ...milk,
  status: "done",
  completedBy: ana,
  completedAt: "2026-11-04T19:00:00+00:00",
  expenseId: null,
};

const newItem = {
  title: "Milk",
  quantity: null,
  note: null,
  estimatedCents: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  access.requireGroupAccess.mockResolvedValue({ group: flat, readUntil: null });
});

describe("addListItem", () => {
  it("needs write access to the group", async () => {
    listItems.insertListItem.mockResolvedValue(milk);

    await addListItem(ana, groupId, newItem);

    expect(access.requireGroupAccess).toHaveBeenCalledWith(
      ana,
      groupId,
      "write",
    );
  });

  it("records the current user as the one who added it", async () => {
    listItems.insertListItem.mockResolvedValue(milk);

    expect(await addListItem(ana, groupId, newItem)).toEqual(milk);
    expect(listItems.insertListItem).toHaveBeenCalledWith({
      groupId,
      addedBy: ana,
      ...newItem,
    });
  });

  it("passes on a 403 for a former member or an archived group without writing", async () => {
    access.requireGroupAccess.mockRejectedValue(new ForbiddenError());

    await expect(addListItem(ana, groupId, newItem)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(listItems.insertListItem).not.toHaveBeenCalled();
  });
});

describe("listGroupListItems", () => {
  it("lists a current member's items without a time limit", async () => {
    listItems.listListItems.mockResolvedValue([milk]);

    expect(await listGroupListItems(ana, groupId)).toEqual([
      { ...milk, costCents: null, expenseLock: null },
    ]);
    expect(access.requireGroupAccess).toHaveBeenCalledWith(
      ana,
      groupId,
      "read",
    );
    expect(listItems.listListItems).toHaveBeenCalledWith(groupId, null);
  });

  it("limits a former member to what was added before they left", async () => {
    access.requireGroupAccess.mockResolvedValue({
      group: flat,
      readUntil: "2026-11-01T00:00:00Z",
    });
    listItems.listListItems.mockResolvedValue([]);

    await listGroupListItems(ana, groupId);

    expect(listItems.listListItems).toHaveBeenCalledWith(
      groupId,
      "2026-11-01T00:00:00Z",
    );
  });

  it("passes on a 403 for someone who isn't in the group", async () => {
    access.requireGroupAccess.mockRejectedValue(new ForbiddenError());

    await expect(listGroupListItems(ana, groupId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(listItems.listListItems).not.toHaveBeenCalled();
  });

  describe("a done item with an expense (#12)", () => {
    const expenseId = "5e4f3a2b-5555-4666-8777-d88899990000";
    const paidMilk: ListItem = { ...doneMilk, expenseId };

    it("carries the actual cost, and no lock while the expense can be deleted", async () => {
      listItems.listListItems.mockResolvedValue([paidMilk, milk]);
      listItems.listCheckOffExpenses.mockResolvedValue(
        new Map([
          [
            expenseId,
            {
              amountCents: 1234,
              settled: false,
              createdAt: "2026-11-04T19:00:00+00:00",
            },
          ],
        ]),
      );
      settlements.findOpenSettlement.mockResolvedValue(null);

      expect(await listGroupListItems(ana, groupId)).toEqual([
        { ...paidMilk, costCents: 1234, expenseLock: null },
        { ...milk, costCents: null, expenseLock: null },
      ]);
      expect(listItems.listCheckOffExpenses).toHaveBeenCalledWith([expenseId]);
    });

    it("says the expense is settled", async () => {
      listItems.listListItems.mockResolvedValue([paidMilk]);
      listItems.listCheckOffExpenses.mockResolvedValue(
        new Map([
          [
            expenseId,
            {
              amountCents: 1234,
              settled: true,
              createdAt: "2026-11-04T19:00:00+00:00",
            },
          ],
        ]),
      );
      settlements.findOpenSettlement.mockResolvedValue(null);

      const [listed] = await listGroupListItems(ana, groupId);

      expect(listed.expenseLock).toBe("settled");
    });

    it("says the expense is in the open settle-up when it was created before it started (#86)", async () => {
      listItems.listListItems.mockResolvedValue([paidMilk]);
      listItems.listCheckOffExpenses.mockResolvedValue(
        new Map([
          [
            expenseId,
            {
              amountCents: 1234,
              settled: false,
              createdAt: "2026-11-04T19:00:00+00:00",
            },
          ],
        ]),
      );
      settlements.findOpenSettlement.mockResolvedValue({
        startedAt: "2026-11-05T09:00:00+00:00",
      });

      const [listed] = await listGroupListItems(ana, groupId);

      expect(listed.expenseLock).toBe("settle-up");
    });

    it("has no cost when the expense was deleted on its own", async () => {
      listItems.listListItems.mockResolvedValue([doneMilk]);

      const [listed] = await listGroupListItems(ana, groupId);

      expect(listed).toEqual({
        ...doneMilk,
        costCents: null,
        expenseLock: null,
      });
      expect(listItems.listCheckOffExpenses).not.toHaveBeenCalled();
      expect(settlements.findOpenSettlement).not.toHaveBeenCalled();
    });
  });
});

describe("editListItem", () => {
  it("needs write access, then edits the open item", async () => {
    const edited = { ...milk, estimatedCents: 450 };
    listItems.updateOpenListItem.mockResolvedValue(edited);

    expect(
      await editListItem(ana, groupId, itemId, { estimatedCents: 450 }),
    ).toEqual(edited);
    expect(access.requireGroupAccess).toHaveBeenCalledWith(
      ana,
      groupId,
      "write",
    );
    expect(listItems.updateOpenListItem).toHaveBeenCalledWith(groupId, itemId, {
      estimatedCents: 450,
    });
  });

  it("is a 409 for a done item, which has to be unchecked first", async () => {
    listItems.updateOpenListItem.mockResolvedValue(null);
    listItems.findListItem.mockResolvedValue(doneMilk);

    await expect(
      editListItem(ana, groupId, itemId, { title: "Bread" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("is a 404 for an item that isn't in the group", async () => {
    listItems.updateOpenListItem.mockResolvedValue(null);
    listItems.findListItem.mockResolvedValue(null);

    await expect(
      editListItem(ana, groupId, itemId, { title: "Bread" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("passes on a 403 for a former member or an archived group without writing", async () => {
    access.requireGroupAccess.mockRejectedValue(new ForbiddenError());

    await expect(
      editListItem(ana, groupId, itemId, { title: "Bread" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(listItems.updateOpenListItem).not.toHaveBeenCalled();
  });
});

describe("removeListItem", () => {
  it("needs write access, then deletes the open item", async () => {
    listItems.deleteOpenListItem.mockResolvedValue(true);

    await removeListItem(ana, groupId, itemId);

    expect(access.requireGroupAccess).toHaveBeenCalledWith(
      ana,
      groupId,
      "write",
    );
    expect(listItems.deleteOpenListItem).toHaveBeenCalledWith(groupId, itemId);
  });

  it("is a 409 for a done item, which has to be unchecked first", async () => {
    listItems.deleteOpenListItem.mockResolvedValue(false);
    listItems.findListItem.mockResolvedValue(doneMilk);

    await expect(removeListItem(ana, groupId, itemId)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("is a 404 for an item that isn't in the group", async () => {
    listItems.deleteOpenListItem.mockResolvedValue(false);
    listItems.findListItem.mockResolvedValue(null);

    await expect(removeListItem(ana, groupId, itemId)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("passes on a 403 for a former member or an archived group without deleting", async () => {
    access.requireGroupAccess.mockRejectedValue(new ForbiddenError());

    await expect(removeListItem(ana, groupId, itemId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(listItems.deleteOpenListItem).not.toHaveBeenCalled();
  });
});

describe("completeListItem", () => {
  const evenly = {
    amountCents: 1234,
    mode: "even" as const,
    sharedBy: [ana, sam],
  };

  beforeEach(() => {
    members.listCurrentMemberWeights.mockResolvedValue([
      { userId: ana, weight: 1 },
      { userId: sam, weight: 1 },
    ]);
  });

  it("needs write access, then checks the item off and returns it", async () => {
    listItems.completeOpenListItem.mockResolvedValue(true);
    listItems.findListItem.mockResolvedValue(doneMilk);

    expect(await completeListItem(ana, groupId, itemId, evenly)).toEqual(
      doneMilk,
    );
    expect(access.requireGroupAccess).toHaveBeenCalledWith(
      ana,
      groupId,
      "write",
    );
  });

  it("splits the cost on the server, with the user as the payer (#8)", async () => {
    listItems.completeOpenListItem.mockResolvedValue(true);
    listItems.findListItem.mockResolvedValue(doneMilk);

    await completeListItem(ana, groupId, itemId, evenly);

    expect(listItems.completeOpenListItem).toHaveBeenCalledWith(
      groupId,
      itemId,
      ana,
      { amountCents: 1234, shares: { [ana]: 617, [sam]: 617 } },
    );
  });

  it("gives the leftover cent to the payer", async () => {
    listItems.completeOpenListItem.mockResolvedValue(true);
    listItems.findListItem.mockResolvedValue(doneMilk);

    await completeListItem(ana, groupId, itemId, {
      ...evenly,
      amountCents: 1001,
    });

    expect(listItems.completeOpenListItem.mock.calls[0][3]).toEqual({
      amountCents: 1001,
      shares: { [ana]: 501, [sam]: 500 },
    });
  });

  it("takes custom amounts as they were typed", async () => {
    listItems.completeOpenListItem.mockResolvedValue(true);
    listItems.findListItem.mockResolvedValue(doneMilk);

    await completeListItem(ana, groupId, itemId, {
      amountCents: 1234,
      mode: "custom",
      sharedBy: [ana, sam],
      amountsCents: { [ana]: 1000, [sam]: 234 },
    });

    expect(listItems.completeOpenListItem.mock.calls[0][3]).toEqual({
      amountCents: 1234,
      shares: { [ana]: 1000, [sam]: 234 },
    });
  });

  it("is a 400 when custom amounts don't add up to the cost", async () => {
    await expect(
      completeListItem(ana, groupId, itemId, {
        amountCents: 1234,
        mode: "custom",
        sharedBy: [ana, sam],
        amountsCents: { [ana]: 1000, [sam]: 1 },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(listItems.completeOpenListItem).not.toHaveBeenCalled();
  });

  it("is a 400 when someone sharing it isn't a current member", async () => {
    members.listCurrentMemberWeights.mockResolvedValue([
      { userId: ana, weight: 1 },
    ]);

    const error = await completeListItem(ana, groupId, itemId, evenly).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).fields).toHaveProperty("sharedBy");
    expect(listItems.completeOpenListItem).not.toHaveBeenCalled();
  });

  it("writes no shares for an item that cost nothing", async () => {
    listItems.completeOpenListItem.mockResolvedValue(true);
    listItems.findListItem.mockResolvedValue(doneMilk);

    await completeListItem(ana, groupId, itemId, {
      amountCents: 0,
      mode: "even",
      sharedBy: [ana],
    });

    expect(listItems.completeOpenListItem.mock.calls[0][3]).toEqual({
      amountCents: 0,
      shares: {},
    });
  });

  it("logs a personal expense that is all the owner's, whatever split was sent (#23)", async () => {
    access.requireGroupAccess.mockResolvedValue({
      group: { ...flat, isPersonal: true },
      readUntil: null,
    });
    listItems.completeOpenListItem.mockResolvedValue(true);
    listItems.findListItem.mockResolvedValue(doneMilk);

    await completeListItem(ana, groupId, itemId, {
      amountCents: 500,
      mode: "even",
      sharedBy: [ana, sam],
    });

    expect(listItems.completeOpenListItem.mock.calls[0][3]).toEqual({
      amountCents: 500,
      shares: { [ana]: 500 },
    });
    expect(members.listCurrentMemberWeights).not.toHaveBeenCalled();
  });

  it("is a 409 for an item that is already done", async () => {
    listItems.completeOpenListItem.mockResolvedValue(false);
    listItems.findListItem.mockResolvedValue(doneMilk);

    await expect(
      completeListItem(ana, groupId, itemId, evenly),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("is a 404 for an item that isn't in the group", async () => {
    listItems.completeOpenListItem.mockResolvedValue(false);
    listItems.findListItem.mockResolvedValue(null);

    await expect(
      completeListItem(ana, groupId, itemId, evenly),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("passes on a 403 for a former member or an archived group without writing", async () => {
    access.requireGroupAccess.mockRejectedValue(new ForbiddenError());

    await expect(
      completeListItem(ana, groupId, itemId, evenly),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(listItems.completeOpenListItem).not.toHaveBeenCalled();
  });
});

describe("reopenListItem", () => {
  it("needs write access, then unchecks the item and returns it", async () => {
    listItems.reopenDoneListItem.mockResolvedValue(true);
    listItems.findListItem.mockResolvedValue(milk);

    expect(await reopenListItem(ana, groupId, itemId)).toEqual(milk);
    expect(access.requireGroupAccess).toHaveBeenCalledWith(
      ana,
      groupId,
      "write",
    );
    expect(listItems.reopenDoneListItem).toHaveBeenCalledWith(
      groupId,
      itemId,
      ana,
    );
  });

  it("is a 409 for an item that is already open", async () => {
    listItems.reopenDoneListItem.mockResolvedValue(false);
    listItems.findListItem.mockResolvedValue(milk);

    await expect(reopenListItem(ana, groupId, itemId)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("is a 404 for an item that isn't in the group", async () => {
    listItems.reopenDoneListItem.mockResolvedValue(false);
    listItems.findListItem.mockResolvedValue(null);

    await expect(reopenListItem(ana, groupId, itemId)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("passes on the database's 403 for someone who didn't check it off", async () => {
    listItems.reopenDoneListItem.mockRejectedValue(new ForbiddenError());

    await expect(reopenListItem(ana, groupId, itemId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("passes on a 403 for a former member or an archived group without writing", async () => {
    access.requireGroupAccess.mockRejectedValue(new ForbiddenError());

    await expect(reopenListItem(ana, groupId, itemId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(listItems.reopenDoneListItem).not.toHaveBeenCalled();
  });
});
