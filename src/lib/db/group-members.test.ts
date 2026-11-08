// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError } from "@/lib/http/errors";
import {
  findMembership,
  listCurrentMemberWeights,
  listMembersAt,
  rejoinMember,
} from "./group-members";

type Result = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

const calls: { method: string; args: unknown[] }[] = [];
let result: Result;

function queryBuilder() {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "is", "order"]) {
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
    rpc: async (fn: string, args: unknown) => {
      calls.push({ method: "rpc", args: [fn, args] });
      return result;
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
  function memberRow(id: string, weight: number, leftAt: string | null) {
    return {
      group_id: groupId,
      user_id: id,
      default_share_weight: weight,
      joined_at: "2026-10-01T09:00:00+00:00",
      left_at: leftAt,
      users: { name: id },
    };
  }

  it("maps each current member's weight to camelCase", async () => {
    result = {
      data: [memberRow(userId, 3, null), memberRow("sam-id", 2, null)],
      error: null,
    };

    expect(await listCurrentMemberWeights(groupId)).toEqual([
      { userId, weight: 3 },
      { userId: "sam-id", weight: 2 },
    ]);
  });

  it("leaves out former members", async () => {
    result = {
      data: [
        memberRow(userId, 3, null),
        memberRow("gone-id", 2, "2026-10-20T09:00:00+00:00"),
      ],
      error: null,
    };

    expect(await listCurrentMemberWeights(groupId)).toEqual([
      { userId, weight: 3 },
    ]);
  });

  it("reads the group's member rows oldest first", async () => {
    result = { data: [], error: null };
    await listCurrentMemberWeights(groupId);

    expect(calls).toContainEqual({ method: "from", args: ["group_members"] });
    expect(calls).toContainEqual({
      method: "in",
      args: ["group_id", [groupId]],
    });
    expect(calls).toContainEqual({ method: "order", args: ["joined_at"] });
  });

  it("throws when the lookup fails", async () => {
    result = { data: null, error: { message: "boom" } };

    await expect(listCurrentMemberWeights(groupId)).rejects.toThrow(
      "Could not load share weights: boom",
    );
  });
});

describe("listMembersAt", () => {
  // Postgres keeps microseconds; these times share one millisecond (#75).
  const leftAt = "2026-11-07T10:00:00.123456+00:00";

  function memberRow(id: string, joinedAt: string, left: string | null) {
    return {
      group_id: groupId,
      user_id: id,
      default_share_weight: 1,
      joined_at: joinedAt,
      left_at: left,
      users: { name: id },
    };
  }

  async function idsAt(rows: unknown[]): Promise<string[]> {
    result = { data: rows, error: null };
    const members = await listMembersAt(groupId, leftAt);
    return members.map((member) => member.userId);
  }

  it("leaves out a member who joined later in the same millisecond", async () => {
    expect(
      await idsAt([
        memberRow(userId, "2026-10-01T09:00:00+00:00", leftAt),
        memberRow("dan-id", "2026-11-07T10:00:00.1239+00:00", null),
      ]),
    ).toEqual([userId]);
  });

  it("keeps a member who left later in the same millisecond", async () => {
    expect(
      await idsAt([
        memberRow(userId, "2026-10-01T09:00:00+00:00", leftAt),
        memberRow(
          "ben-id",
          "2026-10-01T09:00:00+00:00",
          "2026-11-07T10:00:00.1235+00:00",
        ),
      ]),
    ).toEqual([userId, "ben-id"]);
  });

  it("leaves out a member who left earlier in the same millisecond", async () => {
    expect(
      await idsAt([
        memberRow(userId, "2026-10-01T09:00:00+00:00", leftAt),
        memberRow(
          "cat-id",
          "2026-10-01T09:00:00+00:00",
          "2026-11-07T10:00:00.1234+00:00",
        ),
      ]),
    ).toEqual([userId]);
  });

  it("counts a member at the exact microsecond they joined", async () => {
    expect(
      await idsAt([
        memberRow(userId, "2026-10-01T09:00:00+00:00", leftAt),
        memberRow("eve-id", leftAt, null),
      ]),
    ).toEqual([userId, "eve-id"]);
  });
});

describe("rejoinMember", () => {
  it("asks the database to rejoin, so joined_at comes from its clock (#75)", async () => {
    await rejoinMember(groupId, userId);

    expect(calls).toEqual([
      {
        method: "rpc",
        args: ["rejoin_member", { p_group_id: groupId, p_user_id: userId }],
      },
    ]);
  });

  it("turns a 13th current member into a ConflictError", async () => {
    result = {
      data: null,
      error: {
        code: "23514",
        message: "A group can have at most 12 current members.",
      },
    };

    await expect(rejoinMember(groupId, userId)).rejects.toEqual(
      new ConflictError("A group can have at most 12 members."),
    );
  });
});
