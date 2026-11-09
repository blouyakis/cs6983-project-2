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
import { NoticeProvider } from "@/components/ui/NoticeProvider";
import type { Member } from "@/lib/db/group-members";
import { DefaultSplitProvider } from "./DefaultSplitProvider";
import { InviteForm } from "./InviteForm";

const mocks = vi.hoisted(() => ({
  postJson: vi.fn(),
  patchJson: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/http/api-client", () => ({
  postJson: mocks.postJson,
  patchJson: mocks.patchJson,
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
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

const groupId = "0b7e8a10-2222-4333-8444-a55566667777";

const ana: Member = { userId: "a", name: "Ana", defaultShareWeight: 60 };
const ben: Member = { userId: "b", name: "Ben", defaultShareWeight: 40 };

function submit(email: string) {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: email },
  });
  fireEvent.click(screen.getByRole("button", { name: "Invite" }));
}

// Inside the group page's DefaultSplitProvider, as GroupDetail renders it.
function inviteInto(members: Member[], email: string) {
  render(
    <NoticeProvider>
      <DefaultSplitProvider groupId={groupId} members={members}>
        <InviteForm groupId={groupId} />
      </DefaultSplitProvider>
    </NoticeProvider>,
  );
  submit(email);
}

function invite(email: string) {
  render(<InviteForm groupId={groupId} />);
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: email },
  });
  fireEvent.click(screen.getByRole("button", { name: "Invite" }));
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("InviteForm", () => {
  it("invites by email, then says who joined and refreshes the page", async () => {
    mocks.postJson.mockResolvedValue({
      ok: true,
      data: {
        member: { userId: "s", name: "Sam", defaultShareWeight: 1 },
        splitReset: false,
      },
    });

    invite("sam@example.com");

    expect(
      await screen.findByText("Sam joined the group."),
    ).toBeInTheDocument();
    expect(mocks.postJson).toHaveBeenCalledWith(
      `/api/groups/${groupId}/invitations`,
      { email: "sam@example.com" },
    );
    expect(mocks.refresh).toHaveBeenCalled();
    expect(screen.getByLabelText("Email")).toHaveValue("");
  });

  it("says when joining reset a 60/40 split to even, with a way to set a new one (#63)", async () => {
    mocks.postJson.mockResolvedValue({
      ok: true,
      data: {
        member: { userId: "s", name: "Sam", defaultShareWeight: 1 },
        splitReset: true,
      },
    });

    inviteInto([ana, ben], "sam@example.com");

    expect(
      await screen.findByText(
        "Sam joined the group. The default split is now even, because 60/40 was set for 2 people.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Set a new split" }));
    expect(screen.getByRole("dialog", { name: "Default split" })).toBeVisible();
  });

  it("says only who joined when the split was not reset", async () => {
    mocks.postJson.mockResolvedValue({
      ok: true,
      data: {
        member: { userId: "s", name: "Sam", defaultShareWeight: 50 },
        splitReset: false,
      },
    });

    inviteInto(
      [
        { ...ana, defaultShareWeight: 50 },
        { ...ben, defaultShareWeight: 50 },
      ],
      "sam@example.com",
    );

    expect(
      await screen.findByText("Sam joined the group."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Set a new split" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["NOT_FOUND", "No LifeBoard account uses that email."],
    ["CONFLICT", "They are already in this group."],
    ["CONFLICT", "A group can have at most 12 members."],
  ])("shows a %s error next to the email field", async (code, message) => {
    mocks.postJson.mockResolvedValue({ ok: false, error: { code, message } });

    invite("sam@example.com");

    await waitFor(() =>
      expect(screen.getByLabelText("Email")).toHaveAccessibleDescription(
        message,
      ),
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("shows a field error from a 400", async () => {
    mocks.postJson.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Check the highlighted fields.",
        fields: { email: "Enter a valid email address." },
      },
    });

    invite("sam");

    await waitFor(() =>
      expect(screen.getByLabelText("Email")).toHaveAccessibleDescription(
        "Enter a valid email address.",
      ),
    );
  });
});
