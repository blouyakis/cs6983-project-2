import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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
import type { ListedItem } from "@/lib/db/list-items";
import type { EntryGroup } from "@/components/expenses/EntryForm";
import type { ReactNode } from "react";
import { NoticeLine, NoticeProvider } from "@/components/ui/NoticeProvider";
import { GroupList } from "./GroupList";

const mocks = vi.hoisted(() => ({
  deleteJson: vi.fn(),
  patchJson: vi.fn(),
  postJson: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/http/api-client", () => ({
  deleteJson: mocks.deleteJson,
  patchJson: mocks.patchJson,
  postJson: mocks.postJson,
}));
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
const gone = "8b3e4f60-1111-4222-8333-944455556666";
const groupId = "0b7e8a10-2222-4333-8444-a55566667777";

function item(overrides: Partial<ListedItem>): ListedItem {
  return {
    id: "00000000-0000-4000-8000-000000000000",
    groupId,
    title: "Item",
    quantity: null,
    note: null,
    estimatedCents: null,
    status: "open",
    addedBy: ana,
    completedBy: null,
    completedAt: null,
    expenseId: null,
    createdAt: "2026-11-04T18:00:00+00:00",
    costCents: null,
    expenseLock: null,
    ...overrides,
  };
}

const towels = item({
  id: "11111111-1111-4111-8111-111111111111",
  title: "🧻 Paper towels",
  estimatedCents: 1200,
  addedBy: sam,
});
const soap = item({
  id: "22222222-2222-4222-8222-222222222222",
  title: "Dish soap",
  estimatedCents: 350,
});
const bulbs = item({
  id: "33333333-3333-4333-8333-333333333333",
  title: "Light bulbs",
  addedBy: gone,
});
const groceries = item({
  id: "44444444-4444-4444-8444-444444444444",
  title: "Grocery run",
  estimatedCents: 900,
  status: "done",
  completedBy: sam,
  completedAt: "2026-11-03T12:00:00+00:00",
  expenseId: null,
});

const flat: EntryGroup = {
  id: groupId,
  name: "Flat",
  isPersonal: false,
  members: [
    { userId: ana, name: "Ana", defaultShareWeight: 1 },
    { userId: sam, name: "Sam", defaultShareWeight: 1 },
  ],
};

// The group page puts one notice line above the list (NoticeProvider).
function WithNotices({ children }: { children: ReactNode }) {
  return (
    <NoticeProvider>
      <NoticeLine />
      {children}
    </NoticeProvider>
  );
}

function setup(props: Partial<Parameters<typeof GroupList>[0]> = {}) {
  return render(
    <GroupList
      groupId={groupId}
      isPersonal={false}
      readOnly={false}
      items={[towels, soap, bulbs, groceries]}
      names={{ [ana]: "Ana", [sam]: "Sam" }}
      currentUserId={ana}
      entryGroups={[flat]}
      spentThisMonthCents={null}
      {...props}
    />,
    { wrapper: WithNotices },
  );
}

function rows() {
  return within(screen.getByRole("list")).getAllByRole("listitem");
}

function confirmDialog() {
  return screen.getByRole("dialog", {
    name: /It comes off the list for everyone\.$/,
  });
}

function pressEscape(target: Element) {
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
  });
}

// Delete on the row, then Delete in the ConfirmDialog it opens (#76). The
// row's button gets focus first, as a click would give it in a browser, so
// the dialog has somewhere to send focus back to.
function deleteItem(text: string) {
  const remove = screen.getByRole("button", { name: `Delete ${text}` });
  remove.focus();
  fireEvent.click(remove);
  fireEvent.click(
    within(confirmDialog()).getByRole("button", { name: "Delete" }),
  );
  return remove;
}

