// update_group and add_member against a payment or cost in the same group
// (#124, from the review of #116). record_payment, and create_expense through
// assert_no_former_members, hold the membership rows FOR SHARE and then insert
// a row whose foreign key takes KEY SHARE on the group row. If update_group or
// add_member holds the group row FOR UPDATE and waits to update those
// membership rows, each waits for the other and Postgres aborts one (40P01).
//
// PostgREST runs each request as its own transaction, so these drive two
// direct connections step by step: the cost or payment takes its membership
// locks first, the group change starts and is seen waiting, then the cost or
// payment finishes. Both must succeed.
import type { Client } from "pg";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  cleanUp,
  connectDirect,
  createGroupWithMembers,
  createUser,
  db,
} from "./fixtures";

afterAll(cleanUp);

// Each race waits for Postgres's deadlock check (1 s) at most once.
vi.setConfig({ testTimeout: 20_000 });

// Long enough for Postgres to find a deadlock (deadlock_timeout is 1 s), short
// enough that a lock nobody releases fails the test instead of hanging it.
const STATEMENT_TIMEOUT = "10s";

async function openTransaction(): Promise<Client> {
  const client = await connectDirect();
  await client.query(`set statement_timeout = '${STATEMENT_TIMEOUT}'`);
  await client.query("begin");
  return client;
}

// The first step of record_payment and assert_no_former_members.
async function lockMembersForShare(
  client: Client,
  groupId: string,
  userIds: string[],
) {
  await client.query(
    `select 1 from public.group_members
     where group_id = $1 and user_id = any($2::uuid[])
     order by user_id
     for share`,
    [groupId, userIds],
  );
}

async function backendPid(client: Client): Promise<number> {
  const { rows } = await client.query<{ pid: number }>(
    "select pg_backend_pid() as pid",
  );
  return rows[0].pid;
}

