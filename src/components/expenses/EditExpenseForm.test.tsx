import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Expense } from "@/lib/db/expenses";
import type { Member } from "@/lib/db/group-members";
import { EditExpenseForm } from "./EditExpenseForm";

const mocks = vi.hoisted(() => ({ patchJson: vi.fn(), deleteJson: vi.fn() }));
vi.mock("@/lib/http/api-client", () => ({
  patchJson: mocks.patchJson,
  deleteJson: mocks.deleteJson,
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
const jo = "8b3e4f60-1111-4222-8333-944455556666";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const expenseId = "1d5a6182-3333-4444-8555-b66677778888";

function member(userId: string, name: string): Member {
  return { userId, name, defaultShareWeight: 1 };
}
const members = [member(ana, "Ana"), member(sam, "Sam"), member(jo, "Jo")];

// $45.10 paid by Ana, shared by Ana and Sam; Ana has the leftover cent.
const groceries: Expense = {
  id: expenseId,
  groupId,
  description: "Groceries",
  amountCents: 4510,
  payerId: ana,
  spentOn: "2026-10-12",
  settled: false,
  createdAt: "2026-10-12T18:00:00+00:00",
  editedAt: null,
  shares: [
    { userId: ana, shareCents: 2255 },
    { userId: sam, shareCents: 2255 },
  ],
};

function setup(props: Partial<Parameters<typeof EditExpenseForm>[0]> = {}) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const onDeleted = vi.fn();
  const view = render(
    <EditExpenseForm
      expense={groceries}
      groupName="🏠 Flat"
      members={members}
      currentUserId={ana}
      open
      onClose={onClose}
      onSaved={onSaved}
      onDeleted={onDeleted}
      {...props}
    />,
  );
  return { onClose, onSaved, onDeleted, ...view };
}

function save() {
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
}

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("EditExpenseForm", () => {
  it("is the Edit expense form, filled in with the expense", () => {
    setup();

    expect(
      screen.getByRole("dialog", { name: "Edit expense" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("What was it for?")).toHaveValue("Groceries");
    expect(screen.getByLabelText("Amount")).toHaveValue("45.10");
    expect(screen.getByLabelText("Day")).toHaveValue("2026-10-12");
  });

  it("says which group it is in and that the user can edit it because they paid", () => {
    setup();

    expect(screen.getByText(/🏠 Flat/)).toBeInTheDocument();
    expect(screen.getByText(/You paid/)).toBeInTheDocument();
    expect(screen.getByText(/can't be changed/)).toBeInTheDocument();
  });

  it("opens the split on Custom amounts with the saved shares, so opening never changes it", () => {
    setup();

    expect(screen.getByRole("radio", { name: "Custom amounts" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "You" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Sam" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Jo" })).not.toBeChecked();
    expect(screen.getByLabelText("Your share")).toHaveValue("22.55");
    expect(screen.getByLabelText("Sam's share")).toHaveValue("22.55");
  });

  it("saves the changes with the split and reports the edited expense", async () => {
    const edited = { ...groceries, description: "Big shop", editedAt: "x" };
    mocks.patchJson.mockResolvedValue({ ok: true, data: { expense: edited } });
    const { onSaved, onClose } = setup();

    fireEvent.change(screen.getByLabelText("What was it for?"), {
      target: { value: "Big shop" },
    });
    save();

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(edited));
    expect(mocks.patchJson).toHaveBeenCalledWith(
      `/api/groups/${groupId}/expenses/${expenseId}`,
      {
        description: "Big shop",
        amountCents: 4510,
        spentOn: "2026-10-12",
        mode: "custom",
        sharedBy: [ana, sam],
        amountsCents: { [ana]: 2255, [sam]: 2255 },
      },
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("lets the user switch to an even split among whoever is ticked", async () => {
    mocks.patchJson.mockResolvedValue({
      ok: true,
      data: { expense: groceries },
    });
    setup();

    fireEvent.click(screen.getByRole("checkbox", { name: "Jo" }));
    fireEvent.click(screen.getByRole("radio", { name: "Evenly" }));
    save();

    await waitFor(() => expect(mocks.patchJson).toHaveBeenCalled());
    expect(mocks.patchJson.mock.calls[0][1]).toMatchObject({
      mode: "even",
      sharedBy: [ana, sam, jo],
    });
  });

  it("blocks custom amounts that don't add up, without sending", () => {
    setup();

    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "50" },
    });
    save();

    expect(mocks.patchJson).not.toHaveBeenCalled();
    expect(screen.getByText(/add up/)).toBeInTheDocument();
  });

  it("shows a server error, such as a settled expense, above the buttons", async () => {
    mocks.patchJson.mockResolvedValue({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "This expense has been settled, so it can't be changed.",
      },
    });
    const { onSaved } = setup();

    save();

    expect(
      await screen.findByText(
        "This expense has been settled, so it can't be changed.",
      ),
    ).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("asks before deleting, and Cancel leaves the expense unchanged", () => {
    setup();

    fireEvent.click(screen.getByRole("button", { name: "Delete…" }));
    const confirm = screen.getByRole("dialog", {
      name: "Delete Groceries? Its $45.10 comes off everyone's balance.",
    });
    expect(confirm).toBeInTheDocument();

    fireEvent.click(within(confirm).getByRole("button", { name: "Cancel" }));

    expect(mocks.deleteJson).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Edit expense" }),
    ).toBeInTheDocument();
  });

  it("deletes once confirmed and reports it", async () => {
    mocks.deleteJson.mockResolvedValue({ ok: true, data: undefined });
    const { onDeleted, onClose } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Delete…" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete expense" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(mocks.deleteJson).toHaveBeenCalledWith(
      `/api/groups/${groupId}/expenses/${expenseId}`,
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("shows why a delete failed and keeps the form open", async () => {
    mocks.deleteJson.mockResolvedValue({
      ok: false,
      error: { code: "CONFLICT", message: "Settled." },
    });
    const { onDeleted } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Delete…" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete expense" }));

    expect(await screen.findByText("Settled.")).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Edit expense" }),
    ).toBeInTheDocument();
  });

  it("closes from Cancel without sending", () => {
    const { onClose } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(mocks.patchJson).not.toHaveBeenCalled();
  });
});
