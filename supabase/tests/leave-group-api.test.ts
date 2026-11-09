// Leaving a group end to end (#22, AGENTS.md user flow 8): through the route
// handlers, the services, the access check and the database. A former member
// keeps read-only access to what was added before they left and can't see or
// change anything added after; the members who stay keep using the group,
// even when one is left; the last member's leave archives it.
//
// There is no route that reads one expense, so "a former member asks for
// data from after they left" is covered by the lists leaving it out and by
// a 403 on any change to it.
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as leaveRoute } from "@/app/api/groups/[groupId]/leave/route";
import { GET as groupRoute } from "@/app/api/groups/[groupId]/route";
import {
  GET as listExpensesRoute,
  POST as addExpenseRoute,
} from "@/app/api/groups/[groupId]/expenses/route";
import {
  DELETE as deleteExpenseRoute,
  PATCH as editExpenseRoute,
} from "@/app/api/groups/[groupId]/expenses/[expenseId]/route";
import { POST as inviteRoute } from "@/app/api/groups/[groupId]/invitations/route";
import { signSession } from "@/lib/auth/session";
import {
  cleanUp,
  createGroupWithMembers,
  db,
  trackUser,
  uniqueEmail,
} from "./fixtures";

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

type Params = Record<string, string>;
type Handler = (
  request: NextRequest,
  context: { params: Promise<Params> },
) => Promise<Response>;

// Calls a route handler as the user, with a JSON body if there is one.
async function call(
  handler: Handler,
  userId: string,
  method: string,
  params: Params,
  body?: unknown,
): Promise<Response> {
  const headers: Record<string, string> = {
    cookie: `session=${await signSession(userId)}`,
  };
  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }
  const request = new NextRequest("http://localhost/api/test", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return handler(request, { params: Promise.resolve(params) });
}

function leave(userId: string, groupId: string) {
  return call(leaveRoute as Handler, userId, "POST", { groupId });
}

// A cost the user paid, split evenly among the sharers.
function addExpense(
  userId: string,
  groupId: string,
  sharedBy: string[],
  description = "Groceries",
) {
  return call(
    addExpenseRoute as Handler,
    userId,
    "POST",
    { groupId },
    {
      description,
      amountCents: 1000,
      spentOn: "2026-11-01",
      mode: "even",
      sharedBy,
    },
  );
}

async function addedExpenseId(response: Promise<Response>): Promise<string> {
  const result = await response;
  expect(result.status).toBe(201);
  return ((await result.json()) as { expense: { id: string } }).expense.id;
}

async function expenseDescriptions(
  userId: string,
  groupId: string,
): Promise<string[]> {
  const response = await call(listExpensesRoute as Handler, userId, "GET", {
    groupId,
  });
  expect(response.status).toBe(200);
  const { expenses } = (await response.json()) as {
    expenses: { description: string }[];
  };
  return expenses.map((expense) => expense.description).sort();
}

async function groupAs(userId: string, groupId: string) {
  const response = await call(groupRoute as Handler, userId, "GET", {
    groupId,
  });
  expect(response.status).toBe(200);
  return (
    (await response.json()) as {
      group: { readOnly: boolean; archivedAt: string | null };
    }
  ).group;
}

