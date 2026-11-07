// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signSession } from "@/lib/auth/session";
import { GET } from "./route";

const service = vi.hoisted(() => ({ getOverview: vi.fn() }));
vi.mock("@/lib/services/overview-service", () => service);

const userId = "6f1c2d4e-1111-4222-8333-944455556666";
const originalSecret = process.env.JWT_SECRET;

const overview = {
  netCents: -383,
  owingCents: 883,
  owedCents: 500,
  groupShareThisPeriodCents: 7271,
  personal: null,
  groups: [],
  readOnlyGroups: [],
};

function request(cookie?: string) {
  return new NextRequest("http://localhost/api/overview", {
    headers: cookie ? { cookie } : {},
  });
}

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

describe("GET /api/overview", () => {
  it("returns the session user's overview", async () => {
    service.getOverview.mockResolvedValue(overview);

    const response = await GET(request(`session=${await signSession(userId)}`));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ overview });
    expect(service.getOverview).toHaveBeenCalledWith(userId);
  });

  it("returns 401 without a session, without asking the service", async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(service.getOverview).not.toHaveBeenCalled();
  });
});
