import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  toErrorResponse,
} from "./errors";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("typed errors", () => {
  it.each([
    [new ValidationError("Bad input."), 400, "VALIDATION_ERROR"],
    [new UnauthorizedError(), 401, "UNAUTHORIZED"],
    [new ForbiddenError(), 403, "FORBIDDEN"],
    [new NotFoundError(), 404, "NOT_FOUND"],
    [new ConflictError("Taken."), 409, "CONFLICT"],
  ])("%s has status %i and code %s", (error, status, code) => {
    expect(error.status).toBe(status);
    expect(error.code).toBe(code);
    expect(error).toBeInstanceOf(Error);
  });
});

describe("toErrorResponse", () => {
  it("returns the OpenAPI error body with the error's status", async () => {
    const response = toErrorResponse(
      new ConflictError("An account with this email already exists."),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: "CONFLICT",
        message: "An account with this email already exists.",
      },
    });
  });

  it("includes field errors for a validation error", async () => {
    const response = toErrorResponse(
      new ValidationError("Check the highlighted fields.", {
        password: "Password must be at least 8 characters.",
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Check the highlighted fields.",
        fields: { password: "Password must be at least 8 characters." },
      },
    });
  });

  it("hides unexpected errors behind a generic 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = toErrorResponse(new Error("connection string leaked"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Something went wrong." },
    });
    expect(JSON.stringify(body)).not.toContain("leaked");
  });
});
