// The db test files run in parallel against one database (#79). A function
// that touches every user, like ensure_personal_spaces, reaches the rows other
// files are creating and deleting, which broke their cleanup at random. So a
// file that calls one must run in a later project, after the parallel ones.
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import config from "../../vitest.config.mjs";

const WHOLE_TABLE_FUNCTIONS = ["ensure_personal_spaces"];

type Project = {
  test?: {
    name?: string;
    include?: string[];
    exclude?: string[];
    sequence?: { groupOrder?: number };
  };
};

const projects = (config.test?.projects ?? []) as Project[];

function project(name: string): Project["test"] {
  const found = projects.find((p) => p.test?.name === name);
  if (!found) {
    throw new Error(`No vitest project named ${name}`);
  }
  return found.test;
}

function filesCallingWholeTableFunctions(): string[] {
  const dir = new URL("./", import.meta.url);
  return readdirSync(dir)
    .filter(
      (file) => file.endsWith(".test.ts") && file !== "test-projects.test.ts",
    )
    .filter((file) => {
      const source = readFileSync(new URL(file, dir), "utf8");
      return WHOLE_TABLE_FUNCTIONS.some((name) => source.includes(`"${name}"`));
    })
    .map((file) => `supabase/tests/${file}`);
}

describe("db test projects", () => {
  const files = filesCallingWholeTableFunctions();

  it("finds the files that call a whole-table function", () => {
    expect(files).toContain("supabase/tests/ensure-personal-spaces.test.ts");
  });

  it.each(files)(
    "runs %s after the parallel db files, not beside them",
    (file) => {
      const db = project("db");
      expect(db?.exclude ?? []).toContain(file);

      const later = projects
        .map((p) => p.test)
        .find((p) => p?.include?.includes(file));
      expect(later).toBeDefined();
      expect(later?.sequence?.groupOrder ?? 0).toBeGreaterThan(
        db?.sequence?.groupOrder ?? 0,
      );
    },
  );
});
