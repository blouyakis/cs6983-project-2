import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("home page", () => {
  it("shows the LifeBoard heading", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: "LifeBoard" }),
    ).toBeInTheDocument();
  });
});
