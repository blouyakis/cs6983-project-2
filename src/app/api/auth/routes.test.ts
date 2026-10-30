// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
};
let rows: Row[] = [];

vi.mock("@/lib/db/client", () => ({
  getDb: () => ({
    from: () => {
      let filter: { col: keyof Row; val: string } | null = null;
      let columns: string[] | null = null;
      let pendingInsert: Partial<Row> | null = null;
      const project = (row: Row | null) =>
        row && columns
          ? Object.fromEntries(columns.map((c) => [c, row[c as keyof Row]]))
          : row;
      const find = () =>
        rows.find((r) => r[filter!.col] === filter!.val) ?? null;
      const q = {
        select: (cols: string) => {
          columns = cols.split(",").map((c) => c.trim());
          return q;
        },
        eq: (col: keyof Row, val: string) => {
          filter = { col, val };
          return q;
        },
        insert: (v: Partial<Row>) => {
          pendingInsert = v;
          return q;
        },
        maybeSingle: async () => ({ data: project(find()) }),
        single: async () => {
          if (rows.some((r) => r.email === pendingInsert!.email)) {
            return { data: null, error: { code: "23505" } };
          }
          const row = {
            id: `id-${rows.length + 1}`,
            created_at: "2026-01-01T00:00:00Z",
            ...pendingInsert,
          } as Row;
          rows.push(row);
          return { data: project(row), error: null };
        },
      };
      return q;
    },
  }),
}));

import { POST as register } from "./register/route";
import { POST as login } from "./login/route";
import { POST as logout } from "./logout/route";
import { GET as me } from "./me/route";

const post = (body: unknown) =>
  new Request("http://localhost/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  rows = [];
  process.env.JWT_SECRET = "x".repeat(32);
});

describe("register", () => {
  it("creates a user with a hashed password and returns a token", async () => {
    const res = await register(
      post({ email: "Ann@Example.com", password: "password1" }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.user.email).toBe("ann@example.com");
    expect(body.user.password_hash).toBeUndefined();
    expect(rows[0].password_hash).not.toBe("password1");
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/);
  });

  it("rejects short passwords", async () => {
    const res = await register(post({ email: "a@b.co", password: "short" }));
    expect(res.status).toBe(400);
    expect(rows).toHaveLength(0);
  });

  it("rejects duplicate emails", async () => {
    await register(post({ email: "a@b.co", password: "password1" }));
    const res = await register(
      post({ email: "A@b.co", password: "password2" }),
    );
    expect(res.status).toBe(409);
  });
});

describe("login", () => {
  beforeEach(async () => {
    await register(post({ email: "a@b.co", password: "password1" }));
  });

  it("returns a token that authenticates /me", async () => {
    const res = await login(post({ email: "a@b.co", password: "password1" }));
    expect(res.status).toBe(200);
    const { token } = await res.json();
    const meRes = await me(
      new Request("http://localhost/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(meRes.status).toBe(200);
    expect((await meRes.json()).user.email).toBe("a@b.co");
  });

  it("rejects a wrong password and an unknown email with 401", async () => {
    expect(
      (await login(post({ email: "a@b.co", password: "nope-nope" }))).status,
    ).toBe(401);
    expect(
      (await login(post({ email: "x@b.co", password: "password1" }))).status,
    ).toBe(401);
  });
});

describe("me", () => {
  it("returns 401 without or with an invalid token", async () => {
    expect((await me(new Request("http://localhost/api/auth/me"))).status).toBe(
      401,
    );
    const bad = await me(
      new Request("http://localhost/api/auth/me", {
        headers: { Authorization: "Bearer garbage" },
      }),
    );
    expect(bad.status).toBe(401);
  });

  it("accepts the session cookie", async () => {
    const { token } = await (
      await register(post({ email: "a@b.co", password: "password1" }))
    ).json();
    const res = await me(
      new Request("http://localhost/api/auth/me", {
        headers: { cookie: `session=${token}` },
      }),
    );
    expect(res.status).toBe(200);
  });
});

describe("logout", () => {
  it("clears the session cookie", async () => {
    const res = await logout();
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/session=;/);
    expect(res.headers.get("set-cookie")).toMatch(/Max-Age=0/i);
  });
});
