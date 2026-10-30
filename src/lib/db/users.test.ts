// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError } from "@/lib/http/errors";
import { findUserByEmail, findUserById, insertUser } from "./users";

type Result = {
  data: unknown;
  error: { code: string; message: string } | null;
};

const calls: { method: string; args: unknown[] }[] = [];
let result: Result;

function queryBuilder() {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "insert", "eq"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  for (const method of ["maybeSingle", "single"]) {
    builder[method] = async () => {
      calls.push({ method, args: [] });
      return result;
    };
  }
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

const publicRow = {
  id: "6f1c2d4e-1111-4222-8333-944455556666",
  email: "sam@example.com",
  name: "Sam Lee",
  created_at: "2026-10-30T12:00:00+00:00",
  updated_at: "2026-10-30T12:00:00+00:00",
};
const row = { ...publicRow, password_hash: "$2b$12$hash" };

beforeEach(() => {
  calls.length = 0;
  result = { data: null, error: null };
});

describe("findUserByEmail", () => {
  it("maps the row to camelCase, including the password hash", async () => {
    result = { data: row, error: null };
    expect(await findUserByEmail("sam@example.com")).toEqual({
      id: row.id,
      email: "sam@example.com",
      name: "Sam Lee",
      passwordHash: "$2b$12$hash",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
    expect(calls).toContainEqual({ method: "from", args: ["users"] });
    expect(calls).toContainEqual({
      method: "eq",
      args: ["email", "sam@example.com"],
    });
  });

  it("returns null when no user has that email", async () => {
    expect(await findUserByEmail("nobody@example.com")).toBeNull();
  });

  it("throws when the query fails", async () => {
    result = { data: null, error: { code: "XX000", message: "boom" } };
    await expect(findUserByEmail("sam@example.com")).rejects.toThrow(/boom/);
  });
});

describe("findUserById", () => {
  it("returns the user without the password hash", async () => {
    result = { data: publicRow, error: null };
    const user = await findUserById(row.id);
    expect(user).toEqual({
      id: row.id,
      email: "sam@example.com",
      name: "Sam Lee",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
    expect(user).not.toHaveProperty("passwordHash");
    const select = calls.find((call) => call.method === "select");
    expect(String(select?.args[0])).not.toContain("password_hash");
  });

  it("returns null for an unknown id", async () => {
    expect(await findUserById(row.id)).toBeNull();
  });

  it("throws when the query fails", async () => {
    result = { data: null, error: { code: "XX000", message: "boom" } };
    await expect(findUserById(row.id)).rejects.toThrow(/boom/);
  });
});

describe("insertUser", () => {
  it("writes snake_case columns and returns the new user", async () => {
    result = { data: publicRow, error: null };
    const user = await insertUser({
      email: "sam@example.com",
      name: "Sam Lee",
      passwordHash: "$2b$12$hash",
    });
    expect(calls).toContainEqual({
      method: "insert",
      args: [
        {
          email: "sam@example.com",
          name: "Sam Lee",
          password_hash: "$2b$12$hash",
        },
      ],
    });
    expect(user.id).toBe(row.id);
    expect(user).not.toHaveProperty("passwordHash");
  });

  it("turns a unique violation on email into a ConflictError", async () => {
    result = {
      data: null,
      error: { code: "23505", message: "duplicate key users_email_key" },
    };
    await expect(
      insertUser({ email: "sam@example.com", name: "Sam", passwordHash: "x" }),
    ).rejects.toEqual(
      new ConflictError("An account with this email already exists."),
    );
  });

  it("throws other database errors as they are", async () => {
    result = { data: null, error: { code: "XX000", message: "boom" } };
    await expect(
      insertUser({ email: "sam@example.com", name: "Sam", passwordHash: "x" }),
    ).rejects.toThrow(/boom/);
  });
});
