// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  countOpenListItems,
  deleteOpenListItem,
  findListItem,
  insertListItem,
  listListItems,
  updateOpenListItem,
} from "./list-items";

type Result = { data: unknown; error: { message: string } | null };

const queries: { method: string; args: unknown[] }[] = [];
let result: Result;

function queryBuilder() {
  const builder: Record<string, unknown> = {};
  for (const method of [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "in",
    "lte",
    "order",
  ]) {
    builder[method] = (...args: unknown[]) => {
      queries.push({ method, args });
      return builder;
    };
  }
  for (const method of ["single", "maybeSingle"]) {
    builder[method] = async () => {
      queries.push({ method, args: [] });
      return result;
    };
  }
  // A list query is awaited directly.
  builder.then = (resolve: (value: Result) => unknown) => resolve(result);
  return builder;
}

vi.mock("./client", () => ({
  getDb: () => ({
    from: (table: string) => {
      queries.push({ method: "from", args: [table] });
      return queryBuilder();
    },
  }),
}));

const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const anaId = "6f1c2d4e-1111-4222-8333-944455556666";
const itemId = "9c8d7e6f-4444-4555-8666-c77788889999";

const row = {
  id: itemId,
  group_id: groupId,
  title: "🥛 Milk",
  quantity: 2,
  note: "Oat",
  estimated_cents: 450,
  status: "open",
  added_by: anaId,
  completed_by: null,
  completed_at: null,
  created_at: "2026-11-04T18:00:00+00:00",
};

const item = {
  id: itemId,
  groupId,
  title: "🥛 Milk",
  quantity: 2,
  note: "Oat",
  estimatedCents: 450,
  status: "open",
  addedBy: anaId,
  completedBy: null,
  completedAt: null,
  createdAt: "2026-11-04T18:00:00+00:00",
};

function called(method: string) {
  return queries.filter((query) => query.method === method);
}

beforeEach(() => {
  queries.length = 0;
  result = { data: row, error: null };
});

describe("insertListItem", () => {
  it("writes snake_case columns and returns the item in camelCase", async () => {
    const added = await insertListItem({
      groupId,
      title: "🥛 Milk",
      quantity: 2,
      note: "Oat",
      estimatedCents: 450,
      addedBy: anaId,
    });

    expect(called("from")).toEqual([{ method: "from", args: ["list_items"] }]);
    expect(called("insert")[0].args[0]).toEqual({
      group_id: groupId,
      title: "🥛 Milk",
      quantity: 2,
      note: "Oat",
      estimated_cents: 450,
      added_by: anaId,
    });
    expect(added).toEqual(item);
  });

  it("throws when the database rejects it", async () => {
    result = { data: null, error: { message: "boom" } };

    await expect(
      insertListItem({
        groupId,
        title: "Milk",
        quantity: null,
        note: null,
        estimatedCents: null,
        addedBy: anaId,
      }),
    ).rejects.toThrow("Could not add the list item: boom");
  });
});

describe("listListItems", () => {
  it("maps every row to camelCase", async () => {
    result = { data: [row], error: null };

    expect(await listListItems(groupId, null)).toEqual([item]);
  });

  it("puts open items before done ones, newest first in each", async () => {
    result = { data: [], error: null };

    await listListItems(groupId, null);

    expect(called("order").map((query) => query.args)).toEqual([
      ["status", { ascending: false }],
      ["created_at", { ascending: false }],
    ]);
  });

  it("shows a former member only items added up to when they left", async () => {
    result = { data: [], error: null };

    await listListItems(groupId, "2026-11-01T00:00:00Z");

    expect(called("lte")).toEqual([
      { method: "lte", args: ["created_at", "2026-11-01T00:00:00Z"] },
    ]);
  });

  it("shows a current member everything", async () => {
    result = { data: [], error: null };

    await listListItems(groupId, null);

    expect(called("lte")).toEqual([]);
  });

  it("throws when the query fails", async () => {
    result = { data: null, error: { message: "boom" } };

    await expect(listListItems(groupId, null)).rejects.toThrow(
      "Could not load the list: boom",
    );
  });
});

