import { execFileSync } from "node:child_process";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    supabaseUrl: string;
    serviceRoleKey: string;
    anonKey: string;
  }
}

// Vitest can crash while printing a global setup error's stack, which hides
// the message, so print it before throwing.
function fail(message: string): never {
  console.error(`\n${message}\n`);
  throw new Error(message);
}

function readLocalSupabase(): Record<string, string> {
  let output: string;
  try {
    output = execFileSync("npx", ["supabase", "status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    fail("Local Supabase is not running. Start it with `npx supabase start`.");
  }
  const values: Record<string, string> = {};
  for (const line of output.split("\n")) {
    const match = /^([A-Z_]+)="(.*)"$/.exec(line.trim());
    if (match) {
      values[match[1]] = match[2];
    }
  }
  return values;
}

// Right after `npx supabase db reset`, the API answers "Retrying the
// connection" for a second or two while it reconnects to Postgres.
async function waitForApi(url: string, key: string): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/rest/v1/users?select=id&limit=0`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (response.ok) {
        return;
      }
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  fail("Local Supabase did not become ready within 15 seconds.");
}

export default async function setup(project: TestProject) {
  const { API_URL, SERVICE_ROLE_KEY, ANON_KEY } = readLocalSupabase();
  if (!API_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
    fail(
      "`supabase status` did not print API_URL, SERVICE_ROLE_KEY and ANON_KEY.",
    );
  }
  await waitForApi(API_URL, SERVICE_ROLE_KEY);
  project.provide("supabaseUrl", API_URL);
  project.provide("serviceRoleKey", SERVICE_ROLE_KEY);
  project.provide("anonKey", ANON_KEY);
}
