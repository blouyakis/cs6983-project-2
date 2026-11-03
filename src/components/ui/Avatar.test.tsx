import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "./Avatar";

describe("Avatar", () => {
  it("shows the first character of the name and is named for it", () => {
    render(<Avatar name="Sam Lee" index={0} />);
    const avatar = screen.getByRole("img", { name: "Sam Lee" });
    expect(avatar).toHaveTextContent("S");
  });

  it("shows the whole emoji when the name starts with one", () => {
    render(<Avatar name="👨‍👩‍👧 Family" index={0} />);
    expect(screen.getByRole("img")).toHaveTextContent("👨‍👩‍👧");
  });

  it("is hidden from screen readers when the name is written next to it", () => {
    const { container } = render(<Avatar name="Sam" index={0} decorative />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });

  it.each([
    [0, "bg-avatar-1"],
    [1, "bg-avatar-2"],
    [2, "bg-avatar-3"],
    [3, "bg-avatar-1"],
  ])("at position %i uses %s", (index, fill) => {
    render(<Avatar name="Sam" index={index} />);
    expect(screen.getByRole("img")).toHaveClass(fill);
  });
});
