// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, ForbiddenError } from "@/lib/http/errors";
import {
  completeOpenListItem,
  countOpenListItems,
  deleteOpenListItem,
  findListItem,
  insertListItem,
  listListItems,
  reopenDoneListItem,
  updateOpenListItem,
} from "./list-items";

type Result = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

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
    rpc: async (fn: string, args: unknown) => {
      queries.push({ method: "rpc", args: [fn, args] });
      return result;
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

describe("completeOpenListItem", () => {
  const expenseId = "5e4f3a2b-5555-4666-8777-d88899990000";

  it("checks the item off with the shares as a JSON object, not a string", async () => {
    result = { data: expenseId, error: null };

    expect(
      await completeOpenListItem(groupId, itemId, anaId, {
        amountCents: 1234,
        shares: { [anaId]: 1234 },
      }),
    ).toBe(true);
    expect(called("rpc")).toEqual([
      {
        method: "rpc",
        args: [
          "complete_list_item",
          {
            item_id: itemId,
            user_id: anaId,
            group_id: groupId,
            amount_cents: 1234,
            shares: { [anaId]: 1234 },
          },
        ],
      },
    ]);
  });

  it("is false when no open item in the group has this id", async () => {
    result = {
      data: null,
      error: { message: "Item not found", code: "P0002" },
    };

    expect(
      await completeOpenListItem(groupId, itemId, anaId, {
        amountCents: 0,
        shares: {},
      }),
    ).toBe(false);
  });

  it("is a 403 when the database says the caller can't", async () => {
    result = { data: null, error: { message: "Not a member", code: "42501" } };

    await expect(
      completeOpenListItem(groupId, itemId, anaId, {
        amountCents: 0,
        shares: {},
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("throws when the call fails", async () => {
    result = { data: null, error: { message: "boom" } };

    await expect(
      completeOpenListItem(groupId, itemId, anaId, {
        amountCents: 0,
        shares: {},
      }),
    ).rejects.toThrow("Could not check off the list item: boom");
  });
});

describe("reopenDoneListItem", () => {
  it("unchecks the item", async () => {
    result = { data: null, error: null };

    expect(await reopenDoneListItem(groupId, itemId, anaId)).toBe(true);
    expect(called("rpc")).toEqual([
      {
        method: "rpc",
        args: [
          "reopen_list_item",
          { item_id: itemId, user_id: anaId, group_id: groupId },
        ],
      },
    ]);
  });

  it("is false when no done item in the group has this id", async () => {
    result = {
      data: null,
      error: { message: "Item not found", code: "P0002" },
    };

    expect(await reopenDoneListItem(groupId, itemId, anaId)).toBe(false);
  });

  it("is a 403 for someone other than the member who checked it off", async () => {
    result = { data: null, error: { message: "Only them", code: "42501" } };

    await expect(
      reopenDoneListItem(groupId, itemId, anaId),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("is a 409 with the database's reason for a locked expense", async () => {
    const message = "A settled expense can't be deleted.";
    result = { data: null, error: { message, code: "P0001" } };

    const error = await reopenDoneListItem(groupId, itemId, anaId).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).message).toBe(message);
  });

  it("throws when the call fails", async () => {
    result = { data: null, error: { message: "boom" } };

    await expect(reopenDoneListItem(groupId, itemId, anaId)).rejects.toThrow(
      "Could not uncheck the list item: boom",
    );
  });
});
