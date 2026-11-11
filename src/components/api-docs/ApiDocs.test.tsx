import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiDocs } from "./ApiDocs";

// The real Swagger UI needs a browser; e2e/api-docs.spec.ts runs it there.
vi.mock("swagger-ui-react", () => ({
  default: ({ spec, plugins }: { spec: string; plugins?: unknown[] }) => (
    <pre data-testid="swagger-ui" data-plugins={plugins?.length ?? 0}>
      {spec}
    </pre>
  ),
}));

describe("ApiDocs", () => {
  it("renders Swagger UI with the spec it is given", async () => {
    render(<ApiDocs spec="openapi: 3.0.3" />);
    expect(await screen.findByTestId("swagger-ui")).toHaveTextContent(
      "openapi: 3.0.3",
    );
  });

  it("adds the plugin that names the request body box", async () => {
    render(<ApiDocs spec="openapi: 3.0.3" />);
    expect(await screen.findByTestId("swagger-ui")).toHaveAttribute(
      "data-plugins",
      "1",
    );
  });
});
