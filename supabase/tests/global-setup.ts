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

export default function setup(project: TestProject) {
  const { API_URL, SERVICE_ROLE_KEY, ANON_KEY } = readLocalSupabase();
  if (!API_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
    fail(
      "`supabase status` did not print API_URL, SERVICE_ROLE_KEY and ANON_KEY.",
    );
  }
  project.provide("supabaseUrl", API_URL);
  project.provide("serviceRoleKey", SERVICE_ROLE_KEY);
  project.provide("anonKey", ANON_KEY);
}
