import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChipPicker } from "./ChipPicker";

const options = [
  { value: "ana", label: "You" },
  { value: "sam", label: "Sam" },
  { value: "jo", label: "Jo" },
];

describe("ChipPicker, choosing one", () => {
  function setup(selected: string[] = ["ana"]) {
    const onChange = vi.fn();
    render(
      <ChipPicker
        label="Group"
        name="group"
        options={options}
        selected={selected}
        onChange={onChange}
      />,
    );
    return onChange;
  }

  it("is a group with a visible label and one radio per chip", () => {
    setup();

    expect(screen.getByRole("group", { name: "Group" })).toBeInTheDocument();
    expect(screen.getByText("Group")).toBeVisible();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("checks the selected chip and fills it with ink", () => {
    setup(["sam"]);

    expect(screen.getByRole("radio", { name: "Sam" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "You" })).not.toBeChecked();
    expect(screen.getByText("Sam")).toHaveClass("bg-ink", "text-surface");
    expect(screen.getByText("You")).not.toHaveClass("bg-ink");
  });

  it("selects only the chip that was clicked", () => {
    const onChange = setup(["ana"]);

    fireEvent.click(screen.getByRole("radio", { name: "Jo" }));

    expect(onChange).toHaveBeenCalledWith(["jo"]);
  });

  it("shows no check mark, since a radio already says which one is chosen", () => {
    setup(["ana"]);

    expect(screen.queryByText("✓")).not.toBeInTheDocument();
  });
});

describe("ChipPicker, choosing several", () => {
  function setup(selected: string[], locked: string[] = []) {
    const onChange = vi.fn();
    render(
      <ChipPicker
        label="Shared by"
        name="sharedBy"
        options={options}
        selected={selected}
        locked={locked}
        onChange={onChange}
        multiple
      />,
    );
    return onChange;
  }

  it("has one checkbox per chip, checked for each selected one", () => {
    setup(["ana", "jo"]);

    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(screen.getByRole("checkbox", { name: "You" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Sam" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Jo" })).toBeChecked();
  });

  it("puts a check mark, hidden from screen readers, on each selected chip", () => {
    setup(["ana", "jo"]);

    const marks = screen.getAllByText("✓");
    expect(marks).toHaveLength(2);
    marks.forEach((mark) =>
      expect(mark).toHaveAttribute("aria-hidden", "true"),
    );
  });

  it("adds a chip to the selection, keeping the order of the options", () => {
    const onChange = setup(["ana", "jo"]);

    fireEvent.click(screen.getByRole("checkbox", { name: "Sam" }));

    expect(onChange).toHaveBeenCalledWith(["ana", "sam", "jo"]);
  });

  it("removes a chip from the selection", () => {
    const onChange = setup(["ana", "sam", "jo"]);

    fireEvent.click(screen.getByRole("checkbox", { name: "Sam" }));

    expect(onChange).toHaveBeenCalledWith(["ana", "jo"]);
  });

  it("keeps a locked chip selected and can't clear it", () => {
    const onChange = setup(["sam"], ["ana"]);

    const locked = screen.getByRole("checkbox", { name: "You" });
    expect(locked).toBeChecked();
    expect(locked).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: "Jo" }));

    expect(onChange).toHaveBeenCalledWith(["ana", "sam", "jo"]);
  });

  it("keeps a locked chip when the last other chip is cleared", () => {
    const onChange = setup(["ana", "sam"], ["ana"]);

    fireEvent.click(screen.getByRole("checkbox", { name: "Sam" }));

    expect(onChange).toHaveBeenCalledWith(["ana"]);
  });
});

describe("ChipPicker, with an error", () => {
  it("shows the error next to the chips, announced and tied to every chip", () => {
    render(
      <ChipPicker
        label="Who did you pay?"
        name="toUserId"
        options={options}
        selected={[]}
        onChange={vi.fn()}
        error="Choose who you paid."
      />,
    );

    const message = screen.getByText("Choose who you paid.");
    expect(message).toHaveAttribute("aria-live", "polite");
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toHaveAccessibleDescription("Choose who you paid.");
      expect(radio).toHaveAttribute("aria-invalid", "true");
    }
  });

  it("ties nothing to the chips without an error", () => {
    render(
      <ChipPicker
        label="Group"
        name="group"
        options={options}
        selected={["ana"]}
        onChange={vi.fn()}
      />,
    );

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toHaveAttribute("aria-describedby");
      expect(radio).not.toHaveAttribute("aria-invalid");
    }
  });
});
