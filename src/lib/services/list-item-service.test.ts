// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Group } from "@/lib/db/group-members";
import type { ListItem } from "@/lib/db/list-items";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/http/errors";
import {
  addListItem,
  editListItem,
  listGroupListItems,
  listGroupOpenListItems,
  removeListItem,
} from "./list-item-service";

const access = vi.hoisted(() => ({ requireGroupAccess: vi.fn() }));
vi.mock("./access", () => access);

const listItems = vi.hoisted(() => ({
  insertListItem: vi.fn(),
  listListItems: vi.fn(),
  listOpenListItems: vi.fn(),
  findListItem: vi.fn(),
  updateOpenListItem: vi.fn(),
  deleteOpenListItem: vi.fn(),
}));
vi.mock("@/lib/db/list-items", () => listItems);

const ana = "6f1c2d4e-1111-4222-8333-944455556666";
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
  createdAt: "2026-11-04T18:00:00+00:00",
};

const doneMilk: ListItem = {
  ...milk,
  status: "done",
  completedBy: ana,
  completedAt: "2026-11-04T19:00:00+00:00",
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

    expect(await listGroupListItems(ana, groupId)).toEqual([milk]);
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

describe("listGroupOpenListItems", () => {
  it("gives a current member the open items without a time limit", async () => {
    listItems.listOpenListItems.mockResolvedValue([milk]);

    expect(await listGroupOpenListItems(ana, groupId)).toEqual([milk]);
    expect(access.requireGroupAccess).toHaveBeenCalledWith(
      ana,
      groupId,
      "read",
    );
    expect(listItems.listOpenListItems).toHaveBeenCalledWith(groupId, null);
  });

  it("limits a former member to what was added before they left", async () => {
    access.requireGroupAccess.mockResolvedValue({
      group: flat,
      readUntil: "2026-11-01T00:00:00Z",
    });
    listItems.listOpenListItems.mockResolvedValue([]);

    await listGroupOpenListItems(ana, groupId);

    expect(listItems.listOpenListItems).toHaveBeenCalledWith(
      groupId,
      "2026-11-01T00:00:00Z",
    );
  });

  it("passes on a 403 for someone who isn't in the group", async () => {
    access.requireGroupAccess.mockRejectedValue(new ForbiddenError());

    await expect(listGroupOpenListItems(ana, groupId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(listItems.listOpenListItems).not.toHaveBeenCalled();
  });
});
