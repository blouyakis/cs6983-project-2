// End to end through the route handler, the access check and the database:
// 401 without a session, 403 for a user outside the group, 200 for a member.
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET } from "@/app/api/groups/[groupId]/route";
import { signSession } from "@/lib/auth/session";
import { cleanUp, createUser, db } from "./fixtures";

const originalSecret = process.env.JWT_SECRET;

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";
});

afterAll(async () => {
  if (originalSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = originalSecret;
  }
  await cleanUp();
});

async function createGroup(
  createdBy: string,
  members: { userId: string; leftAt?: string }[],
  isPersonal = false,
): Promise<string> {
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
  return data.id;
}

async function getAs(userId: string | null, groupId: string) {
  const cookie = userId ? `session=${await signSession(userId)}` : undefined;
  const request = new NextRequest(`http://localhost/api/groups/${groupId}`, {
    headers: cookie ? { cookie } : {},
  });
  return GET(request, { params: Promise.resolve({ groupId }) });
}

describe("GET /api/groups/{groupId} against the database", () => {
  it("returns 401 without a session", async () => {
    const owner = await createUser();
    const groupId = await createGroup(owner, [{ userId: owner }]);

    const response = await getAs(null, groupId);

    expect(response.status).toBe(401);
  });

  it("returns the group to a current member", async () => {
    const owner = await createUser();
    const member = await createUser();
    const groupId = await createGroup(owner, [
      { userId: owner },
      { userId: member },
    ]);

    const response = await getAs(member, groupId);

    expect(response.status).toBe(200);
    expect((await response.json()).group).toMatchObject({
      id: groupId,
      name: "Flat",
      isPersonal: false,
      archivedAt: null,
    });
  });

  it("returns 403 to a user who is not in the group", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const groupId = await createGroup(owner, [{ userId: owner }]);

    const response = await getAs(stranger, groupId);

    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
  });

  it("returns 403 for a group that does not exist", async () => {
    const userId = await createUser();

    const response = await getAs(userId, crypto.randomUUID());

    expect(response.status).toBe(403);
  });

  it("returns 403 to another user for a personal space", async () => {
    const owner = await createUser();
    const other = await createUser();
    const spaceId = await createGroup(owner, [{ userId: owner }], true);

    expect((await getAs(owner, spaceId)).status).toBe(200);
    expect((await getAs(other, spaceId)).status).toBe(403);
  });

  it("lets a former member read the group", async () => {
    const owner = await createUser();
    const former = await createUser();
    const groupId = await createGroup(owner, [
      { userId: owner },
      // A fixed time: left_at may not be before the database's joined_at.
      { userId: former, leftAt: "2099-01-01T00:00:00+00:00" },
    ]);

    const response = await getAs(former, groupId);

    expect(response.status).toBe(200);
  });
});
