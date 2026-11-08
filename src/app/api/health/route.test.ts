// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const checkHealth = vi.fn<() => Promise<"ok" | "error">>();

const connection = vi.fn(async () => undefined);

// The route calls the service, never lib/db (AGENTS.md Section 2).
vi.mock("@/lib/services/health-service", () => ({
  checkHealth: () => checkHealth(),
}));

// connection() needs a request scope, which a unit test doesn't have.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: () => connection(),
}));

beforeEach(() => {
  checkHealth.mockReset();
  connection.mockClear();
});

describe("GET /api/health", () => {
  it("answers 200 ok when the database answers", async () => {
    checkHealth.mockResolvedValue("ok");

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("answers 503 with no error detail when the database doesn't", async () => {
    checkHealth.mockResolvedValue("error");

    const response = await GET();

    expect(response.status).toBe(503);
    // toEqual, so any extra field, such as a message, fails the test.
    expect(await response.json()).toEqual({ status: "error" });
  });

  it.each(["ok", "error"] as const)(
    "is never cached (status: %s)",
    async (status) => {
      checkHealth.mockResolvedValue(status);

      const response = await GET();

      expect(response.headers.get("cache-control")).toBe("no-store");
      // So it runs on every request instead of being prerendered at build.
      expect(connection).toHaveBeenCalled();
    },
  );
});
