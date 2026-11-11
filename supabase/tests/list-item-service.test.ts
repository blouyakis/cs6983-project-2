// list-item-service (#11) with the real service and lib/db against the real
// database: a done item can't be edited or deleted, and a former member, an
// archived group or someone outside the group gets a 403.
import { afterAll, describe, expect, it } from "vitest";
import { findListItem } from "@/lib/db/list-items";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/http/errors";
import {
  addListItem,
  editListItem,
  listGroupListItems,
  removeListItem,
} from "@/lib/services/list-item-service";
import {
  cleanUp,
  createGroupWithMembers,
  createUser,
  db,
  dbNow,
} from "./fixtures";

afterAll(cleanUp);

const milk = {
  title: "Milk",
  quantity: null,
  note: null,
  estimatedCents: 450,
};

async function markDone(itemId: string, completedBy: string): Promise<void> {
  const { error } = await db
    .from("list_items")
    .update({
      status: "done",
      completed_by: completedBy,
      completed_at: await dbNow(),
    })
    .eq("id", itemId);
  if (error) {
    throw error;
  }
}

describe("list items through the service", () => {
  it("lets any current member edit or delete an item someone else added", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [ana, sam] = memberIds;
    const first = await addListItem(ana, groupId, milk);
    const second = await addListItem(ana, groupId, milk);

    const edited = await editListItem(sam, groupId, first.id, {
      quantity: 2,
    });
    await removeListItem(sam, groupId, second.id);

    expect(edited).toMatchObject({ quantity: 2, addedBy: ana });
    expect(await findListItem(groupId, second.id)).toBeNull();
  });

  it("refuses to edit or delete a done item with a 409 and leaves it as it was", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);
    const [ana] = memberIds;
    const item = await addListItem(ana, groupId, milk);
    await markDone(item.id, ana);

    await expect(
      editListItem(ana, groupId, item.id, { title: "Bread" }),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(removeListItem(ana, groupId, item.id)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(await findListItem(groupId, item.id)).toMatchObject({
      title: "Milk",
      status: "done",
    });
  });

  it("is a 404 for an item from another group", async () => {
    const first = await createGroupWithMembers(1);
    const second = await createGroupWithMembers(1);
    const item = await addListItem(first.memberIds[0], first.groupId, milk);

    await expect(
      removeListItem(second.memberIds[0], second.groupId, item.id),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(await findListItem(first.groupId, item.id)).not.toBeNull();
  });

  it("gives a former member a 403 on writes, and only the items from before they left", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [ana, sam] = memberIds;
    const before = await addListItem(ana, groupId, milk);
    // left_at from the database's clock, not this machine's (#75).
    const { error } = await db
      .from("group_members")
      .update({ left_at: before.createdAt })
      .eq("group_id", groupId)
      .eq("user_id", sam);
    if (error) {
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
    await addListItem(ana, groupId, { ...milk, title: "After" });

    await expect(addListItem(sam, groupId, milk)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      editListItem(sam, groupId, before.id, { title: "Bread" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      removeListItem(sam, groupId, before.id),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(
      (await listGroupListItems(sam, groupId)).map((item) => item.id),
    ).toEqual([before.id]);
  });

  it("gives an archived group a 403 on writes", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);
    const [ana] = memberIds;
    const item = await addListItem(ana, groupId, milk);
    const { error } = await db
      .from("groups")
      .update({ archived_at: await dbNow() })
      .eq("id", groupId);
    if (error) {
      throw error;
    }

    await expect(addListItem(ana, groupId, milk)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      editListItem(ana, groupId, item.id, { title: "Bread" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(removeListItem(ana, groupId, item.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("gives someone outside the group a 403, even to read", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);
    await addListItem(memberIds[0], groupId, milk);
    const stranger = await createUser();

    await expect(listGroupListItems(stranger, groupId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
