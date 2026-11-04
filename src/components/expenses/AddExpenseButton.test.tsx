import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Expense } from "@/lib/db/expenses";
import { AddExpenseButton } from "./AddExpenseButton";
import type { EntryGroup } from "./EntryForm";

const mocks = vi.hoisted(() => ({ postJson: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/http/api-client", () => ({ postJson: mocks.postJson }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

// jsdom has no showModal() or close(); see FormSheet.test.tsx.
const realShowModal = HTMLDialogElement.prototype.showModal;
const realClose = HTMLDialogElement.prototype.close;
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});
afterAll(() => {
  HTMLDialogElement.prototype.showModal = realShowModal;
  HTMLDialogElement.prototype.close = realClose;
});

const ana = "6f1c2d4e-1111-4222-8333-944455556666";
const sam = "7a2d3e5f-1111-4222-8333-944455556666";
const flat: EntryGroup = {
  id: "0b7e8a10-2222-4333-8444-a55566667777",
  name: "🏠 Flat",
  isPersonal: false,
  members: [
    { userId: ana, name: "Ana", defaultShareWeight: 1 },
    { userId: sam, name: "Sam", defaultShareWeight: 1 },
  ],
};
const saved = {
  id: "e1",
  description: "Electricity",
  amountCents: 1234,
} as Expense;

function setup() {
  render(
    <AddExpenseButton
      groups={[flat]}
      currentUserId={ana}
      defaultGroupId={flat.id}
    />,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("AddExpenseButton", () => {
  it("has the form closed until the button is pressed", () => {
    setup();

    expect(screen.getByRole("button", { name: /Log a cost/ })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "New entry" }),
    ).not.toBeInTheDocument();
  });

  it("opens the New entry form for the group it was given", () => {
    setup();

    fireEvent.click(screen.getByRole("button", { name: /Log a cost/ }));

    expect(
      screen.getByRole("heading", { name: "New entry" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "🏠 Flat" })).toBeChecked();
  });

  it("closes the form, says what was added and refreshes the page", async () => {
    mocks.postJson.mockResolvedValue({ ok: true, data: { expense: saved } });
    setup();
    fireEvent.click(screen.getByRole("button", { name: /Log a cost/ }));

    fireEvent.change(screen.getByLabelText("What was it for?"), {
      target: { value: "Electricity" },
    });
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "12.34" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add expense" }));

    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent("Added Electricity ($12.34) to 🏠 Flat.");
    expect(mocks.refresh).toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "New entry" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("clears the last notice when the form is opened again", async () => {
    mocks.postJson.mockResolvedValue({ ok: true, data: { expense: saved } });
    setup();
    fireEvent.click(screen.getByRole("button", { name: /Log a cost/ }));
    fireEvent.change(screen.getByLabelText("What was it for?"), {
      target: { value: "Electricity" },
    });
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "12.34" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add expense" }));
    await screen.findByRole("status");

    fireEvent.click(screen.getByRole("button", { name: /Log a cost/ }));

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("does not refresh when the form is cancelled", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /Log a cost/ }));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