describe("leaving a group through the API", () => {
  it("gives a former member read-only access to what was added before they left", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    const [ana, ren] = memberIds;
    // Ren paid for something only he uses, so his balance stays zero.
    await addedExpenseId(addExpense(ren, groupId, [ren], "Ren's lamp"));
    await addedExpenseId(addExpense(ana, groupId, [ana], "Before"));

    expect((await leave(ren, groupId)).status).toBe(204);
    const after = await addedExpenseId(
      addExpense(ana, groupId, [ana], "After"),
    );

    // He still sees the group and what was added before he left, read-only.
    expect((await groupAs(ren, groupId)).readOnly).toBe(true);
    expect(await expenseDescriptions(ren, groupId)).toEqual([
      "Before",
      "Ren's lamp",
    ]);
    // He can add nothing, and can't touch what was added after he left.
    expect((await addExpense(ren, groupId, [ren])).status).toBe(403);
    expect(
      (
        await call(
          editExpenseRoute as Handler,
          ren,
          "PATCH",
          {
            groupId,
            expenseId: after,
          },
          {
            description: "Changed",
            amountCents: 1000,
            spentOn: "2026-11-01",
            mode: "even",
            sharedBy: [ana],
          },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await call(deleteExpenseRoute as Handler, ren, "DELETE", {
          groupId,
          expenseId: after,
        })
      ).status,
    ).toBe(403);
    // Ana still sees the expense Ren paid before he left.
    expect(await expenseDescriptions(ana, groupId)).toEqual([
      "After",
      "Before",
      "Ren's lamp",
    ]);
  });

  it("refuses to let a member with a balance leave, with 409 and the reason", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [ana, ren] = memberIds;
    await addedExpenseId(addExpense(ana, groupId, [ana, ren]));

    const response = await leave(ren, groupId);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: "CONFLICT",
        message:
          "Settle up first: you can leave once your balance in this group is $0.00.",
      },
    });
    expect((await groupAs(ren, groupId)).readOnly).toBe(false);
  });

  it("refuses a new cost shared with a member who has left", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    const [ana, ren] = memberIds;
    expect((await leave(ren, groupId)).status).toBe(204);

    const response = await addExpense(ana, groupId, [ana, ren]);

    expect(response.status).toBe(400);
    expect(await expenseDescriptions(ana, groupId)).toEqual([]);
  });

  it("locks a cost shared with a member who has left: no edit, not even the description, and no delete", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(3);
    const [ana, ren] = memberIds;
    // Each cost is 10.00, split evenly between Ana and Ren. He owes 5.00 for
    // Groceries and is owed 5.00 for Bread, so he leaves at zero with a 5.00
    // share in Groceries.
    const shared = await addedExpenseId(
      addExpense(ana, groupId, [ana, ren], "Groceries"),
    );
    await addedExpenseId(addExpense(ren, groupId, [ren, ana], "Bread"));
    expect((await leave(ren, groupId)).status).toBe(204);

    const locked = {
      error: {
        code: "CONFLICT",
        message:
          "Someone who shares this expense has left the group, so it can't be changed until it's settled.",
      },
    };
    const edit = await call(
      editExpenseRoute as Handler,
      ana,
      "PATCH",
      { groupId, expenseId: shared },
      {
        description: "Weekly groceries",
        amountCents: 1000,
        spentOn: "2026-11-01",
        mode: "even",
        sharedBy: [ana],
      },
    );
    expect(edit.status).toBe(409);
    expect(await edit.json()).toEqual(locked);

    const remove = await call(deleteExpenseRoute as Handler, ana, "DELETE", {
      groupId,
      expenseId: shared,
    });
    expect(remove.status).toBe(409);
    expect(await remove.json()).toEqual(locked);
    expect(await expenseDescriptions(ana, groupId)).toEqual([
      "Bread",
      "Groceries",
    ]);
  });

  it("keeps a group with one member left working, and they can invite someone", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [ana, ren] = memberIds;
    const email = uniqueEmail();
    const { data: jo, error } = await db
      .from("users")
      .insert({ email, password_hash: "hash", name: "Jo" })
      .select("id")
      .single();
    if (error) {
      throw error;
    }
    trackUser(jo.id as string);

    expect((await leave(ren, groupId)).status).toBe(204);

    expect((await groupAs(ana, groupId)).archivedAt).toBeNull();
    expect((await addExpense(ana, groupId, [ana])).status).toBe(201);
    expect(
      (await call(inviteRoute as Handler, ana, "POST", { groupId }, { email }))
        .status,
    ).toBe(201);
  });

  it("archives the group when the last member leaves, read-only for everyone who was in it", async () => {
    const { groupId, memberIds } = await createGroupWithMembers(2);
    const [ana, ren] = memberIds;
    expect((await leave(ren, groupId)).status).toBe(204);

    expect((await leave(ana, groupId)).status).toBe(204);

    for (const userId of [ana, ren]) {
      expect((await groupAs(userId, groupId)).readOnly).toBe(true);
      expect((await addExpense(userId, groupId, [userId])).status).toBe(403);
    }
    expect((await groupAs(ana, groupId)).archivedAt).not.toBeNull();
  });

  it("refuses to leave a personal space with 403", async () => {
    const { data, error } = await db.rpc("register_user", {
      p_email: uniqueEmail(),
      p_password_hash: "hash",
      p_name: "Ana",
    });
    if (error) {
      throw error;
    }
    const ana = data as string;
    trackUser(ana);
    const space = await db
      .from("groups")
      .select("id")
      .eq("created_by", ana)
      .eq("is_personal", true)
      .single();
    if (space.error) {
      throw space.error;
    }

    const response = await leave(ana, space.data.id as string);

    expect(response.status).toBe(403);
    expect((await groupAs(ana, space.data.id as string)).readOnly).toBe(false);
  });
});
