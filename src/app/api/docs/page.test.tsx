import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ApiDocsPage from "./page";

// Swagger UI itself runs only in the browser; e2e/api-docs.spec.ts covers it.
vi.mock("@/components/api-docs/ApiDocs", () => ({
  ApiDocs: ({ spec }: { spec: string }) => <pre data-testid="spec">{spec}</pre>,
}));

describe("API docs page", () => {
  it("shows the LifeBoard API heading", () => {
    render(<ApiDocsPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "LifeBoard API" }),
    ).toBeInTheDocument();
  });

  it("hands Swagger UI the spec in docs/api/openapi.yaml", () => {
    render(<ApiDocsPage />);
    const spec = readFileSync(
      join(process.cwd(), "docs/api/openapi.yaml"),
      "utf8",
    );
    expect(screen.getByTestId("spec").textContent).toBe(spec);
  });

  // In an unquoted YAML value, " #" starts a comment, so `description:
  // Issue #4.` reads as "Issue" and the docs show only that. Quote the value
  // or use a | block instead.
  it("has no unquoted spec value cut short by a YAML comment", () => {
    const spec = readFileSync(
      join(process.cwd(), "docs/api/openapi.yaml"),
      "utf8",
    );
    const cutShort = spec
      .split("\n")
      .map((line, index) => ({ line, number: index + 1 }))
      .filter(({ line }) => /^\s*[\w-]+: [^|>"'\s].* #/.test(line))
      .map(({ line, number }) => `${number}: ${line.trim()}`);
    expect(cutShort).toEqual([]);
  });
});
