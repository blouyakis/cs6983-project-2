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
import { NewGroupButton } from "./NewGroupButton";

const mocks = vi.hoisted(() => ({ postJson: vi.fn(), push: vi.fn() }));
vi.mock("@/lib/http/api-client", () => ({ postJson: mocks.postJson }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
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

function createGroup(name: string) {
  render(<NewGroupButton />);
  fireEvent.click(screen.getByRole("button", { name: /New group/ }));
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "Create group" }));
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("NewGroupButton", () => {
  it("opens the new group form in a dialog", () => {
    render(<NewGroupButton />);
    fireEvent.click(screen.getByRole("button", { name: /New group/ }));

    expect(
      screen.getByRole("dialog", { name: "New group" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveFocus();
  });

  it("creates the group and goes to its page", async () => {
    mocks.postJson.mockResolvedValue({
      ok: true,
      data: { group: { id: "g1", name: "🏠 Flat" } },
    });

    createGroup("🏠 Flat");

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/groups/g1"));
    expect(mocks.postJson).toHaveBeenCalledWith("/api/groups", {
      name: "🏠 Flat",
    });
  });

  // Next keeps the Groups page mounted after navigating, so a modal left open
  // would make the new group's page inert.
  it("closes the form once the group is created", async () => {
    mocks.postJson.mockResolvedValue({
      ok: true,
      data: { group: { id: "g1", name: "🏠 Flat" } },
    });

    createGroup("🏠 Flat");

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("shows a name error next to the field", async () => {
    mocks.postJson.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Check the highlighted fields.",
        fields: { name: "Enter a group name." },
      },
    });

    createGroup(" ");

    await waitFor(() =>
      expect(screen.getByLabelText("Name")).toHaveAccessibleDescription(
        /Enter a group name\./,
      ),
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("shows any other error above the buttons", async () => {
    mocks.postJson.mockResolvedValue({
      ok: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Something went wrong. Try again.",
      },
    });

    createGroup("Flat");

    expect(
      await screen.findByText("Something went wrong. Try again."),
    ).toBeInTheDocument();
  });
});