// Resolves once the backend is waiting on a lock, so the next step really
// runs while it waits.
async function waitUntilBlocked(watcher: Client, pid: number) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const { rows } = await watcher.query(
      "select 1 from pg_stat_activity where pid = $1 and wait_event_type = 'Lock'",
      [pid],
    );
    if (rows.length > 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Backend ${pid} never waited on a lock.`);
}

type Outcome = { ok: true } | { ok: false; code: string | undefined };

function settle(query: Promise<unknown>): Promise<Outcome> {
  return query.then(
    () => ({ ok: true }) as const,
    (error: { code?: string }) => ({ ok: false, code: error.code }) as const,
  );
}

// Runs the race in the order that deadlocked: `cost` holds the membership
// rows, `change` starts and waits, then `cost` writes its row. Returns how
// each ended; both are committed when they succeed.
async function race(
  groupId: string,
  memberIds: string[],
  change: (client: Client) => Promise<unknown>,
  cost: (client: Client) => Promise<unknown>,
) {
  const first = await openTransaction();
  const second = await openTransaction();
  const watcher = await connectDirect();
  try {
    // A client runs one query at a time, so ask before it starts waiting.
    const secondPid = await backendPid(second);
    await lockMembersForShare(first, groupId, memberIds);
    const changed = settle(change(second));
    await waitUntilBlocked(watcher, secondPid);

    const costed = await settle(cost(first));
    await first.query(costed.ok ? "commit" : "rollback");
    const changeOutcome = await changed;
    await second.query(changeOutcome.ok ? "commit" : "rollback");
    return { cost: costed, change: changeOutcome };
  } finally {
    await Promise.all([first.end(), second.end(), watcher.end()]);
  }
}

function recordPayment(groupId: string, fromId: string, toId: string) {
  return (client: Client) =>
    client.query("select public.record_payment($1, $2, $3, $4)", [
      groupId,
      fromId,
      toId,
      1500,
    ]);
}

function createExpense(groupId: string, payerId: string, sharerIds: string[]) {
  return (client: Client) =>
    client.query(
      "select public.create_expense($1, $2, $3, $4, $5, $6::jsonb)",
      [
        groupId,
        "Groceries",
        3000,
        payerId,
        "2026-11-10",
        JSON.stringify(
          sharerIds.map((id) => ({
            user_id: id,
            share_cents: 3000 / sharerIds.length,
          })),
        ),
      ],
    );
}

function updateWeights(groupId: string, weights: [string, number][]) {
  return (client: Client) =>
    client.query("select public.update_group($1, null, $2::jsonb)", [
      groupId,
      JSON.stringify(
        weights.map(([userId, weight]) => ({ user_id: userId, weight })),
      ),
    ]);
}

function addMember(groupId: string, userId: string) {
  return (client: Client) =>
    client.query("select public.add_member($1, $2)", [groupId, userId]);
}

async function weightsOf(groupId: string) {
  const { data, error } = await db
    .from("group_members")
    .select("user_id, default_share_weight")
    .eq("group_id", groupId)
    .is("left_at", null);
  if (error) {
    throw error;
  }
  return Object.fromEntries(
    data.map((row) => [row.user_id, row.default_share_weight]),
  );
}

async function countOf(table: "payments" | "expenses", groupId: string) {
  const { count, error } = await db
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId);
  if (error) {
    throw error;
  }
  return count;
}

async function setWeights(groupId: string, weights: [string, number][]) {
  for (const [userId, weight] of weights) {
    const { error } = await db
      .from("group_members")
      .update({ default_share_weight: weight })
      .eq("group_id", groupId)
      .eq("user_id", userId);
    if (error) {
      throw error;
    }
  }
}

const bothSucceed = { cost: { ok: true }, change: { ok: true } };

describe("update_group while a payment or cost is being written", () => {
  it("lets a direct payment and a new ratio both commit", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [ana, sam] = memberIds;

    const outcome = await race(
      groupId,
      memberIds,
      updateWeights(groupId, [
        [ana, 3],
        [sam, 2],
      ]),
      recordPayment(groupId, sam, ana),
    );

    expect(outcome).toEqual(bothSucceed);
    expect(await weightsOf(groupId)).toEqual({ [ana]: 3, [sam]: 2 });
    expect(await countOf("payments", groupId)).toBe(1);
  });

  it("lets a new cost and a new ratio both commit", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [ana, sam] = memberIds;

    const outcome = await race(
      groupId,
      memberIds,
      updateWeights(groupId, [
        [ana, 3],
        [sam, 2],
      ]),
      createExpense(groupId, ana, memberIds),
    );

    expect(outcome).toEqual(bothSucceed);
    expect(await weightsOf(groupId)).toEqual({ [ana]: 3, [sam]: 2 });
    expect(await countOf("expenses", groupId)).toBe(1);
  });
});

describe("add_member while a payment or cost is being written", () => {
  // An uneven ratio makes add_member reset every current member to 1, which
  // updates the rows the payment holds FOR SHARE.
  it("lets a direct payment and a join that resets the split both commit", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [ana, sam] = memberIds;
    await setWeights(groupId, [
      [ana, 3],
      [sam, 2],
    ]);
    const jo = await createUser();

    const outcome = await race(
      groupId,
      memberIds,
      addMember(groupId, jo),
      recordPayment(groupId, sam, ana),
    );

    expect(outcome).toEqual(bothSucceed);
    expect(await weightsOf(groupId)).toEqual({ [ana]: 1, [sam]: 1, [jo]: 1 });
    expect(await countOf("payments", groupId)).toBe(1);
  });

  it("lets a new cost and a join that resets the split both commit", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [ana, sam] = memberIds;
    await setWeights(groupId, [
      [ana, 3],
      [sam, 2],
    ]);
    const jo = await createUser();

    const outcome = await race(
      groupId,
      memberIds,
      addMember(groupId, jo),
      createExpense(groupId, ana, memberIds),
    );

    expect(outcome).toEqual(bothSucceed);
    expect(await weightsOf(groupId)).toEqual({ [ana]: 1, [sam]: 1, [jo]: 1 });
    expect(await countOf("expenses", groupId)).toBe(1);
  });

  // The member cap trigger still locks the group row FOR UPDATE when the
  // newcomer's row is written, so a join waits for a payment that already
  // holds KEY SHARE on the group row. The payment waits for nothing the join
  // holds, so it commits and the join goes on.
  it("waits for a payment already written, then joins", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [ana, sam] = memberIds;
    const jo = await createUser();

    const first = await openTransaction();
    const second = await openTransaction();
    const watcher = await connectDirect();
    try {
      const secondPid = await backendPid(second);
      await recordPayment(groupId, sam, ana)(first);
      const joined = settle(addMember(groupId, jo)(second));
      await waitUntilBlocked(watcher, secondPid);

      await first.query("commit");
      expect(await joined).toEqual({ ok: true });
      await second.query("commit");
    } finally {
      await Promise.all([first.end(), second.end(), watcher.end()]);
    }

    expect(await weightsOf(groupId)).toEqual({ [ana]: 1, [sam]: 1, [jo]: 1 });
    expect(await countOf("payments", groupId)).toBe(1);
  });
});
