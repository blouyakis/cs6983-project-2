import type { FieldErrors } from "./errors";

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

async function sendJson<T>(
  method: "POST" | "PATCH",
  url: string,
  body: unknown,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
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
