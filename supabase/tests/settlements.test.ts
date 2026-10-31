import { afterAll, describe, expect, it } from "vitest";
import {
  anonDb,
  cleanUp,
  createGroupWithMembers,
  createUser,
  db,
} from "./fixtures";

afterAll(cleanUp);

// Fixed times, so no test depends on this machine's clock matching the database's.
const STARTED = "2026-10-01T00:00:00Z";
const ENDED = "2026-10-02T00:00:00Z";

async function startSettlement(groupId: string, startedBy: string) {
  return db
    .from("settlements")
    .insert({ group_id: groupId, started_by: startedBy })
    .select("id, status, started_at, closed_at")
    .single();
}

describe("settlements table", () => {
  it("starts an open settle-up for a member", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);

    const { data, error } = await startSettlement(groupId, memberIds[0]);

    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "open", closed_at: null });
    expect(data!.started_at).toBeTruthy();
  });

  it("allows one open settle-up per group", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    await startSettlement(groupId, memberIds[0]);

    const { error } = await startSettlement(groupId, memberIds[1]);

    expect(error?.code).toBe("23505");
    expect(error?.message).toContain("settlements_one_open_per_group");
  });

  it("allows a new settle-up once the last one is closed", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const first = await db
      .from("settlements")
      .insert({
        group_id: groupId,
        started_by: memberIds[0],
        started_at: STARTED,
      })
      .select("id")
      .single();
    const closing = await db
      .from("settlements")
      .update({ status: "closed", closed_at: ENDED })
      .eq("id", first.data!.id);

    const { error } = await startSettlement(groupId, memberIds[1]);

    expect(closing.error).toBeNull();
    expect(error).toBeNull();
  });

  it("rejects an unknown status", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);

    // Both times are set and in order, so only the status is wrong.
    const { error } = await db.from("settlements").insert({
      group_id: groupId,
      started_by: memberIds[0],
      status: "done",
      started_at: STARTED,
      closed_at: ENDED,
    });

    expect(error?.code).toBe("23514");
    expect(error?.message).toContain("settlements_status_valid");
  });

  it("requires closed_at once it is closed or cancelled, and only then", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);

    const closedWithoutTime = await db.from("settlements").insert({
      group_id: groupId,
      started_by: memberIds[0],
      status: "cancelled",
    });
    const openWithTime = await db.from("settlements").insert({
      group_id: groupId,
      started_by: memberIds[0],
      started_at: STARTED,
      closed_at: ENDED,
    });

    expect(closedWithoutTime.error?.message).toContain(
      "settlements_closed_at_matches_status",
    );
    expect(openWithTime.error?.message).toContain(
      "settlements_closed_at_matches_status",
    );
  });

  it("rejects closing before it started", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(1);

    const { error } = await db.from("settlements").insert({
      group_id: groupId,
      started_by: memberIds[0],
      status: "closed",
      started_at: "2026-10-02T00:00:00Z",
      closed_at: "2026-10-01T00:00:00Z",
    });

    expect(error?.code).toBe("23514");
    expect(error?.message).toContain("settlements_closed_after_start");
  });

  it("must be started by a member of the group", async () => {
    const { groupId } = await createGroupWithMembers(1);
    const stranger = await createUser();

    const { error } = await startSettlement(groupId, stranger);

    expect(error?.code).toBe("23503");
    expect(error?.message).toContain("settlements_started_by_member");
  });

  it("is closed to the anon key", async () => {
    const { error } = await anonDb().from("settlements").select("id");

    expect(error?.code).toBe("42501");
  });
});
