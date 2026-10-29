import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("home page", () => {
  it("shows the LifeBoard heading", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: "LifeBoard" }),
    ).toBeInTheDocument();
  });
});
