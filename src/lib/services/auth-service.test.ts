// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import { verifySession } from "@/lib/auth/session";
import type { User, UserWithPasswordHash } from "@/lib/db/users";
import { ConflictError, UnauthorizedError } from "@/lib/http/errors";
import { getCurrentUser, login, register } from "./auth-service";

const db = vi.hoisted(() => ({
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
  insertUser: vi.fn(),
}));

vi.mock("@/lib/db/users", () => db);

const sam: User = {
  id: "6f1c2d4e-1111-4222-8333-944455556666",
  email: "sam@example.com",
  name: "Sam Lee",
  createdAt: "2026-10-30T12:00:00+00:00",
  updatedAt: "2026-10-30T12:00:00+00:00",
};

const originalSecret = process.env.JWT_SECRET;

beforeEach(() => {
  process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";
  vi.resetAllMocks();
});

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = originalSecret;
  }
});

describe("register", () => {
  const input = {
    name: "Sam Lee",
    email: "sam@example.com",
    password: "correct horse",
  };

  it("stores a bcrypt hash, never the password, and returns a session for the new user", async () => {
    db.findUserByEmail.mockResolvedValue(null);
    db.insertUser.mockResolvedValue(sam);

    const { user, token } = await register(input);

    expect(user).toEqual(sam);
    expect(await verifySession(token)).toBe(sam.id);
    const stored = db.insertUser.mock.calls[0][0];
    expect(stored).toEqual({
      email: "sam@example.com",
      name: "Sam Lee",
      passwordHash: expect.stringMatching(/^\$2[aby]\$12\$/),
    });
    expect(JSON.stringify(stored)).not.toContain("correct horse");
  });

  it("rejects an email that already has an account", async () => {
    db.findUserByEmail.mockResolvedValue({ ...sam, passwordHash: "x" });

    await expect(register(input)).rejects.toEqual(
      new ConflictError("An account with this email already exists."),
    );
    expect(db.insertUser).not.toHaveBeenCalled();
  });

  it("passes on a conflict from a registration that raced this one", async () => {
    db.findUserByEmail.mockResolvedValue(null);
    db.insertUser.mockRejectedValue(
      new ConflictError("An account with this email already exists."),
    );

    await expect(register(input)).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("login", () => {
  let samWithHash: UserWithPasswordHash;

  beforeEach(async () => {
    samWithHash = {
      ...sam,
      passwordHash: await hashPassword("correct horse"),
    };
  });

  it("returns the user, without the hash, and a session token", async () => {
    db.findUserByEmail.mockResolvedValue(samWithHash);

    const { user, token } = await login({
      email: "sam@example.com",
      password: "correct horse",
    });

    expect(user).toEqual(sam);
    expect(user).not.toHaveProperty("passwordHash");
    expect(await verifySession(token)).toBe(sam.id);
  });

  it("gives the same generic message for a wrong password and an unknown email", async () => {
    const generic = new UnauthorizedError("Email or password is incorrect.");

    db.findUserByEmail.mockResolvedValue(samWithHash);
    await expect(
      login({ email: "sam@example.com", password: "wrong horse" }),
    ).rejects.toEqual(generic);

    db.findUserByEmail.mockResolvedValue(null);
    await expect(
      login({ email: "nobody@example.com", password: "correct horse" }),
    ).rejects.toEqual(generic);
  });
});

describe("getCurrentUser", () => {
  it("returns the user for the session's id", async () => {
    db.findUserById.mockResolvedValue(sam);
    expect(await getCurrentUser(sam.id)).toEqual(sam);
    expect(db.findUserById).toHaveBeenCalledWith(sam.id);
  });

  it("treats a session for a user who no longer exists as logged out", async () => {
    db.findUserById.mockResolvedValue(null);
    await expect(getCurrentUser(sam.id)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });
});
