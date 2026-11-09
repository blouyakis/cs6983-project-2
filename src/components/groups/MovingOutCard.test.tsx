import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

const groupId = "0b7e8a10-2222-4333-8444-a55566667777";

type CardProps = {
  balanceCents?: number;
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

function leaveButton() {
  return screen.getByRole("button", { name: /Leave group/ });
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

    expect(leaveButton()).toBeDisabled();
    expect(leaveButton()).toHaveAccessibleDescription(
      "You owe $31.00 in this group.",
    );
    expect(
      screen.getByRole("link", { name: /Settle my \$31\.00 first/ }),
    ).toHaveAttribute("href", `/groups/${groupId}/settle-up`);
  });

  it("keeps Leave group disabled while the user is owed, and says so in words", () => {
    card({ balanceCents: 4200 });

    expect(leaveButton()).toBeDisabled();
    expect(leaveButton()).toHaveAccessibleDescription(
      "You are owed $42.00 in this group.",
    );
    expect(
      screen.getByRole("link", { name: /Settle my \$42\.00 first/ }),
    ).toBeInTheDocument();
  });

  it("keeps Leave group disabled at a zero balance while a payment is still waiting", () => {
    card({ hasWaitingPayment: true });

    expect(leaveButton()).toBeDisabled();
    expect(leaveButton()).toHaveAccessibleDescription(
      "A payment to or from you is still waiting to be paid or confirmed.",
    );
  });

  it("offers Leave group at a zero balance, without a settle-up link", () => {
    card();

    expect(leaveButton()).toBeEnabled();
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
    fireEvent.click(screen.getByRole("button", { name: "Leave group" }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/groups"));
    expect(mocks.postJson).toHaveBeenCalledWith(`/api/groups/${groupId}/leave`);
    expect(mocks.refresh).toHaveBeenCalled();
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
    fireEvent.click(screen.getByRole("button", { name: "Leave group" }));

    expect(await screen.findByRole("status")).toHaveTextContent(message);
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalled();
  });
});
