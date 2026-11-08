// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const pingDatabase = vi.fn<() => Promise<boolean>>();

const connection = vi.fn(async () => undefined);

vi.mock("@/lib/db/health", () => ({
  pingDatabase: () => pingDatabase(),
}));

// connection() needs a request scope, which a unit test doesn't have.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: () => connection(),
}));

beforeEach(() => {
  pingDatabase.mockReset();
  connection.mockClear();
});

describe("GET /api/health", () => {
  it("answers 200 ok when the database answers", async () => {
    pingDatabase.mockResolvedValue(true);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("answers 503 with no error detail when the database doesn't", async () => {
    pingDatabase.mockResolvedValue(false);

    const response = await GET();

    expect(response.status).toBe(503);
    // toEqual, so any extra field, such as a message, fails the test.
    expect(await response.json()).toEqual({ status: "error" });
  });

  it.each([true, false])("is never cached (database up: %s)", async (up) => {
    pingDatabase.mockResolvedValue(up);

    const response = await GET();

    expect(response.headers.get("cache-control")).toBe("no-store");
    // So it runs on every request instead of being prerendered at build.
    expect(connection).toHaveBeenCalled();
  });
});
