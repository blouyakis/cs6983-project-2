import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ListsPage from "./page";

vi.mock("@/components/lists/ListsBoard", () => ({
  ListsBoard: () => <p>The lists board</p>,
}));

describe("ListsPage", () => {
  it("has the page heading and renders the lists board in a Suspense boundary", () => {
    render(<ListsPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Lists" }),
    ).toBeInTheDocument();
    expect(screen.getByText("The lists board")).toBeInTheDocument();
  });
});
