import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { ApiDocs } from "@/components/api-docs/ApiDocs";

export const metadata: Metadata = { title: "API docs · LifeBoard" };

// Read once at build time: the spec is the same for every request, so the
// page is prerendered with it and the file isn't needed at run time.
const spec = readFileSync(join(process.cwd(), "docs/api/openapi.yaml"), "utf8");

// Public (#16): it shows only the spec, which is in the repository anyway.
export default function ApiDocsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <h1 className="text-2xl font-semibold">LifeBoard API</h1>
      {/* Swagger UI's group headings are h3, so this keeps the headings in
          order (AGENTS.md Section 8). */}
      <h2 className="sr-only">Routes</h2>
      <ApiDocs spec={spec} />
    </main>
  );
}
