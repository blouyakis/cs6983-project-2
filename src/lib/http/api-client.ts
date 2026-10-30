import type { FieldErrors } from "./errors";

export type ApiError = {
  code: string;
  message: string;
  fields?: FieldErrors;
};

export type ApiResult = { ok: true } | { ok: false; error: ApiError };

const NETWORK_ERROR: ApiError = {
  code: "NETWORK_ERROR",
  message: "Something went wrong. Try again.",
};

// For Client Components: posts JSON and reads the OpenAPI error body.
export async function postJson(url: string, body: unknown): Promise<ApiResult> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
  if (response.ok) {
    return { ok: true };
  }
  try {
    const { error } = (await response.json()) as { error: ApiError };
    return { ok: false, error };
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
}
