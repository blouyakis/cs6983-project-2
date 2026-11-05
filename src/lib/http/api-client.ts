import type { FieldErrors } from "./errors";
import { goToLogin } from "./go-to-login";

export type ApiError = {
  code: string;
  message: string;
  fields?: FieldErrors;
};

// `data` is the parsed response body, or undefined when there is none (204).
export type ApiResult<T = unknown> =
  { ok: true; data: T } | { ok: false; error: ApiError };

const NETWORK_ERROR: ApiError = {
  code: "NETWORK_ERROR",
  message: "Something went wrong. Try again.",
};

// A DELETE has no body, so it sends no content type either.
async function sendJson<T>(
  method: "POST" | "PATCH" | "DELETE",
  url: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(
      url,
      method === "DELETE"
        ? { method }
        : {
            method,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          },
    );
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
  let parsed: unknown;
  try {
    const text = await response.text();
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
  if (response.ok) {
    return { ok: true, data: parsed as T };
  }
  // An expired session (AGENTS.md Section 8). A 401 from /api/auth is a wrong
  // password, which the login form shows itself.
  if (response.status === 401 && !url.startsWith("/api/auth/")) {
    goToLogin();
  }
  const error = (parsed as { error?: ApiError } | undefined)?.error;
  return { ok: false, error: error ?? NETWORK_ERROR };
}

// For Client Components: sends JSON and reads the OpenAPI error body.
export function postJson<T = unknown>(
  url: string,
  body: unknown,
): Promise<ApiResult<T>> {
  return sendJson<T>("POST", url, body);
}

export function patchJson<T = unknown>(
  url: string,
  body: unknown,
): Promise<ApiResult<T>> {
  return sendJson<T>("PATCH", url, body);
}

export function deleteJson<T = unknown>(url: string): Promise<ApiResult<T>> {
  return sendJson<T>("DELETE", url);
}
