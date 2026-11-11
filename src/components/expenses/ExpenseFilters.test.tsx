import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExpenseFilters, type ExpenseFilterValues } from "./ExpenseFilters";

const ana = "6f1c2d4e-1111-4222-8333-944455556666";
const sam = "7a2d3e5f-1111-4222-8333-944455556666";
const flatId = "0b7e8a10-2222-4333-8444-a55566667777";
const personalId = "3d4e5f6a-2222-4333-8444-a55566667777";

const none: ExpenseFilterValues = { groupId: "", paidBy: "", from: "", to: "" };

function setup(
  values: Partial<ExpenseFilterValues> = {},
  count: number | null = 3,
  errors: Record<string, string> = {},
) {
  return render(
    <ExpenseFilters
      action="/#expenses"
      groups={[
        { id: personalId, name: "Just me" },
        { id: flatId, name: "🏠 Flat" },
      ]}
      payers={[
        { userId: ana, name: "You" },
        { userId: sam, name: "Sam" },
      ]}
      values={{ ...none, ...values }}
      errors={errors}
      count={count}
    />,
  );
}

function form() {
  return screen.getByRole("form", { name: "Filter expenses" });
}

describe("ExpenseFilters", () => {
  it("has Group, Paid by, From and To, each with a visible label", () => {
    setup();

    expect(screen.getByLabelText("Group")).toHaveAttribute("name", "groupId");
    expect(screen.getByLabelText("Paid by")).toHaveAttribute("name", "paidBy");
    expect(screen.getByLabelText("From")).toHaveAttribute("name", "from");
    expect(screen.getByLabelText("To")).toHaveAttribute("name", "to");
    expect(screen.getByLabelText("From")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("To")).toHaveAttribute("type", "date");
  });

  it("is a GET form, so the filters go in the address and work without a script", () => {
    setup();

    expect(form()).toHaveAttribute("method", "get");
    expect(form()).toHaveAttribute("action", "/#expenses");
    expect(
      within(form()).getByRole("button", { name: "Apply filters" }),
    ).toHaveAttribute("type", "submit");
  });

  it("offers every group and every payer, after an option for all of them", () => {
    setup();

    expect(
      within(screen.getByLabelText("Group"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["All groups", "Just me", "🏠 Flat"]);
    expect(
      within(screen.getByLabelText("Paid by"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Anyone", "You", "Sam"]);
  });

  it("starts with nothing chosen", () => {
    setup();

    expect(screen.getByLabelText("Group")).toHaveValue("");
    expect(screen.getByLabelText("Paid by")).toHaveValue("");
    expect(screen.getByLabelText("From")).toHaveValue("");
    expect(screen.getByLabelText("To")).toHaveValue("");
  });

  it("shows the filters that are applied", () => {
    setup({
      groupId: flatId,
      paidBy: sam,
      from: "2026-10-01",
      to: "2026-10-31",
    });

    expect(screen.getByLabelText("Group")).toHaveValue(flatId);
    expect(screen.getByLabelText("Paid by")).toHaveValue(sam);
    expect(screen.getByLabelText("From")).toHaveValue("2026-10-01");
    expect(screen.getByLabelText("To")).toHaveValue("2026-10-31");
  });

  it.each([
    [0, "No expenses match."],
    [1, "1 expense matches."],
    [12, "12 expenses match."],
  ])("says how many expenses there are with no filter: %i", (count, text) => {
    setup({}, count);

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("says how many expenses match the filters", () => {
    setup({ paidBy: sam }, 2);

    expect(
      screen.getByText("2 expenses match these filters."),
    ).toBeInTheDocument();
  });

  it("offers Clear filters only when a filter is set", () => {
    const { unmount } = setup();
    expect(
      screen.queryByRole("link", { name: "Clear filters" }),
    ).not.toBeInTheDocument();
    unmount();

    setup({ from: "2026-10-01" });

    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/#expenses",
    );
  });

  it("shows a refused filter's message next to its field and says nothing was counted", () => {
    setup({ from: "2026-11-02", to: "2026-11-01" }, null, {
      to: "To can't be before From.",
    });

    const to = screen.getByLabelText("To");
    expect(to).toHaveAttribute("aria-invalid", "true");
    expect(to).toHaveAccessibleDescription("To can't be before From.");
    expect(screen.getByLabelText("From")).not.toHaveAttribute("aria-invalid");
    expect(
      screen.getByText("Fix the highlighted filters to see your expenses."),
    ).toBeInTheDocument();
  });

  it("shows a refused group next to Group, with nothing chosen", () => {
    setup({ groupId: "4e5f6a7b-2222-4333-8444-a55566667777" }, null, {
      groupId: "Choose one of your groups.",
    });

    const group = screen.getByLabelText("Group");
    expect(group).toHaveValue("");
    expect(group).toHaveAccessibleDescription("Choose one of your groups.");
  });

  // The fields are uncontrolled, and Clear filters changes the address
  // without loading a new document, so the form has to start again from the
  // new filters or it would send the old ones with the next Apply.
  it("shows the new filters when the page is rendered again with different ones", () => {
    const props = {
      action: "/#expenses",
      groups: [{ id: flatId, name: "🏠 Flat" }],
      payers: [{ userId: sam, name: "Sam" }],
      errors: {},
      count: 1,
    };
    const { rerender } = render(
      <ExpenseFilters
        {...props}
        values={{ groupId: flatId, paidBy: sam, from: "2026-10-01", to: "" }}
      />,
    );
    expect(screen.getByLabelText("Paid by")).toHaveValue(sam);

    rerender(<ExpenseFilters {...props} values={none} />);

    expect(screen.getByLabelText("Group")).toHaveValue("");
    expect(screen.getByLabelText("Paid by")).toHaveValue("");
    expect(screen.getByLabelText("From")).toHaveValue("");
  });
});
