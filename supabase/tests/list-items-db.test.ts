// lib/db/list-items.ts (#11) against the real database: the list order, a
// former member's cut-off, and that editing and deleting only ever touch an
// open item.
import { afterAll, describe, expect, it } from "vitest";
import {
  countOpenListItems,
  deleteOpenListItem,
  findListItem,
  insertListItem,
  listListItems,
  updateOpenListItem,
} from "@/lib/db/list-items";
import { cleanUp, createGroupWithMembers, db } from "./fixtures";

afterAll(cleanUp);

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function add(groupId: string, addedBy: string, title: string) {
  return insertListItem({
    groupId,
    title,
    quantity: null,
    note: null,
    estimatedCents: null,
    addedBy,
  });
}

async function markDone(itemId: string, completedBy: string): Promise<void> {
  const { error } = await db
    .from("list_items")
    .update({
      status: "done",
      completed_by: completedBy,
      completed_at: "2026-11-04T00:00:00Z",
    })
    .eq("id", itemId);
  if (error) {
    throw error;
  }
}

describe("list items in the database", () => {
  it("lists open items first, then done ones, newest first in each", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);
    const [ana] = memberIds;
    const oldOpen = await add(groupId, ana, "Old open");
    await pause(5);
    const oldDone = await add(groupId, ana, "Old done");
    await pause(5);
    const newOpen = await add(groupId, ana, "New open");
    await pause(5);
    const newDone = await add(groupId, ana, "New done");
    await markDone(oldDone.id, ana);
    await markDone(newDone.id, ana);

    const titles = (await listListItems(groupId, null)).map(
      (item) => item.title,
    );

    expect(titles).toEqual(["New open", "Old open", "New done", "Old done"]);
    expect(oldOpen.status).toBe("open");
    expect(newOpen.addedBy).toBe(ana);
  });

  it("shows a former member only items added before they left", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);
    const [ana] = memberIds;
    const before = await add(groupId, ana, "Before");
    await pause(5);
    await add(groupId, ana, "After");

    const titles = (await listListItems(groupId, before.createdAt)).map(
      (item) => item.title,
    );

    expect(titles).toEqual(["Before"]);
  });

  it("edits an open item, and leaves a done one as it was", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);
    const [ana] = memberIds;
    const open = await add(groupId, ana, "Milk");
    const done = await add(groupId, ana, "Bread");
    await markDone(done.id, ana);

    const edited = await updateOpenListItem(groupId, open.id, {
      title: "Oat milk",
      estimatedCents: 450,
    });
    const refused = await updateOpenListItem(groupId, done.id, {
      title: "Rye bread",
    });

    expect(edited).toMatchObject({ title: "Oat milk", estimatedCents: 450 });
    expect(refused).toBeNull();
    expect((await findListItem(groupId, done.id))?.title).toBe("Bread");
  });

  it("deletes an open item, and keeps a done one", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);
    const [ana] = memberIds;
    const open = await add(groupId, ana, "Milk");
    const done = await add(groupId, ana, "Bread");
    await markDone(done.id, ana);

    expect(await deleteOpenListItem(groupId, open.id)).toBe(true);
    expect(await deleteOpenListItem(groupId, done.id)).toBe(false);
    expect(await findListItem(groupId, open.id)).toBeNull();
    expect(await findListItem(groupId, done.id)).not.toBeNull();
  });

  it("finds an item only in its own group", async () => {
    const first = await createGroupWithMembers(1);
    const second = await createGroupWithMembers(1);
    const item = await add(first.groupId, first.memberIds[0], "Milk");

    expect(await findListItem(second.groupId, item.id)).toBeNull();
    expect(
      await updateOpenListItem(second.groupId, item.id, { title: "Bread" }),
    ).toBeNull();
    expect(await deleteOpenListItem(second.groupId, item.id)).toBe(false);
  });

  it("counts only open items, per group", async () => {
    const first = await createGroupWithMembers(1);
    const second = await createGroupWithMembers(1);
    const empty = await createGroupWithMembers(1);
    const [ana] = first.memberIds;
    const [sam] = second.memberIds;
    await add(first.groupId, ana, "Milk");
    await add(first.groupId, ana, "Bread");
    const done = await add(first.groupId, ana, "Eggs");
    await markDone(done.id, ana);
    await add(second.groupId, sam, "Charcoal");

    const counts = await countOpenListItems([
      first.groupId,
      second.groupId,
      empty.groupId,
    ]);

    expect(counts.get(first.groupId)).toBe(2);
    expect(counts.get(second.groupId)).toBe(1);
    expect(counts.get(empty.groupId)).toBe(0);
  });
});