function listHeading() {
  return screen.getByRole("heading", { name: "To do & buy" });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GroupList", () => {
  it("totals the estimates of the open items as still to buy", () => {
    setup();

    expect(screen.getByText("Still to buy")).toBeInTheDocument();
    expect(screen.getByText("$15.50")).toBeInTheDocument();
  });

  it("says how many items are open", () => {
    setup();

    expect(screen.getByText("3 open")).toBeInTheDocument();
  });

  it("names who added each item, with the user as You", () => {
    setup();

    expect(rows().map((row) => row.textContent)).toEqual([
      expect.stringContaining("added by Sam"),
      expect.stringContaining("added by You"),
      expect.stringContaining("added by a former member"),
      expect.stringContaining("✔ Sam"),
    ]);
  });

  it("says when the list is empty", () => {
    setup({ items: [] });

    expect(screen.getByText("Nothing on the list yet.")).toBeInTheDocument();
    expect(screen.getByText("$0.00")).toBeInTheDocument();
  });

  it("offers Add to list, which opens the form in Plan it mode", () => {
    setup();

    fireEvent.click(screen.getByRole("button", { name: "Add to list" }));

    expect(screen.getByRole("radio", { name: "Plan it" })).toBeChecked();
  });

  it("offers nothing to change in a read-only group", () => {
    setup({ readOnly: true });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("deletes an open item and refreshes the page", async () => {
    mocks.deleteJson.mockResolvedValue({ ok: true, data: undefined });
    setup();

    deleteItem("Dish soap");

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Deleted Dish soap.",
      ),
    );
    expect(mocks.deleteJson).toHaveBeenCalledWith(
      `/api/groups/${groupId}/list-items/${soap.id}`,
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("says why a delete failed, such as the item being checked off first", async () => {
    mocks.deleteJson.mockResolvedValue({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "This item is done. Uncheck it first to change it.",
      },
    });
    setup();

    deleteItem("Dish soap");

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "This item is done. Uncheck it first to change it.",
      ),
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("edits an item in the edit form, then refreshes the page", async () => {
    mocks.patchJson.mockResolvedValue({ ok: true, data: { item: soap } });
    setup();

    fireEvent.click(screen.getByRole("button", { name: "Edit Dish soap" }));
    expect(screen.getByLabelText("What is it?")).toHaveValue("Dish soap");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(mocks.patchJson).toHaveBeenCalledWith(
      `/api/groups/${groupId}/list-items/${soap.id}`,
      expect.objectContaining({ title: "Dish soap" }),
    );
  });

  it("returns focus to the Edit button when the edit form closes", () => {
    setup();
    const edit = screen.getByRole("button", { name: "Edit Dish soap" });

    edit.focus();
    fireEvent.click(edit);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(edit).toHaveFocus();
  });

  it("shows what was spent this month in the personal space (#23)", () => {
    setup({ isPersonal: true, spentThisMonthCents: 600 });

    expect(screen.getByText("Spent this month")).toBeInTheDocument();
    expect(screen.getByText("$6.00")).toBeInTheDocument();
  });

  it("says when each item was added in the personal space", () => {
    setup({ isPersonal: true, items: [soap] });

    expect(screen.getByText("Planned")).toBeInTheDocument();
    expect(rows()[0]).toHaveTextContent("Added Nov 4");
  });

  it("opens the edit form as the item is, not as it was left after Cancel", () => {
    setup();

    fireEvent.click(screen.getByRole("button", { name: "Edit Dish soap" }));
    fireEvent.change(screen.getByLabelText("What is it?"), {
      target: { value: "Hand soap" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Dish soap" }));

    expect(screen.getByLabelText("What is it?")).toHaveValue("Dish soap");
  });

  it("opens the edit form with the item as the server now has it", () => {
    const view = setup();
    fireEvent.click(screen.getByRole("button", { name: "Edit Dish soap" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // Someone else edited it, and the page was refreshed.
    const edited = { ...soap, title: "Lemon dish soap" };
    view.rerender(
      <GroupList
        groupId={groupId}
        isPersonal={false}
        readOnly={false}
        items={[edited]}
        names={{ [ana]: "Ana", [sam]: "Sam" }}
        currentUserId={ana}
        entryGroups={[flat]}
        spentThisMonthCents={null}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Edit Lemon dish soap" }),
    );

    expect(screen.getByLabelText("What is it?")).toHaveValue("Lemon dish soap");
  });

  it("sends one delete however often Delete is pressed while it is on its way", () => {
    mocks.deleteJson.mockReturnValue(new Promise(() => {}));
    setup();

    const remove = deleteItem("Dish soap");
    const confirm = within(confirmDialog()).getByRole("button", {
      name: "Delete",
    });
    fireEvent.click(confirm);

    expect(mocks.deleteJson).toHaveBeenCalledTimes(1);
    expect(confirm).toBeDisabled();
    expect(remove).toBeDisabled();
  });

  it("asks before deleting, naming the item", () => {
    setup();

    fireEvent.click(screen.getByRole("button", { name: "Delete Dish soap" }));

    expect(
      screen.getByRole("dialog", {
        name: "Delete Dish soap? It comes off the list for everyone.",
      }),
    ).toBeInTheDocument();
    expect(mocks.deleteJson).not.toHaveBeenCalled();
  });

  it("names the item without its emoji when it asks", () => {
    setup();

    fireEvent.click(
      screen.getByRole("button", { name: "Delete Paper towels" }),
    );

    expect(
      screen.getByRole("dialog", {
        name: "Delete Paper towels? It comes off the list for everyone.",
      }),
    ).toBeInTheDocument();
  });

  // Nobody else sees the personal space, so "for everyone" would be wrong.
  it("asks about the user's own list in the personal space", () => {
    setup({ isPersonal: true, items: [soap] });

    fireEvent.click(screen.getByRole("button", { name: "Delete Dish soap" }));

    expect(
      screen.getByRole("dialog", {
        name: "Delete Dish soap? It comes off your list.",
      }),
    ).toBeInTheDocument();
  });

  it("keeps the item when Cancel is chosen, and returns focus to its Delete button", () => {
    setup();
    const remove = screen.getByRole("button", { name: "Delete Dish soap" });

    remove.focus();
    fireEvent.click(remove);
    fireEvent.click(
      within(confirmDialog()).getByRole("button", { name: "Cancel" }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.deleteJson).not.toHaveBeenCalled();
    expect(screen.getByText("Dish soap")).toBeInTheDocument();
    expect(remove).toHaveFocus();
  });

  it("keeps the item when Escape is pressed, and returns focus to its Delete button", () => {
    setup();
    const remove = screen.getByRole("button", { name: "Delete Dish soap" });

    remove.focus();
    fireEvent.click(remove);
    pressEscape(confirmDialog());

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.deleteJson).not.toHaveBeenCalled();
    expect(screen.getByText("Dish soap")).toBeInTheDocument();
    expect(remove).toHaveFocus();
  });

  it("moves focus to the list heading once the item is deleted", async () => {
    mocks.deleteJson.mockResolvedValue({ ok: true, data: undefined });
    setup();

    deleteItem("Dish soap");

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Deleted Dish soap.",
      ),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(listHeading()).toHaveFocus();
  });

  // The DELETE is already sent, so closing the dialog would say the delete was
  // cancelled while the item is deleted anyway.
  it("stays open on Cancel or Escape while the delete is on its way, then says what happened", async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.deleteJson.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    setup();

    deleteItem("Dish soap");
    pressEscape(confirmDialog());
    fireEvent.click(
      within(confirmDialog()).getByRole("button", { name: "Cancel" }),
    );

    expect(confirmDialog()).toBeInTheDocument();
    await act(async () => {
      finish({ ok: true, data: undefined });
    });
    expect(screen.getByRole("status")).toHaveTextContent("Deleted Dish soap.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // A second confirm that lands before React re-renders the button as busy is
  // turned away by deletingRef. It must not close the dialog while the first
  // DELETE is still on its way.
  it("stays open when Delete is confirmed twice before a re-render, then moves focus to the heading", async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.deleteJson.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    setup();
    const remove = screen.getByRole("button", { name: "Delete Dish soap" });
    remove.focus();
    fireEvent.click(remove);
    const confirm = within(confirmDialog()).getByRole("button", {
      name: "Delete",
    });

    await act(async () => {
      confirm.click();
      confirm.click();
    });

    expect(mocks.deleteJson).toHaveBeenCalledTimes(1);
    expect(confirmDialog()).toBeInTheDocument();
    await act(async () => {
      finish({ ok: true, data: undefined });
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(listHeading()).toHaveFocus();
  });

  // While the modal is open the rest of the page is inert, and a screen reader
  // may skip a change to the notice line there. The notice comes once the
  // dialog has closed.
  it("says what happened only after the dialog has closed", async () => {
    mocks.deleteJson.mockResolvedValue({ ok: true, data: undefined });
    setup();
    const remove = screen.getByRole("button", { name: "Delete Dish soap" });
    remove.focus();
    fireEvent.click(remove);
    const dialog = confirmDialog();
    const noticeAtClose: string[] = [];
    const close = HTMLDialogElement.prototype.close;
    const spy = vi
      .spyOn(HTMLDialogElement.prototype, "close")
      .mockImplementation(function (this: HTMLDialogElement) {
        if (this === dialog) {
          noticeAtClose.push(screen.getByRole("status").textContent ?? "");
        }
        close.call(this);
      });

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Deleted Dish soap.",
      ),
    );
    spy.mockRestore();

    expect(noticeAtClose).toEqual([""]);
  });

  it("keeps the last notice when a delete is cancelled, since nothing changed", async () => {
    mocks.patchJson.mockResolvedValue({ ok: true, data: { item: soap } });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Edit Dish soap" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Saved Dish soap."),
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete Light bulbs" }));
    fireEvent.click(
      within(confirmDialog()).getByRole("button", { name: "Cancel" }),
    );

    expect(screen.getByRole("status")).toHaveTextContent("Saved Dish soap.");
  });

  it("says what was added to the list, and where", async () => {
    const milk = item({ title: "🥛 Milk" });
    mocks.postJson.mockResolvedValue({ ok: true, data: { item: milk } });
    setup();

    fireEvent.click(screen.getByRole("button", { name: "Add to list" }));
    fireEvent.change(screen.getByLabelText("What is it?"), {
      target: { value: "🥛 Milk" },
    });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Add to list",
      }),
    );

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Added 🥛 Milk to Flat's list.",
      ),
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("says what was logged after a switch to Already spent", async () => {
    const expense = {
      id: "e1",
      description: "Electricity",
      amountCents: 1234,
    } as Expense;
    mocks.postJson.mockResolvedValue({ ok: true, data: { expense } });
    setup();

    fireEvent.click(screen.getByRole("button", { name: "Add to list" }));
    fireEvent.click(screen.getByRole("radio", { name: "Already spent" }));
    fireEvent.change(screen.getByLabelText("What was it for?"), {
      target: { value: "Electricity" },
    });
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "12.34" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add expense" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Added Electricity ($12.34) to Flat.",
      ),
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("writes a done notice in green and a problem in the owe color", async () => {
    mocks.deleteJson.mockResolvedValueOnce({ ok: true, data: undefined });
    mocks.deleteJson.mockResolvedValueOnce({
      ok: false,
      error: { code: "NOT_FOUND", message: "This item isn't on the list." },
    });
    setup();

    deleteItem("Dish soap");
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Deleted Dish soap.",
      ),
    );
    expect(screen.getByRole("status")).toHaveClass("text-action");

    deleteItem("Light bulbs");
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "This item isn't on the list.",
      ),
    );
    expect(screen.getByRole("status")).toHaveClass("text-owe");
  });

  it("keeps Delete off after the item is deleted, until the refresh removes the row", async () => {
    mocks.deleteJson.mockResolvedValue({ ok: true, data: undefined });
    setup();

    const remove = deleteItem("Dish soap");
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Deleted Dish soap.",
      ),
    );
    fireEvent.click(remove);

    expect(remove).toBeDisabled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.deleteJson).toHaveBeenCalledTimes(1);
  });

  it("turns Delete back on when the delete fails, so it can be tried again", async () => {
    mocks.deleteJson.mockResolvedValue({
      ok: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Something went wrong. Try again.",
      },
    });
    setup();

    const remove = deleteItem("Dish soap");
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Something went wrong. Try again.",
      ),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(remove).toBeEnabled();
    expect(remove).toHaveFocus();
  });

  // Someone else deleted the item (404) or checked it off (409) first, or the
  // user can no longer change the list (403: they left in another tab, or the
  // group was archived). The refresh takes the row's Delete button away, and
  // focus would fall to body.
  it.each([
    ["NOT_FOUND", "Not found."],
    ["CONFLICT", "This item is done. Uncheck it first to change it."],
    ["FORBIDDEN", "This group is archived and read-only."],
  ])(
    "moves focus to the list heading when the delete gets %s, since the refresh takes Delete away",
    async (code, message) => {
      mocks.deleteJson.mockResolvedValue({
        ok: false,
        error: { code, message },
      });
      setup();

      deleteItem("Dish soap");
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(message),
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(listHeading()).toHaveFocus();
    },
  );

  it("says what was saved after an edit", async () => {
    mocks.patchJson.mockResolvedValue({
      ok: true,
      data: { item: { ...soap, title: "🧼 Dish soap" } },
    });
    setup();

    fireEvent.click(screen.getByRole("button", { name: "Edit Dish soap" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Saved Dish soap."),
    );
    expect(screen.getByRole("status")).toHaveClass("text-action");
  });

  it("clears the last notice when the edit form opens", async () => {
    mocks.deleteJson.mockResolvedValue({ ok: true, data: undefined });
    setup();
    deleteItem("Light bulbs");
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Deleted Light bulbs.",
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Dish soap" }));

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("refreshes the list when an edit is refused, since someone changed the item first", async () => {
    mocks.patchJson.mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "This item isn't on the list." },
    });
    setup();

    fireEvent.click(screen.getByRole("button", { name: "Edit Dish soap" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(
      screen.getByText("This item isn't on the list."),
    ).toBeInTheDocument();
  });

  describe("checking off and unchecking (#12)", () => {
    const expenseId = "99999999-9999-4999-8999-999999999999";
    const anaMilk = item({
      id: "55555555-5555-4555-8555-555555555555",
      title: "🥛 Milk",
      estimatedCents: 450,
      status: "done",
      completedBy: ana,
      completedAt: "2026-11-04T19:00:00+00:00",
      expenseId,
      costCents: 500,
    });
    const anaBread = item({
      id: "66666666-6666-4666-8666-666666666666",
      title: "Bread",
      status: "done",
      completedBy: ana,
      completedAt: "2026-11-04T19:00:00+00:00",
    });

    function uncheckDialog() {
      return screen.getByRole("dialog", { name: /^Uncheck / });
    }

    it("opens the check-off form from an open row's checkbox", () => {
      setup();

      fireEvent.click(
        screen.getByRole("checkbox", { name: "Check off Paper towels" }),
      );

      expect(
        screen.getByRole("dialog", { name: "Check off Paper towels" }),
      ).toBeInTheDocument();
    });

    it("checks the item off, says so, and refreshes the list", async () => {
      mocks.postJson.mockResolvedValue({
        ok: true,
        data: { item: { ...towels, status: "done" } },
      });
      setup();

      fireEvent.click(
        screen.getByRole("checkbox", { name: "Check off Paper towels" }),
      );
      fireEvent.change(screen.getByLabelText("Actual cost"), {
        target: { value: "5" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Check off" }));

      expect(
        await screen.findByText("Checked off Paper towels for $5.00."),
      ).toBeInTheDocument();
      expect(mocks.postJson).toHaveBeenCalledWith(
        `/api/groups/${groupId}/list-items/${towels.id}/complete`,
        { amountCents: 500, mode: "even", sharedBy: [ana, sam] },
      );
      expect(mocks.refresh).toHaveBeenCalled();
    });

    it("asks before unchecking an item that has an expense, saying what it deletes", () => {
      setup({ items: [anaMilk] });

      fireEvent.click(screen.getByRole("checkbox", { name: "Uncheck Milk" }));

      expect(uncheckDialog()).toHaveAccessibleName(
        "Uncheck Milk? This deletes its $5.00 expense.",
      );
      expect(
        within(uncheckDialog()).getByRole("button", {
          name: "Uncheck and delete",
        }),
      ).toBeInTheDocument();
      expect(mocks.postJson).not.toHaveBeenCalled();
    });

    it("says an item with no expense just goes back on the list", () => {
      setup({ items: [anaBread] });

      fireEvent.click(screen.getByRole("checkbox", { name: "Uncheck Bread" }));

      expect(uncheckDialog()).toHaveAccessibleName(
        "Uncheck Bread? It goes back on the list.",
      );
      expect(
        within(uncheckDialog()).getByRole("button", { name: "Uncheck" }),
      ).toBeInTheDocument();
    });

    it("unchecks once confirmed, says so, and refreshes the list", async () => {
      mocks.postJson.mockResolvedValue({
        ok: true,
        data: { item: { ...anaMilk, status: "open" } },
      });
      setup({ items: [anaMilk] });

      fireEvent.click(screen.getByRole("checkbox", { name: "Uncheck Milk" }));
      fireEvent.click(
        within(uncheckDialog()).getByRole("button", {
          name: "Uncheck and delete",
        }),
      );

      expect(
        await screen.findByText(
          "Unchecked Milk and deleted its $5.00 expense.",
        ),
      ).toBeInTheDocument();
      expect(mocks.postJson).toHaveBeenCalledWith(
        `/api/groups/${groupId}/list-items/${anaMilk.id}/reopen`,
      );
      expect(mocks.refresh).toHaveBeenCalled();
    });

    it("leaves the item done when the uncheck is cancelled", () => {
      setup({ items: [anaMilk] });

      fireEvent.click(screen.getByRole("checkbox", { name: "Uncheck Milk" }));
      fireEvent.click(
        within(uncheckDialog()).getByRole("button", { name: "Cancel" }),
      );

      expect(mocks.postJson).not.toHaveBeenCalled();
      expect(
        screen.getByRole("checkbox", { name: "Uncheck Milk" }),
      ).toBeChecked();
    });

    it("shows the server's reason when the uncheck is refused", async () => {
      mocks.postJson.mockResolvedValue({
        ok: false,
        error: {
          code: "CONFLICT",
          message: "A settled expense can't be deleted.",
        },
      });
      setup({ items: [anaMilk] });

      fireEvent.click(screen.getByRole("checkbox", { name: "Uncheck Milk" }));
      fireEvent.click(
        within(uncheckDialog()).getByRole("button", {
          name: "Uncheck and delete",
        }),
      );

      expect(
        await screen.findByText("A settled expense can't be deleted."),
      ).toBeInTheDocument();
      expect(mocks.refresh).toHaveBeenCalled();
    });

    it("doesn't let anyone else uncheck an item", () => {
      setup({ items: [groceries] });

      expect(
        screen.getByRole("checkbox", { name: "Grocery run is done" }),
      ).toBeDisabled();
    });

    it("doesn't let the member who checked it off uncheck it once its expense is locked", () => {
      setup({ items: [{ ...anaMilk, expenseLock: "settled" }] });

      expect(
        screen.getByRole("checkbox", { name: "Milk is done" }),
      ).toBeDisabled();
      expect(screen.getByText("Settled")).toBeInTheDocument();
    });

    it("offers no checking off or unchecking in a read-only list", () => {
      setup({ readOnly: true, items: [towels, anaMilk] });

      for (const box of screen.getAllByRole("checkbox")) {
        expect(box).toBeDisabled();
      }
    });

    it("shows what the done items cost as spent", () => {
      setup({ items: [towels, anaMilk] });

      expect(screen.getByText("Spent")).toBeInTheDocument();
      expect(screen.getByText("$0.50 over the estimate")).toBeInTheDocument();
    });
  });
});
