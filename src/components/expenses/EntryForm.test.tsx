import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
import { splitMessages } from "@/lib/domain/splits";
import { EntryForm, type EntryGroup } from "./EntryForm";

const mocks = vi.hoisted(() => ({ postJson: vi.fn() }));
vi.mock("@/lib/http/api-client", () => ({ postJson: mocks.postJson }));

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

function member(userId: string, name: string, weight = 1): Member {
  return { userId, name, defaultShareWeight: weight };
}

const flat: EntryGroup = {
  id: "0b7e8a10-2222-4333-8444-a55566667777",
  name: "🏠 Flat",
  isPersonal: false,
  members: [member(ana, "Ana"), member(sam, "Sam"), member(jo, "Jo")],
};
const trip: EntryGroup = {
  id: "1c8f9b21-2222-4333-8444-a55566667777",
  name: "✈️ Trip",
  isPersonal: false,
  members: [member(ana, "Ana", 3), member(sam, "Sam", 2)],
};
const personal: EntryGroup = {
  id: "2d90ac32-2222-4333-8444-a55566667777",
  name: "Just me",
  isPersonal: true,
  members: [member(ana, "Ana")],
};

const saved = { id: "e1", description: "Electricity" } as Expense;

function setup(props: Partial<Parameters<typeof EntryForm>[0]> = {}) {
  const onClose = vi.fn();
  const onAdded = vi.fn();
  const view = render(
    <EntryForm
      groups={[flat, trip, personal]}
      currentUserId={ana}
      open
      onClose={onClose}
      onAdded={onAdded}
      {...props}
    />,
  );
  return { onClose, onAdded, ...view };
}

function fill(description: string, amount: string) {
  fireEvent.change(screen.getByLabelText("What was it for?"), {
    target: { value: description },
  });
  fireEvent.change(screen.getByLabelText("Amount"), {
    target: { value: amount },
  });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Add expense" }));
}

