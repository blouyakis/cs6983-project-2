import "server-only";
import { getDb } from "./client";

// How long the health check waits for the database. Node's fetch only times
// out a connection that never opens (after 10 s); one that opens and never
// answers would otherwise hold the check open for minutes.
export const PING_TIMEOUT_MS = 3000;

const LOG_PREFIX = "Health check: the database did not answer.";

// postgrest-js puts the real cause of a network failure, such as
// ECONNREFUSED, in `details` as a "Caused by: …" line between the fetch error
// and the stack. Only that line is logged: the stack is noise, and other
// details can hold row values.
function causeOf(details: string | undefined): string | null {
  const line = details
    ?.split("\n")
    .find((text) => text.startsWith("Caused by: "));
  return line ? line.slice("Caused by: ".length) : null;
}

// Whether the database answers a cheap query (#100). It never throws and
// never returns the error, so the public health check can't leak it. Why it
// failed goes to the server log only.
export async function pingDatabase(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  try {
    const { error } = await getDb()
      .rpc("db_now", {})
      .abortSignal(controller.signal);
    if (error) {
      // A network failure or a timeout comes back with an empty code.
      const summary = error.code
        ? `${error.code}: ${error.message}`
        : error.message;
      const cause = causeOf(error.details);
      console.error(LOG_PREFIX, cause ? `${summary} (${cause})` : summary);
      return false;
    }
    return true;
  } catch (thrown) {
    // getDb() throws when an env variable is missing, and an aborted query
    // may throw instead of returning an error.
    console.error(
      LOG_PREFIX,
      thrown instanceof Error ? thrown.message : String(thrown),
    );
    return false;
  } finally {
    clearTimeout(timer);
  }
}
