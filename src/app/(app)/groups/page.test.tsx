import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GroupsPage from "./page";

vi.mock("@/components/groups/GroupsList", () => ({
  GroupsList: () => <p>The groups</p>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("groups page", () => {
  it("has the page heading, the New group button and the list", () => {
    render(<GroupsPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Your corners of life" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /New group/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("The groups")).toBeInTheDocument();
  });
});
