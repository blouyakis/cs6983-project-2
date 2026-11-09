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
import type { Member } from "@/lib/db/group-members";
import { DefaultSplitForm } from "./DefaultSplitForm";

const mocks = vi.hoisted(() => ({ patchJson: vi.fn() }));
vi.mock("@/lib/http/api-client", () => ({ patchJson: mocks.patchJson }));

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

const groupId = "0b7e8a10-2222-4333-8444-a55566667777";
const ana = "6f1c2d4e-1111-4222-8333-944455556666";
const ben = "7a2d3e5f-1111-4222-8333-944455556666";

function members(anaWeight: number, benWeight: number): Member[] {
  return [
    { userId: ana, name: "Ana", defaultShareWeight: anaWeight },
    { userId: ben, name: "Ben", defaultShareWeight: benWeight },
  ];
}

const onSaved = vi.fn();
const onClose = vi.fn();

function open(groupMembers: Member[]) {
  render(
    <DefaultSplitForm
      groupId={groupId}
      members={groupMembers}
      open
      onClose={onClose}
      onSaved={onSaved}
    />,
  );
}

function save() {
  fireEvent.click(screen.getByRole("button", { name: "Save split" }));
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("DefaultSplitForm", () => {
  it("opens on Evenly for weights 1 and 1, with no percent fields", () => {
    open(members(1, 1));

    expect(screen.getByRole("dialog", { name: "Default split" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Evenly" })).toBeChecked();
    expect(screen.queryByLabelText("Ana (%)")).not.toBeInTheDocument();
  });

  it("opens on Custom percentages with 60 and 40 for weights 3 and 2", () => {
    open(members(3, 2));

    expect(
      screen.getByRole("radio", { name: "Custom percentages" }),
    ).toBeChecked();
    expect(screen.getByLabelText("Ana (%)")).toHaveValue("60");
    expect(screen.getByLabelText("Ben (%)")).toHaveValue("40");
  });

  it("saves Evenly as weight 1 for every current member, in one PATCH", async () => {
    mocks.patchJson.mockResolvedValue({ ok: true, data: {} });
    open(members(3, 2));

    fireEvent.click(screen.getByRole("radio", { name: "Evenly" }));
    save();

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.patchJson).toHaveBeenCalledWith(`/api/groups/${groupId}`, {
      memberWeights: [
        { userId: ana, weight: 1 },
        { userId: ben, weight: 1 },
      ],
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("saves 60 and 40 as weights 60 and 40", async () => {
    mocks.patchJson.mockResolvedValue({ ok: true, data: {} });
    open(members(1, 1));

    fireEvent.click(screen.getByRole("radio", { name: "Custom percentages" }));
    type("Ana (%)", "60");
    type("Ben (%)", "40");
    save();

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.patchJson).toHaveBeenCalledWith(`/api/groups/${groupId}`, {
      memberWeights: [
        { userId: ana, weight: 60 },
        { userId: ben, weight: 40 },
      ],
    });
  });

  it("shows the total as the percents change", () => {
    open(members(3, 2));

    type("Ben (%)", "30");

    expect(screen.getByText("Total: 90%")).toBeInTheDocument();
  });

  it("blocks percents that don't add up to 100, with a message next to the fields", async () => {
    open(members(3, 2));

    type("Ben (%)", "30");
    save();

    expect(
      await screen.findByText(
        "The percentages add up to 90%. Make them add up to 100%.",
      ),
    ).toBeInTheDocument();
    expect(mocks.patchJson).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("blocks a 0 next to that member's field", async () => {
    open(members(3, 2));

    type("Ana (%)", "0");
    save();

    await waitFor(() =>
      expect(screen.getByLabelText("Ana (%)")).toHaveAccessibleDescription(
        "Enter a whole percent from 1 to 100.",
      ),
    );
    expect(mocks.patchJson).not.toHaveBeenCalled();
  });

  it("shows a 400 from the server next to the fields and stays open", async () => {
    mocks.patchJson.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "The weights must list every current member exactly once.",
      },
    });
    open(members(3, 2));

    save();

    expect(
      await screen.findByText(
        "The weights must list every current member exactly once.",
      ),
    ).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
