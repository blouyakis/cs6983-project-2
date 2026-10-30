import { afterEach, describe, expect, it } from "vitest";
import { getDb } from "./client";

const originalUrl = process.env.SUPABASE_URL;
const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

afterEach(() => {
  if (originalUrl === undefined) {
    delete process.env.SUPABASE_URL;
  } else {
    process.env.SUPABASE_URL = originalUrl;
  }
  if (originalKey === undefined) {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  } else {
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
});

describe("getDb", () => {
  it("throws when SUPABASE_URL is missing", () => {
    delete process.env.SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    expect(() => getDb()).toThrow(/SUPABASE_URL/);
  });

  it("throws when SUPABASE_SERVICE_ROLE_KEY is missing", () => {
    process.env.SUPABASE_URL = "http://127.0.0.1:54321";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => getDb()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("returns a client when both env vars are set", () => {
    process.env.SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    expect(getDb()).toEqual(
      expect.objectContaining({ from: expect.any(Function) }),
    );
  });
});
