// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pingDatabase } from "./health";

type Result = { data: unknown; error: { message: string } | null };

const rpcCalls: { name: string; params: unknown }[] = [];
let answer: () => Promise<Result>;

vi.mock("./client", () => ({
  getDb: () => ({
    rpc: (name: string, params: unknown) => {
      rpcCalls.push({ name, params });
      return answer();
    },
  }),
}));

beforeEach(() => {
  rpcCalls.length = 0;
});

describe("pingDatabase", () => {
  it("is true when the database answers db_now", async () => {
    answer = async () => ({
      data: "2026-11-07T12:00:00.123456+00:00",
      error: null,
    });

    await expect(pingDatabase()).resolves.toBe(true);
    expect(rpcCalls).toEqual([{ name: "db_now", params: {} }]);
  });

  it("is false when the query returns an error", async () => {
    answer = async () => ({
      data: null,
      error: { message: "connection refused" },
    });

    await expect(pingDatabase()).resolves.toBe(false);
  });

  it("is false when the query throws, such as on a network failure", async () => {
    answer = async () => {
      throw new TypeError("fetch failed");
    };

    await expect(pingDatabase()).resolves.toBe(false);
  });
});
