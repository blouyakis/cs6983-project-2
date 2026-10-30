// @vitest-environment node
import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/auth/logout", () => {
  it("clears the session cookie", async () => {
    const response = await POST();

    expect(response.status).toBe(204);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^session=;/);
    expect(cookie).toMatch(/Max-Age=0/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/Path=\//);
  });
});
