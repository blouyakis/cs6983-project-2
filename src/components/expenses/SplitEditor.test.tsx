import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { Member } from "@/lib/db/group-members";
import { SplitEditor } from "./SplitEditor";
import { initialSplitState } from "./split-state";

const ana = "6f1c2d4e-1111-4222-8333-944455556666";
const sam = "7a2d3e5f-1111-4222-8333-944455556666";
const jo = "8b3e4f60-1111-4222-8333-944455556666";

const even: Member[] = [
  { userId: ana, name: "Ana", defaultShareWeight: 1 },
  { userId: sam, name: "Sam", defaultShareWeight: 1 },
  { userId: jo, name: "Jo", defaultShareWeight: 1 },
];
const sixtyForty: Member[] = [
  { userId: ana, name: "Ana", defaultShareWeight: 3 },
  { userId: sam, name: "Sam", defaultShareWeight: 2 },
];

type HarnessProps = {
  members: Member[];
  amountCents: number | null;
  error?: string;
};

function Harness({ members, amountCents, error }: HarnessProps) {
  const [state, setState] = useState(() => initialSplitState(members));
  return (
    <SplitEditor
      members={members}
      payerId={ana}
      amountCents={amountCents}
      state={state}
      onChange={setState}
      error={error}
    />
  );
}

function preview() {
  return within(screen.getByRole("list", { name: "Preview" }));
}

describe("SplitEditor", () => {
  it("is titled How is it split? and opens on Evenly with everyone sharing", () => {
    render(<Harness members={even} amountCents={1001} />);

    expect(
      screen.getByRole("heading", { name: "How is it split?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Evenly" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Sam" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Jo" })).toBeChecked();
  });

  it("always includes the payer, whose chip can't be cleared", () => {
    render(<Harness members={even} amountCents={1001} />);

    const you = screen.getByRole("checkbox", { name: "You" });
    expect(you).toBeChecked();
    expect(you).toBeDisabled();
  });

  it("previews each share, marks the payer and shows the leftover cents", () => {
    render(<Harness members={even} amountCents={1001} />);

    const rows = preview().getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "You (paid, +2¢ leftover)$3.35",
      "Sam$3.33",
      "Jo$3.33",
    ]);
  });

  it("leaves out the leftover when the amount divides evenly", () => {
    render(<Harness members={even} amountCents={900} />);

    expect(preview().getByText("You (paid)")).toBeInTheDocument();
  });

  it("splits only among the people still chosen", () => {
    render(<Harness members={even} amountCents={1001} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Sam" }));

    expect(
      preview()
        .getAllByRole("listitem")
        .map((row) => row.textContent),
    ).toEqual(["You (paid, +1¢ leftover)$5.01", "Jo$5.00"]);
  });

  it("asks for an amount before it can preview anything", () => {
    render(<Harness members={even} amountCents={null} />);

    expect(
      screen.getByText("Enter an amount to see how it is split."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Preview" }),
    ).not.toBeInTheDocument();
  });

  it("shows a field for each sharer, filled in, once Custom amounts is chosen", () => {
    render(<Harness members={even} amountCents={1001} />);

    fireEvent.click(screen.getByRole("radio", { name: "Custom amounts" }));

    expect(screen.getByLabelText("Your share")).toHaveValue("3.35");
    expect(screen.getByLabelText("Sam's share")).toHaveValue("3.33");
    expect(screen.getByLabelText("Jo's share")).toHaveValue("3.33");
  });

  it("shows no amount fields while Evenly is chosen", () => {
    render(<Harness members={even} amountCents={1001} />);

    expect(screen.queryByLabelText("Sam's share")).not.toBeInTheDocument();
  });

  it("opens a 60/40 group on Custom amounts filled in from its weights", () => {
    render(<Harness members={sixtyForty} amountCents={1000} />);

    expect(screen.getByRole("radio", { name: "Custom amounts" })).toBeChecked();
    expect(screen.getByLabelText("Your share")).toHaveValue("6.00");
    expect(screen.getByLabelText("Sam's share")).toHaveValue("4.00");
  });

  it("fills the amounts in again when the amount changes and none was edited", () => {
    const { rerender } = render(
      <Harness members={sixtyForty} amountCents={1000} />,
    );

    rerender(<Harness members={sixtyForty} amountCents={2000} />);

    expect(screen.getByLabelText("Your share")).toHaveValue("12.00");
    expect(screen.getByLabelText("Sam's share")).toHaveValue("8.00");
  });

  it("leaves the amounts alone once the user has edited one", () => {
    const { rerender } = render(
      <Harness members={sixtyForty} amountCents={1000} />,
    );
    fireEvent.change(screen.getByLabelText("Sam's share"), {
      target: { value: "5.00" },
    });

    rerender(<Harness members={sixtyForty} amountCents={2000} />);

    expect(screen.getByLabelText("Your share")).toHaveValue("6.00");
    expect(screen.getByLabelText("Sam's share")).toHaveValue("5.00");
  });

  it("says when custom amounts don't add up, in words next to the fields", () => {
    render(<Harness members={sixtyForty} amountCents={1000} />);

    fireEvent.change(screen.getByLabelText("Sam's share"), {
      target: { value: "3" },
    });

    const message = screen.getByText("The shares add up to $9.00, not $10.00.");
    expect(message).toBeInTheDocument();
    expect(message.closest("[aria-live]")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("says nothing when custom amounts add up", () => {
    render(<Harness members={sixtyForty} amountCents={1000} />);

    expect(screen.queryByText(/add up to/)).not.toBeInTheDocument();
  });

  it("shows an error from the server under the editor", () => {
    render(
      <Harness
        members={even}
        amountCents={1001}
        error="Everyone sharing this cost must be in the group."
      />,
    );

    expect(
      screen.getByText("Everyone sharing this cost must be in the group."),
    ).toBeInTheDocument();
  });
});
