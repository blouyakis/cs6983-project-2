import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Database tests that call a function touching every user, such as
// ensure_personal_spaces. Run beside the other files, they reach the users
// those files are creating and deleting (#79).
const WHOLE_TABLE_DB_TESTS = ["supabase/tests/ensure-personal-spaces.test.ts"];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      "server-only": new URL(
        "./node_modules/server-only/empty.js",
        import.meta.url,
      ).pathname,
    },
  },
  test: {
    coverage: {
      provider: "v8",
      // Count files no test imports, so untested code lowers the number.
      include: ["src/**/*.{ts,tsx}"],
      // The root layout only wires fonts and global CSS.
      exclude: ["src/app/layout.tsx"],
      // AGENTS.md Section 4.
      thresholds: {
        lines: 80,
        "src/lib/domain/**": { 100: true },
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          include: ["src/**/*.test.{ts,tsx}"],
        },
      },
      {
        // Needs local Supabase: npx supabase start
        extends: true,
        test: {
          name: "db",
          environment: "node",
          include: ["supabase/tests/**/*.test.ts"],
          exclude: WHOLE_TABLE_DB_TESTS,
          globalSetup: ["./supabase/tests/global-setup.ts"],
          setupFiles: ["./supabase/tests/setup.ts"],
        },
      },
      {
        // The files above run in parallel, each on its own rows. These call a
        // function that writes to every user, so they wait until the files
        // above are done (#79).
        extends: true,
        test: {
          name: "db-whole-table",
          environment: "node",
          include: WHOLE_TABLE_DB_TESTS,
          globalSetup: ["./supabase/tests/global-setup.ts"],
          setupFiles: ["./supabase/tests/setup.ts"],
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
