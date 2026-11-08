// Checking off and unchecking through the real service, lib/db and the
// Postgres functions (#12): the split is worked out on the server, the list
// response carries the cost and the lock, and unchecking puts everything back.
import { afterAll, describe, expect, it } from "vitest";
import {
  ConflictError,
  ForbiddenError,
  ValidationError,
} from "@/lib/http/errors";
import {
  addListItem,
  completeListItem,
  listGroupListItems,
  reopenListItem,
} from "@/lib/services/list-item-service";
import { cleanUp, createGroupWithMembers, createUser, db } from "./fixtures";

afterAll(cleanUp);

const groceries = {
  title: "🛒 Groceries",
  quantity: null,
  note: null,
  estimatedCents: 5000,
};

async function findPersonalSpace(owner: string): Promise<string | null> {
  const { data, error } = await db
    .from("groups")
    .select("id")
    .eq("created_by", owner)
    .eq("is_personal", true)
    .maybeSingle<{ id: string }>();
  if (error) {
    throw error;
  }
  return data?.id ?? null;
}

// createUser inserts the user directly, with no personal space. Another
// file's ensure_personal_spaces test may give them one at any moment (#79,
// #83), so a clash on groups_one_personal_space_per_user means it is there.
async function personalSpaceOf(owner: string): Promise<string> {
  const existing = await findPersonalSpace(owner);
  if (existing) {
    return existing;
  }
  const created = await db
    .from("groups")
    .insert({ name: "Personal", created_by: owner, is_personal: true })
    .select("id")
    .single<{ id: string }>();
  if (created.error) {
    if (created.error.code !== "23505") {
      throw created.error;
    }
    const raced = await findPersonalSpace(owner);
    if (!raced) {
      throw created.error;
    }
    return raced;
  }
  const joined = await db.from("group_members").insert({
    group_id: created.data.id,
    user_id: owner,
    default_share_weight: 1,
  });
  if (joined.error && joined.error.code !== "23505") {
    throw joined.error;
  }
  return created.data.id;
}

async function sharesOf(expenseId: string) {
  const { data, error } = await db
    .from("expense_shares")
    .select("user_id, share_cents")
    .eq("expense_id", expenseId);
  if (error) {
    throw error;
  }
  return Object.fromEntries(
    (data as { user_id: string; share_cents: number }[]).map((share) => [
      share.user_id,
      share.share_cents,
    ]),
  );
}

describe("checking off through the service (#12)", () => {
  it("splits the cost evenly with the leftover cent to the payer, and lists the cost", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [ana, sam] = memberIds;
    const item = await addListItem(ana, groupId, groceries);

    const done = await completeListItem(ana, groupId, item.id, {
      amountCents: 4799,
      mode: "even",
      sharedBy: [ana, sam],
    });

    expect(done).toMatchObject({ status: "done", completedBy: ana });
    expect(done.expenseId).not.toBeNull();
    expect(await sharesOf(done.expenseId!)).toEqual({
      [ana]: 2400,
      [sam]: 2399,
    });
    const [listed] = await listGroupListItems(sam, groupId);
    expect(listed).toMatchObject({ costCents: 4799, expenseLock: null });
  });

  it("refuses a sharer outside the group with a 400 and leaves the item open", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);
    const [ana] = memberIds;
    const stranger = await createUser();
    const item = await addListItem(ana, groupId, groceries);

    await expect(
      completeListItem(ana, groupId, item.id, {
        amountCents: 1000,
        mode: "even",
        sharedBy: [ana, stranger],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    const [listed] = await listGroupListItems(ana, groupId);
    expect(listed.status).toBe("open");
  });

  it("says the expense is in the open settle-up, and refuses to uncheck it (#86)", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [ana, sam] = memberIds;
    const item = await addListItem(ana, groupId, groceries);
    await completeListItem(ana, groupId, item.id, {
      amountCents: 1000,
      mode: "even",
      sharedBy: [ana, sam],
    });
    // Started after the expense, by the database's clock, so it is in it.
    const now = await db.rpc("db_now");
    if (now.error) {
      throw now.error;
    }
    const { error } = await db.from("settlements").insert({
      group_id: groupId,
      started_by: ana,
      started_at: now.data,
    });
    if (error) {
      throw error;
    }

    const [listed] = await listGroupListItems(ana, groupId);
    expect(listed.expenseLock).toBe("settle-up");
    await expect(reopenListItem(ana, groupId, item.id)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("unchecks: the item is open again and its expense is gone", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [ana, sam] = memberIds;
    const item = await addListItem(ana, groupId, groceries);
    const done = await completeListItem(ana, groupId, item.id, {
      amountCents: 1000,
      mode: "even",
      sharedBy: [ana, sam],
    });

    await expect(reopenListItem(sam, groupId, item.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    const reopened = await reopenListItem(ana, groupId, item.id);

    expect(reopened).toMatchObject({ status: "open", expenseId: null });
    const { data } = await db
      .from("expenses")
      .select("id")
      .eq("id", done.expenseId!);
    expect(data).toEqual([]);
    const [listed] = await listGroupListItems(ana, groupId);
    expect(listed).toMatchObject({ costCents: null, expenseLock: null });
  });

  it("logs a personal check-off as the owner's alone (#23)", async () => {
    const owner = await createUser();
    const personalId = await personalSpaceOf(owner);
    const item = await addListItem(owner, personalId, groceries);

    const done = await completeListItem(owner, personalId, item.id, {
      amountCents: 500,
      mode: "even",
      sharedBy: [owner],
    });

    expect(await sharesOf(done.expenseId!)).toEqual({ [owner]: 500 });
  });
});
