// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { findMembership, listCurrentMemberWeights } from "./group-members";

type Result = { data: unknown; error: { message: string } | null };

const calls: { method: string; args: unknown[] }[] = [];
let result: Result;

function queryBuilder() {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "order"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.maybeSingle = async () => {
    calls.push({ method: "maybeSingle", args: [] });
    return result;
  };
  // A list query is awaited directly, without maybeSingle.
  builder.then = (resolve: (value: Result) => unknown) => resolve(result);
  return builder;
}

vi.mock("./client", () => ({
  getDb: () => ({
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return queryBuilder();
    },
  }),
}));

const userId = "6f1c2d4e-1111-4222-8333-944455556666";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const row = {
  joined_at: "2026-10-01T09:00:00+00:00",
  left_at: null,
  groups: {
    id: groupId,
    name: "Flat",
    is_personal: false,
    created_by: userId,
    archived_at: null,
    created_at: "2026-10-01T09:00:00+00:00",
  },
};

beforeEach(() => {
  calls.length = 0;
  result = { data: null, error: null };
});

describe("findMembership", () => {
  it("maps the member and their group to camelCase", async () => {
    result = { data: row, error: null };

    expect(await findMembership(userId, groupId)).toEqual({
      joinedAt: "2026-10-01T09:00:00+00:00",
      leftAt: null,
      group: {
        id: groupId,
        name: "Flat",
        isPersonal: false,
        createdBy: userId,
        archivedAt: null,
        createdAt: "2026-10-01T09:00:00+00:00",
      },
    });
  });

  it("looks the row up by user and group", async () => {
    await findMembership(userId, groupId);

    expect(calls).toContainEqual({ method: "from", args: ["group_members"] });
    expect(calls).toContainEqual({ method: "eq", args: ["user_id", userId] });
    expect(calls).toContainEqual({ method: "eq", args: ["group_id", groupId] });
  });

  it("returns null when the user has never been in the group", async () => {
    expect(await findMembership(userId, groupId)).toBeNull();
  });

  it("throws when the lookup fails", async () => {
    result = { data: null, error: { message: "boom" } };

    await expect(findMembership(userId, groupId)).rejects.toThrow(
      "Could not load group membership: boom",
    );
  });
});

describe("listCurrentMemberWeights", () => {
  it("maps each current member's weight to camelCase", async () => {
    result = {
      data: [
        { user_id: userId, default_share_weight: 3 },
        { user_id: "sam-id", default_share_weight: 2 },
      ],
      error: null,
    };

    expect(await listCurrentMemberWeights(groupId)).toEqual([
      { userId, weight: 3 },
      { userId: "sam-id", weight: 2 },
    ]);
  });

  it("reads only current members of the group, oldest first", async () => {
    result = { data: [], error: null };
    await listCurrentMemberWeights(groupId);

    expect(calls).toContainEqual({ method: "from", args: ["group_members"] });
    // The same query as listCurrentMembers, which also needs the names.
    expect(calls).toContainEqual({
      method: "select",
      args: [
        "user_id, default_share_weight, joined_at, left_at, users!inner(name)",
      ],
    });
    expect(calls).toContainEqual({ method: "eq", args: ["group_id", groupId] });
    expect(calls).toContainEqual({ method: "is", args: ["left_at", null] });
    expect(calls).toContainEqual({ method: "order", args: ["joined_at"] });
  });

  it("throws when the lookup fails", async () => {
    result = { data: null, error: { message: "boom" } };

    await expect(listCurrentMemberWeights(groupId)).rejects.toThrow(
      "Could not load share weights: boom",
    );
  });
});
