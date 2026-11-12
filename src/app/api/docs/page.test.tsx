import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
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

  // A 400 example names the fields that were wrong, so each one must be
  // something the route takes: a path or query parameter, or a property of
  // its request body. Login once showed the shared groupId example (#16).
  it("names only a route's own fields in its 400 example", () => {
    const spec = parse(
      readFileSync(join(process.cwd(), "docs/api/openapi.yaml"), "utf8"),
    ) as Spec;
    const resolve = <T,>(node: T | Ref): T =>
      isRef(node)
        ? (node.$ref
            .slice(2)
            .split("/")
            .reduce<unknown>(
              (at, key) => (at as Record<string, unknown>)[key],
              spec,
            ) as T)
        : node;
    const propertiesOf = (schema: Schema | Ref | undefined): string[] => {
      if (!schema) {
        return [];
      }
      const resolved = resolve(schema);
      return [
        ...Object.keys(resolved.properties ?? {}),
        ...(resolved.allOf ?? []).flatMap(propertiesOf),
      ];
    };

    const strays: string[] = [];
    for (const [path, operations] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(operations)) {
        const badRequest = operation.responses["400"];
        if (!badRequest) {
          continue;
        }
        const example = resolve(badRequest).content?.["application/json"]
          ?.example as { error?: { fields?: Record<string, string> } };
        const accepted = new Set([
          ...(operation.parameters ?? []).map((p) => resolve(p).name),
          ...propertiesOf(
            operation.requestBody?.content["application/json"]?.schema,
          ),
        ]);
        for (const field of Object.keys(example?.error?.fields ?? {})) {
          if (!accepted.has(field)) {
            strays.push(`${method.toUpperCase()} ${path}: ${field}`);
          }
        }
      }
    }
    expect(strays).toEqual([]);
  });
});

type Ref = { $ref: string };
type Schema = {
  properties?: Record<string, unknown>;
  allOf?: (Schema | Ref)[];
};
type Media = { schema?: Schema | Ref; example?: unknown };
type Response = { content?: Record<string, Media> };
type Operation = {
  parameters?: ({ name: string } | Ref)[];
  requestBody?: { content: Record<string, Media> };
  responses: Record<string, Response | Ref>;
};
type Spec = { paths: Record<string, Record<string, Operation>> };

function isRef(node: unknown): node is Ref {
  return typeof node === "object" && node !== null && "$ref" in node;
}
