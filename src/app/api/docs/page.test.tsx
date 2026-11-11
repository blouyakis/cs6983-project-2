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
});
