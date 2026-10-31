import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
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

function migratedTables(): string[] {
  const dir = new URL("../migrations/", import.meta.url);
  const tables = new Set<string>();
  for (const file of readdirSync(dir)) {
    const sql = readFileSync(new URL(file, dir), "utf8");
    for (const match of sql.matchAll(/^create table public\.(\w+)/gm)) {
      tables.add(match[1]);
    }
  }
  return [...tables];
}

async function tableIsServed(
  url: string,
  key: string,
  table: string,
): Promise<boolean> {
  try {
    const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=0`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    return response.ok;
  } catch {
    // Not listening yet.
    return false;
  }
}

// Right after `npx supabase db reset`, the API answers "Retrying the
// connection" for a few seconds. When the reset added a table, the API can
// also keep serving its old schema cache for a while, so a new table answers
// PGRST205 although older ones work. Wait until every migrated table is served.
async function waitForApi(url: string, key: string): Promise<void> {
  const deadline = Date.now() + 60_000;
  let missing = migratedTables();
  while (Date.now() < deadline) {
    const served = await Promise.all(
      missing.map((table) => tableIsServed(url, key, table)),
    );
    missing = missing.filter((_, index) => !served[index]);
    if (missing.length === 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  fail(
    `Local Supabase did not serve ${missing.join(", ")} within 60 seconds. ` +
      "Run `npx supabase db reset` to apply the migrations.",
  );
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
