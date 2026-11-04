import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Toggle } from "./Toggle";

const options = [
  { value: "even", label: "Evenly" },
  { value: "custom", label: "Custom amounts" },
] as const;

function setup(value: "even" | "custom" = "even") {
  const onChange = vi.fn();
  render(
    <Toggle
      label="How is it split?"
      name="mode"
      options={options}
      value={value}
      onChange={onChange}
    />,
  );
  return onChange;
}

describe("Toggle", () => {
  it("is a group named by its label, with one radio per option", () => {
    setup();

    const group = screen.getByRole("radiogroup", { name: "How is it split?" });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByRole("radio", { name: "Evenly" })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "Custom amounts" }),
    ).toBeInTheDocument();
  });

  it("checks the selected option and no other", () => {
    setup("custom");

    expect(screen.getByRole("radio", { name: "Custom amounts" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Evenly" })).not.toBeChecked();
  });

  it("fills the selected option with ink, and not the other", () => {
    setup("even");

    expect(screen.getByText("Evenly")).toHaveClass("bg-ink", "text-surface");
    expect(screen.getByText("Custom amounts")).not.toHaveClass("bg-ink");
  });

  it("tells the parent which option was chosen", () => {
    const onChange = setup("even");

    fireEvent.click(screen.getByRole("radio", { name: "Custom amounts" }));

    expect(onChange).toHaveBeenCalledWith("custom");
  });

  it("does not report a click on the option that is already selected", () => {
    const onChange = setup("even");

    fireEvent.click(screen.getByRole("radio", { name: "Evenly" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("shares one name between its radios, so the arrow keys move between them", () => {
    setup();

    const names = screen
      .getAllByRole("radio")
      .map((radio) => radio.getAttribute("name"));
    expect(new Set(names)).toEqual(new Set(["mode"]));
  });
});
