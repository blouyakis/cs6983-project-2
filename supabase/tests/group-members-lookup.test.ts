import { afterAll, describe, expect, it } from "vitest";
import { findMembership } from "@/lib/db/group-members";
import { cleanUp, createUser, db } from "./fixtures";

afterAll(cleanUp);

async function createGroup(
  createdBy: string,
  members: { userId: string; leftAt?: string }[],
  isPersonal = false,
) {
  const { data, error } = await db
    .from("groups")
    .insert({ name: "Flat", is_personal: isPersonal, created_by: createdBy })
    .select("id")
    .single();
  if (error) {
    throw error;
  }
  const { error: memberError } = await db.from("group_members").insert(
    members.map((member) => ({
      group_id: data.id,
      user_id: member.userId,
      default_share_weight: 1,
      left_at: member.leftAt ?? null,
    })),
  );
  if (memberError) {
    throw memberError;
  }
  return data.id as string;
}

describe("findMembership", () => {
  it("finds a current member with their group", async () => {
    const userId = await createUser();
    const groupId = await createGroup(userId, [{ userId }]);

    const membership = await findMembership(userId, groupId);

    expect(membership?.leftAt).toBeNull();
    expect(membership?.group).toMatchObject({
      id: groupId,
      name: "Flat",
      isPersonal: false,
      createdBy: userId,
      archivedAt: null,
    });
  });

  it("finds a former member with the day they left", async () => {
    const owner = await createUser();
    const former = await createUser();
    const groupId = await createGroup(owner, [
      { userId: owner },
      { userId: former, leftAt: "2099-01-01T00:00:00+00:00" },
    ]);

    const membership = await findMembership(former, groupId);

    expect(new Date(membership!.leftAt!).toISOString()).toBe(
      "2099-01-01T00:00:00.000Z",
    );
  });

  it("finds nothing for someone who was never a member", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const groupId = await createGroup(owner, [{ userId: owner }]);

    expect(await findMembership(stranger, groupId)).toBeNull();
  });

  it("finds nothing for a group that does not exist", async () => {
    const userId = await createUser();

    expect(await findMembership(userId, crypto.randomUUID())).toBeNull();
  });

  it("marks a personal space", async () => {
    const userId = await createUser();
    const groupId = await createGroup(userId, [{ userId }], true);

    expect((await findMembership(userId, groupId))?.group.isPersonal).toBe(
      true,
    );
  });
});
