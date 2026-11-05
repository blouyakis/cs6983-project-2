import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Expense } from "@/lib/db/expenses";
import { EditExpenseButton } from "./EditExpenseButton";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

// The form has its own tests; here it reports back through its callbacks.
let formProps: {
  open: boolean;
  onSaved: (expense: Expense) => void;
  onDeleted: () => void;
  onClose: () => void;
};
vi.mock("./EditExpenseForm", () => ({
  EditExpenseForm: (props: typeof formProps) => {
    formProps = props;
    return props.open ? <p>The form</p> : null;
  },
}));

const groceries = {
  id: "e",
  groupId: "g",
  description: "Groceries",
  amountCents: 4510,
} as Expense;

beforeEach(() => {
  vi.resetAllMocks();
});

function setup() {
  return render(
    <EditExpenseButton
      expense={groceries}
      groupName="🏠 Flat"
      members={[]}
      currentUserId="ana"
    />,
  );
}

describe("EditExpenseButton", () => {
  it("is a pencil button named for its expense, which opens the form", () => {
    setup();

    const button = screen.getByRole("button", { name: "Edit Groceries" });
    expect(screen.queryByText("The form")).toBeNull();

    fireEvent.click(button);

    expect(screen.getByText("The form")).toBeInTheDocument();
  });

  it("refreshes the page once the expense is saved, and says so", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Edit Groceries" }));

    act(() => formProps.onSaved({ ...groceries, description: "Big shop" }));

    expect(mocks.refresh).toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Saved Big shop.");
  });

  it("refreshes the page once the expense is deleted, and says so", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Edit Groceries" }));

    act(() => formProps.onDeleted());

    expect(mocks.refresh).toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Deleted Groceries ($45.10).",
    );
  });

  it("closes the form without refreshing when it is closed", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Edit Groceries" }));

    act(() => formProps.onClose());

    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(screen.queryByText("The form")).toBeNull();
  });
});
