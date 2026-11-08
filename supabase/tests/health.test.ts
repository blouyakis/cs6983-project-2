// The health check (#100) against the real database: the unit tests mock
// Supabase, so only this catches db_now missing or not granted to the
// service role our server uses.
import { describe, expect, it } from "vitest";
import { pingDatabase } from "@/lib/db/health";

describe("pingDatabase", () => {
  it("is true against the local database", async () => {
    await expect(pingDatabase()).resolves.toBe(true);
  });
});
