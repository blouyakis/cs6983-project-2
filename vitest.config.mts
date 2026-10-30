import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

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
          globalSetup: ["./supabase/tests/global-setup.ts"],
          setupFiles: ["./supabase/tests/setup.ts"],
        },
      },
    ],
  },
});
