import "server-only";
import { getDb } from "./client";

// Whether the database answers a cheap query (#100). It never throws and
// never passes the error on, so the health check can't leak what went wrong.
export async function pingDatabase(): Promise<boolean> {
  try {
    const { error } = await getDb().rpc("db_now", {});
    return error === null;
  } catch {
    return false;
  }
}
