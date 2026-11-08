// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PING_TIMEOUT_MS, pingDatabase } from "./health";

type Result = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

const rpcCalls: { name: string; params: unknown }[] = [];
// Given the signal the query was sent with, so a test can answer only once
// it is aborted.
let answer: (signal: AbortSignal) => Promise<Result>;
let clientError: Error | null;

vi.mock("./client", () => ({
  getDb: () => {
    if (clientError) {
      throw clientError;
    }
    return {
      rpc: (name: string, params: unknown) => {
        rpcCalls.push({ name, params });
        return {
          abortSignal: (signal: AbortSignal) => answer(signal),
        };
      },
    };
  },
}));

let logged: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  rpcCalls.length = 0;
  clientError = null;
  logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  logged.mockRestore();
  vi.useRealTimers();
});

describe("pingDatabase", () => {
  it("is true when the database answers db_now, and logs nothing", async () => {
    answer = async () => ({
      data: "2026-11-07T12:00:00.123456+00:00",
      error: null,
    });

    await expect(pingDatabase()).resolves.toBe(true);
    expect(rpcCalls).toEqual([{ name: "db_now", params: {} }]);
    expect(logged).not.toHaveBeenCalled();
  });

  // supabase-js turns a network failure into this error, not a throw.
  it("is false when the query returns an error, and logs its code and message on the server", async () => {
    answer = async () => ({
      data: null,
      error: { code: "PGRST000", message: "connection refused" },
    });

    await expect(pingDatabase()).resolves.toBe(false);
    const line = logged.mock.calls.flat().join(" ");
    expect(line).toContain("PGRST000");
    expect(line).toContain("connection refused");
  });

  it("is false when the client can't be created, such as a missing env variable, and logs why", async () => {
    clientError = new Error("SUPABASE_URL is required.");

    await expect(pingDatabase()).resolves.toBe(false);
    expect(logged.mock.calls.flat().join(" ")).toContain(
      "SUPABASE_URL is required.",
    );
  });

  it(`gives up after ${PING_TIMEOUT_MS} ms when the database never answers`, async () => {
    vi.useFakeTimers();
    answer = (signal) =>
      new Promise((_, reject) => {
        signal.addEventListener("abort", () =>
          reject(new DOMException("This operation was aborted", "AbortError")),
        );
      });

    let result: boolean | undefined;
    const ping = pingDatabase().then((up) => {
      result = up;
    });

    await vi.advanceTimersByTimeAsync(PING_TIMEOUT_MS - 1);
    expect(result).toBeUndefined();

    await vi.advanceTimersByTimeAsync(1);
    await ping;
    expect(result).toBe(false);
    expect(logged).toHaveBeenCalled();
  });

  it("allows a few seconds, well under a monitor's own timeout", () => {
    expect(PING_TIMEOUT_MS).toBe(3000);
  });
});
