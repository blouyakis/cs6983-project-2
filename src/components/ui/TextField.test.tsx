import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextField } from "./TextField";

describe("TextField", () => {
  it("has a visible label tied to the input", () => {
    render(<TextField label="Email" name="email" type="email" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("name", "email");
    expect(input).toHaveAttribute("type", "email");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("shows a hint under the field", () => {
    render(<TextField label="Password" name="password" hint="At least 8." />);
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription(
      "At least 8.",
    );
  });

  it("announces an error next to the field and marks it invalid", () => {
    render(
      <TextField
        label="Password"
        name="password"
        hint="At least 8."
        error="Password must be at least 8 characters."
      />,
    );
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(
      "At least 8. Password must be at least 8 characters.",
    );
    const error = screen.getByText("Password must be at least 8 characters.");
    expect(error).toHaveAttribute("aria-live", "polite");
  });
});