describe("findListItem", () => {
  it("looks the item up within its group", async () => {
    expect(await findListItem(groupId, itemId)).toEqual(item);
    expect(called("eq").map((query) => query.args)).toEqual([
      ["group_id", groupId],
      ["id", itemId],
    ]);
  });

  it("is null when there is no such item", async () => {
    result = { data: null, error: null };

    expect(await findListItem(groupId, itemId)).toBeNull();
  });

  it("throws when the query fails", async () => {
    result = { data: null, error: { message: "boom" } };

    await expect(findListItem(groupId, itemId)).rejects.toThrow(
      "Could not load the list item: boom",
    );
  });
});

describe("updateOpenListItem", () => {
  it("changes only the fields sent, and only while the item is open", async () => {
    await updateOpenListItem(groupId, itemId, {
      title: "Bread",
      estimatedCents: null,
    });

    expect(called("update")[0].args[0]).toEqual({
      title: "Bread",
      estimated_cents: null,
    });
    expect(called("eq").map((query) => query.args)).toEqual([
      ["group_id", groupId],
      ["id", itemId],
      ["status", "open"],
    ]);
  });

  it("returns the updated item", async () => {
    expect(await updateOpenListItem(groupId, itemId, { quantity: 2 })).toEqual(
      item,
    );
  });

  it("is null when no open item matched", async () => {
    result = { data: null, error: null };

    expect(
      await updateOpenListItem(groupId, itemId, { quantity: 2 }),
    ).toBeNull();
  });

  it("throws when the update fails", async () => {
    result = { data: null, error: { message: "boom" } };

    await expect(
      updateOpenListItem(groupId, itemId, { quantity: 2 }),
    ).rejects.toThrow("Could not update the list item: boom");
  });
});

describe("deleteOpenListItem", () => {
  it("deletes only an open item in the group", async () => {
    result = { data: [{ id: itemId }], error: null };

    expect(await deleteOpenListItem(groupId, itemId)).toBe(true);
    expect(called("delete")).toHaveLength(1);
    expect(called("eq").map((query) => query.args)).toEqual([
      ["group_id", groupId],
      ["id", itemId],
      ["status", "open"],
    ]);
  });

  it("is false when no open item matched", async () => {
    result = { data: [], error: null };

    expect(await deleteOpenListItem(groupId, itemId)).toBe(false);
  });

  it("throws when the delete fails", async () => {
    result = { data: null, error: { message: "boom" } };

    await expect(deleteOpenListItem(groupId, itemId)).rejects.toThrow(
      "Could not delete the list item: boom",
    );
  });
});

describe("countOpenListItems", () => {
  const otherGroupId = "1c8f9b21-3333-4444-8555-b66677778888";

  it("counts the open items of each group, and gives 0 to a group with none", async () => {
    result = {
      data: [
        { group_id: groupId },
        { group_id: groupId },
        { group_id: otherGroupId },
      ],
      error: null,
    };
    const thirdGroupId = "2d9a0c32-4444-4555-8666-c77788889999";

    const counts = await countOpenListItems([
      groupId,
      otherGroupId,
      thirdGroupId,
    ]);

    expect(counts).toEqual(
      new Map([
        [groupId, 2],
        [otherGroupId, 1],
        [thirdGroupId, 0],
      ]),
    );
    expect(called("from")[0].args).toEqual(["list_items"]);
    expect(called("select")[0].args).toEqual(["group_id"]);
    expect(called("eq").map((query) => query.args)).toEqual([
      ["status", "open"],
    ]);
    expect(called("in").map((query) => query.args)).toEqual([
      ["group_id", [groupId, otherGroupId, thirdGroupId]],
    ]);
  });

  it("asks the database nothing for no groups", async () => {
    expect(await countOpenListItems([])).toEqual(new Map());
    expect(queries).toHaveLength(0);
  });

  it("throws when the query fails", async () => {
    result = { data: null, error: { message: "boom" } };

    await expect(countOpenListItems([groupId])).rejects.toThrow(
      "Could not count the open list items: boom",
    );
  });
});
