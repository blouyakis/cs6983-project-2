import {
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
import type { ListItem } from "@/lib/db/list-items";
import type { EntryGroup } from "@/components/expenses/EntryForm";
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

function item(overrides: Partial<ListItem>): ListItem {
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
    createdAt: "2026-11-04T18:00:00+00:00",
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
      {...props}
    />,
  );
}

function rows() {
  return within(screen.getByRole("list")).getAllByRole("listitem");
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

    fireEvent.click(screen.getByRole("button", { name: "Delete Dish soap" }));

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(mocks.deleteJson).toHaveBeenCalledWith(
      `/api/groups/${groupId}/list-items/${soap.id}`,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Deleted Dish soap.");
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

    fireEvent.click(screen.getByRole("button", { name: "Delete Dish soap" }));

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

  it("says when each item was added in the personal space", () => {
    setup({ isPersonal: true, items: [soap] });

    expect(screen.getByText("Planned")).toBeInTheDocument();
    expect(rows()[0]).toHaveTextContent("Added Nov 4");
  });
});
