import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("writes its label out in owe text on tag by default", () => {
    render(<Badge>Read only</Badge>);
    const badge = screen.getByText("Read only");
    expect(badge).toHaveClass("uppercase", "text-owe", "bg-tag");
  });

  it("uses green for being owed, with the words still saying so", () => {
    render(<Badge tone="owed">is owed $42.00</Badge>);
    const badge = screen.getByText("is owed $42.00");
    expect(badge).toHaveClass("text-action");
    expect(badge).not.toHaveClass("text-owe");
  });
});