beforeEach(() => {
  vi.resetAllMocks();
  // Only Date, so waitFor still works. 2026-11-04 in the local time zone.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 4, 12, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("EntryForm", () => {
  it("is the New entry form in Already spent mode", () => {
    setup();

    expect(
      screen.getByRole("heading", { name: "New entry" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Already spent/)).toBeInTheDocument();
  });

  it("offers only the groups it is given, each as a chip", () => {
    setup({ groups: [flat, personal] });

    const chips = screen
      .getAllByRole("radio")
      .filter((radio) => radio.getAttribute("name") === "group");
    expect(chips.map((chip) => chip.getAttribute("value"))).toEqual([
      flat.id,
      personal.id,
    ]);
  });

  it("starts on the group it was opened for, or else the first", () => {
    const { unmount } = setup({ defaultGroupId: trip.id });
    expect(screen.getByRole("radio", { name: "✈️ Trip" })).toBeChecked();
    unmount();

    setup();
    expect(screen.getByRole("radio", { name: "🏠 Flat" })).toBeChecked();
  });

  it("defaults the day to today", () => {
    setup();

    expect(screen.getByLabelText("Day")).toHaveValue("2026-11-04");
  });

  it("adds an even split and reports the new expense", async () => {
    mocks.postJson.mockResolvedValue({ ok: true, data: { expense: saved } });
    const { onAdded, onClose } = setup();

    fill("Electricity", "12.34");
    submit();

    await waitFor(() => expect(onAdded).toHaveBeenCalledWith(saved, flat));
    expect(mocks.postJson).toHaveBeenCalledWith(
      `/api/groups/${flat.id}/expenses`,
      {
        description: "Electricity",
        amountCents: 1234,
        spentOn: "2026-11-04",
        mode: "even",
        sharedBy: [ana, sam, jo],
      },
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("sends the custom amounts for a group with a default ratio", async () => {
    mocks.postJson.mockResolvedValue({ ok: true, data: { expense: saved } });
    setup({ defaultGroupId: trip.id });

    fill("Tickets", "10");
    submit();

    await waitFor(() => expect(mocks.postJson).toHaveBeenCalled());
    expect(mocks.postJson).toHaveBeenCalledWith(
      `/api/groups/${trip.id}/expenses`,
      {
        description: "Tickets",
        amountCents: 1000,
        spentOn: "2026-11-04",
        mode: "custom",
        sharedBy: [ana, sam],
        amountsCents: { [ana]: 600, [sam]: 400 },
      },
    );
  });

  it("has no split in the personal space, where the user is the only sharer", async () => {
    mocks.postJson.mockResolvedValue({ ok: true, data: { expense: saved } });
    setup({ defaultGroupId: personal.id });

    expect(
      screen.queryByRole("heading", { name: "How is it split?" }),
    ).not.toBeInTheDocument();
    fill("Coffee", "3.50");
    submit();

    await waitFor(() => expect(mocks.postJson).toHaveBeenCalled());
    expect(mocks.postJson).toHaveBeenCalledWith(
      `/api/groups/${personal.id}/expenses`,
      {
        description: "Coffee",
        amountCents: 350,
        spentOn: "2026-11-04",
        mode: "even",
        sharedBy: [ana],
      },
    );
  });

  it("splits among the members of whichever group is chosen", () => {
    setup();
    expect(screen.getByRole("checkbox", { name: "Jo" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "✈️ Trip" }));

    expect(
      screen.queryByRole("checkbox", { name: "Jo" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Sam" })).toBeInTheDocument();
  });

  it("splits among the members it is given now, not the ones it was first given", async () => {
    mocks.postJson.mockResolvedValue({ ok: true, data: { expense: saved } });
    const alone: EntryGroup = { ...flat, members: [member(ana, "Ana")] };
    const view = setup({ groups: [alone] });

    // The page refreshed after Ana invited Sam, so the form gets new members.
    view.rerender(
      <EntryForm
        groups={[
          { ...flat, members: [member(ana, "Ana"), member(sam, "Sam")] },
        ]}
        currentUserId={ana}
        open
        onClose={view.onClose}
        onAdded={view.onAdded}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Sam" })).toBeChecked();
    fill("Electricity", "10.01");
    submit();
    await waitFor(() => expect(mocks.postJson).toHaveBeenCalled());
    expect(mocks.postJson.mock.calls[0][1]).toMatchObject({
      mode: "even",
      sharedBy: [ana, sam],
    });
  });

  it("lets the user change the split after the members changed", () => {
    const alone: EntryGroup = { ...flat, members: [member(ana, "Ana")] };
    const view = setup({ groups: [alone] });
    view.rerender(
      <EntryForm
        groups={[
          { ...flat, members: [member(ana, "Ana"), member(sam, "Sam")] },
        ]}
        currentUserId={ana}
        open
        onClose={view.onClose}
        onAdded={view.onAdded}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Custom amounts" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Sam" }));

    expect(screen.getByRole("radio", { name: "Custom amounts" })).toBeChecked();
    expect(screen.getByLabelText("Your share")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Sam" })).not.toBeChecked();
  });

  it("keeps who the user chose while the members stay the same", () => {
    setup();
    fireEvent.click(screen.getByRole("checkbox", { name: "Sam" }));

    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "5" },
    });

    expect(screen.getByRole("checkbox", { name: "Sam" })).not.toBeChecked();
  });

  it("asks for what it was for, next to the field, without sending", () => {
    setup();

    fill("   ", "5");
    submit();

    expect(
      screen.getByLabelText("What was it for?"),
    ).toHaveAccessibleDescription("Enter what this cost was for.");
    expect(mocks.postJson).not.toHaveBeenCalled();
  });

  it.each(["", "abc", "1.234", "-5"])(
    "rejects an amount typed as %j with the server's message",
    (amount) => {
      setup();

      fill("Electricity", amount);
      submit();

      expect(screen.getByLabelText("Amount")).toHaveAccessibleDescription(
        expect.stringContaining(splitMessages.amount),
      );
      expect(mocks.postJson).not.toHaveBeenCalled();
    },
  );

  it("rejects a day in the future", () => {
    setup();

    fill("Electricity", "5");
    fireEvent.change(screen.getByLabelText("Day"), {
      target: { value: "2999-01-01" },
    });
    submit();

    expect(screen.getByLabelText("Day")).toHaveAccessibleDescription(
      "The day can't be in the future.",
    );
    expect(mocks.postJson).not.toHaveBeenCalled();
  });

  it("blocks custom amounts that don't add up until they do", () => {
    setup({ defaultGroupId: trip.id });

    fill("Tickets", "10");
    fireEvent.change(screen.getByLabelText("Sam's share"), {
      target: { value: "3" },
    });
    submit();

    expect(
      screen.getAllByText("The shares add up to $9.00, not $10.00.").length,
    ).toBeGreaterThan(0);
    expect(mocks.postJson).not.toHaveBeenCalled();
  });

  it("shows the server's field errors next to the fields", async () => {
    mocks.postJson.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Check the highlighted fields.",
        fields: {
          description: "The description must be at most 100 characters.",
          sharedBy: "Everyone sharing this cost must be in the group.",
        },
      },
    });
    setup();

    fill("Electricity", "12.34");
    submit();

    await waitFor(() =>
      expect(
        screen.getByLabelText("What was it for?"),
      ).toHaveAccessibleDescription(
        "The description must be at most 100 characters.",
      ),
    );
    expect(
      screen.getByText("Everyone sharing this cost must be in the group."),
    ).toBeInTheDocument();
  });

  it("shows any other server error above the buttons and stays open", async () => {
    mocks.postJson.mockResolvedValue({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "You left this group, so you can only read its history.",
      },
    });
    const { onClose, onAdded } = setup();

    fill("Electricity", "12.34");
    submit();

    expect(
      await screen.findByText(
        "You left this group, so you can only read its history.",
      ),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onAdded).not.toHaveBeenCalled();
  });

  it("closes from Cancel without sending", () => {
    const { onClose } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(mocks.postJson).not.toHaveBeenCalled();
  });

  it("opens blank again after it was closed with something typed", () => {
    const view = setup();
    fill("Electricity", "12.34");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    view.rerender(
      <EntryForm
        groups={[flat, trip, personal]}
        currentUserId={ana}
        open={false}
        onClose={view.onClose}
        onAdded={view.onAdded}
      />,
    );
    view.rerender(
      <EntryForm
        groups={[flat, trip, personal]}
        currentUserId={ana}
        open
        onClose={view.onClose}
        onAdded={view.onAdded}
      />,
    );

    expect(screen.getByLabelText("What was it for?")).toHaveValue("");
    expect(screen.getByLabelText("Amount")).toHaveValue("");
  });
});
