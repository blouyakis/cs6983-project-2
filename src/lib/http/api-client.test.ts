import { afterEach, describe, expect, it, vi } from "vitest";
import { patchJson, postJson } from "./api-client";

function respond(status: number, body?: unknown) {
  return vi.fn().mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("postJson", () => {
  it("sends the body as JSON and returns the response data", async () => {
    const fetchMock = respond(201, { group: { id: "g1" } });
    vi.stubGlobal("fetch", fetchMock);

    const result = await postJson<{ group: { id: string } }>("/api/groups", {
      name: "Flat",
    });

    expect(result).toEqual({ ok: true, data: { group: { id: "g1" } } });
    expect(fetchMock).toHaveBeenCalledWith("/api/groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Flat" }),
    });
  });

  it("succeeds with no data when the response has no body", async () => {
    vi.stubGlobal("fetch", respond(204));

    expect(await postJson("/api/auth/logout", {})).toEqual({
      ok: true,
      data: undefined,
    });
  });

  it("returns the error body from the OpenAPI spec", async () => {
    const error = { code: "NOT_FOUND", message: "No LifeBoard account." };
    vi.stubGlobal("fetch", respond(404, { error }));

    expect(await postJson("/api/x", {})).toEqual({ ok: false, error });
  });

  it("reports a network error when fetch fails or the error isn't JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    expect((await postJson("/api/x", {})).ok).toBe(false);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("oops", { status: 500 })),
    );
    const result = await postJson("/api/x", {});
    expect(result).toEqual({
      ok: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Something went wrong. Try again.",
      },
    });
  });
});

describe("patchJson", () => {
  it("sends a PATCH and returns the response data", async () => {
    const fetchMock = respond(200, { group: { id: "g1", name: "Dorm" } });
    vi.stubGlobal("fetch", fetchMock);

    const result = await patchJson("/api/groups/g1", { name: "Dorm" });

    expect(result).toEqual({
      ok: true,
      data: { group: { id: "g1", name: "Dorm" } },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/groups/g1",
      expect.objectContaining({ method: "PATCH" }),
    );
  });
});
