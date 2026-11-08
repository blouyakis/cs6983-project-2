import "server-only";
import { pingDatabase } from "@/lib/db/health";

export type HealthStatus = "ok" | "error";

// Whether the app can serve requests (#100). Today that means the database
// answers; anything else the app comes to depend on is checked here too.
export async function checkHealth(): Promise<HealthStatus> {
  return (await pingDatabase()) ? "ok" : "error";
}
