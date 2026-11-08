// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkHealth } from "./health-service";

const health = vi.hoisted(() => ({ pingDatabase: vi.fn() }));
vi.mock("@/lib/db/health", () => health);

beforeEach(() => {
  health.pingDatabase.mockReset();
});

describe("checkHealth", () => {
  it("is ok when the database answers", async () => {
    health.pingDatabase.mockResolvedValue(true);

    await expect(checkHealth()).resolves.toBe("ok");
  });

  it("is error when the database doesn't", async () => {
    health.pingDatabase.mockResolvedValue(false);

    await expect(checkHealth()).resolves.toBe("error");
  });
});
