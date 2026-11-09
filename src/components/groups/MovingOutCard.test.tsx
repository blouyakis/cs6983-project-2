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
import { NoticeLine, NoticeProvider } from "@/components/ui/NoticeProvider";
import { MovingOutCard } from "./MovingOutCard";

const mocks = vi.hoisted(() => ({
  postJson: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/http/api-client", () => ({ postJson: mocks.postJson }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

// jsdom has no showModal, so ConfirmDialog's dialog is opened by hand, as in
// the other components' tests.
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

type CardProps = {
  balanceCents?: number | null;
  hasWaitingPayment?: boolean;
  isLastMember?: boolean;
};

function card({
  balanceCents = 0,
  hasWaitingPayment = false,
  isLastMember = false,
}: CardProps = {}) {
  render(
    <NoticeProvider>
      <NoticeLine />
      <MovingOutCard
        groupId={groupId}
        groupName="Flat"
        balanceCents={balanceCents}
        hasWaitingPayment={hasWaitingPayment}
        isLastMember={isLastMember}
      />
    </NoticeProvider>,
  );
}

// The card's button, which opens the question.
function leaveButton() {
  return screen.getByRole("button", { name: /Leave group/ });
}

// Leave group is off but still focusable, with aria-disabled rather than
// disabled, so a keyboard or screen reader user reaches it and hears why
// (AGENTS.md Section 8). Pressing it asks nothing.
function expectLeaveBlocked() {
  const button = leaveButton();
  expect(button).toHaveAttribute("aria-disabled", "true");
  expect(button).toBeEnabled();
  button.focus();
  expect(button).toHaveFocus();
  fireEvent.click(button);
  expect(screen.queryByRole("dialog")).toBeNull();
}

// The question's own Leave group button, which leaves.
function confirmLeave() {
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Leave group",
    }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

// DESIGN.md "MovingOutCard", user flow 8 (#22).
describe("MovingOutCard", () => {
  it("says how leaving works", () => {
    card();

    expect(
      screen.getByRole("heading", { name: /Moving out\?/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "You can leave once your balance is $0.00, through a group settle-up or a direct payment.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps Leave group disabled while the user owes, says so in words and links to settling up", () => {
    card({ balanceCents: -3100 });

    expectLeaveBlocked();
    expect(leaveButton()).toHaveAccessibleDescription(
      "You owe $31.00 in this group.",
    );
    expect(
      screen.getByRole("link", { name: /Settle my \$31\.00 first/ }),
    ).toHaveAttribute("href", `/groups/${groupId}/settle-up`);
  });

  it("keeps Leave group disabled while the user is owed, and says so in words", () => {
    card({ balanceCents: 4200 });

    expectLeaveBlocked();
    expect(leaveButton()).toHaveAccessibleDescription(
      "You are owed $42.00 in this group.",
    );
    expect(
      screen.getByRole("link", { name: /Settle my \$42\.00 first/ }),
    ).toBeInTheDocument();
  });

  it("keeps Leave group disabled at a zero balance while a payment is still waiting", () => {
    card({ hasWaitingPayment: true });

    expectLeaveBlocked();
    expect(leaveButton()).toHaveAccessibleDescription(
      "A payment to or from you is still waiting to be paid or confirmed.",
    );
  });

  it("keeps Leave group off when the user's balance is unknown, without a settle-up link (#22 review)", () => {
    card({ balanceCents: null });

    expectLeaveBlocked();
    expect(leaveButton()).toHaveAccessibleDescription(
      "Your balance in this group couldn't be worked out, so you can't leave right now.",
    );
    expect(screen.queryByRole("link", { name: /Settle my/ })).toBeNull();
  });

  it("offers Leave group at a zero balance, without a settle-up link", () => {
    card();

    expect(leaveButton()).toBeEnabled();
    expect(leaveButton()).not.toHaveAttribute("aria-disabled");
    expect(screen.queryByRole("link", { name: /Settle my/ })).toBeNull();
  });

  it("asks before leaving, and Cancel leaves nothing", () => {
    card();

    fireEvent.click(leaveButton());

    expect(
      screen.getByText(
        "Leave Flat? You'll keep read-only access to its history up to today.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocks.postJson).not.toHaveBeenCalled();
  });

  it("says the group will be archived when the user is its last member", () => {
    card({ isLastMember: true });

    fireEvent.click(leaveButton());

    expect(
      screen.getByText(
        "Leave Flat? You'll keep read-only access to its history up to today. As its last member, you'll archive the group.",
      ),
    ).toBeInTheDocument();
  });

  it("leaves, then goes to the Groups page and refreshes it", async () => {
    mocks.postJson.mockResolvedValue({ ok: true, data: undefined });
    card();

    fireEvent.click(leaveButton());
    confirmLeave();

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/groups"));
    expect(mocks.postJson).toHaveBeenCalledWith(`/api/groups/${groupId}/leave`);
    expect(mocks.refresh).toHaveBeenCalled();
  });

  // The page only changes once the navigation lands, so until then the
  // question stays busy instead of offering Leave group again, which would
  // get a 403 for a leave that worked (#22 review).
  it("stays busy after leaving until the page changes, so the user can't leave twice", async () => {
    mocks.postJson.mockResolvedValue({ ok: true, data: undefined });
    card();

    fireEvent.click(leaveButton());
    confirmLeave();
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/groups"));

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("button", { name: "Leave group" }),
    ).toBeDisabled();
    confirmLeave();
    expect(mocks.postJson).toHaveBeenCalledTimes(1);
  });

  it("shows the server's reason and stays when leaving is refused", async () => {
    const message =
      "Settle up first: you can leave once your balance in this group is $0.00.";
    mocks.postJson.mockResolvedValue({
      ok: false,
      error: { code: "CONFLICT", message },
    });
    card();

    fireEvent.click(leaveButton());
    confirmLeave();

    expect(await screen.findByRole("status")).toHaveTextContent(message);
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalled();
  });
});
