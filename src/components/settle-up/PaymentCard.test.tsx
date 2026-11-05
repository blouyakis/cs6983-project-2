import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Payment } from "@/lib/db/settlements";
import { PaymentCard } from "./PaymentCard";

const anaId = "6f1c2d4e-1111-4222-8333-944455556666";
const samId = "7a2d3e5f-1111-4222-8333-944455556666";
const joId = "1a2b3c4d-3333-4444-8555-b66677778888";
const names = { [anaId]: "Ana", [samId]: "Sam", [joId]: "Jo" };

const suggested: Payment = {
  id: "9c8d7e6f-6666-4777-8888-e99900001111",
  groupId: "g",
  fromUserId: anaId,
  toUserId: samId,
  amountCents: 3100,
  status: "suggested",
  settlementId: "s",
  createdAt: "2026-11-01T10:00:00+00:00",
  paidAt: null,
  confirmedAt: null,
};

function card(
  payment: Payment,
  viewerId: string,
  onAct = vi.fn(),
  busy = false,
) {
  render(
    <PaymentCard
      payment={payment}
      names={names}
      currentUserId={viewerId}
      onAct={onAct}
      busy={busy}
    />,
  );
  return onAct;
}

describe("PaymentCard", () => {
  it("writes who pays whom, with the current user as You, and the amount", () => {
    card(suggested, anaId);

    expect(
      screen.getByRole("heading", { name: "You → Sam" }),
    ).toBeInTheDocument();
    expect(screen.getByText("$31.00")).toBeInTheDocument();
  });

  it("names the viewer as You on the receiving side too", () => {
    card(suggested, samId);

    expect(
      screen.getByRole("heading", { name: "Ana → You" }),
    ).toBeInTheDocument();
  });

  it("offers the sender I paid this while it is suggested, and nobody else", async () => {
    const onAct = card(suggested, anaId);

    fireEvent.click(screen.getByRole("button", { name: /I paid this/ }));

    expect(onAct).toHaveBeenCalledWith(suggested, "paid");
    expect(
      screen.getByText("Suggested · pay however you like"),
    ).toBeInTheDocument();
  });

  it("shows the recipient the suggested status with nothing to do yet", () => {
    card(suggested, samId);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(
      screen.getByText("Suggested · waiting for Ana to pay"),
    ).toBeInTheDocument();
  });

  it("offers the recipient a confirm once it is marked paid", async () => {
    const paid: Payment = {
      ...suggested,
      status: "paid",
      paidAt: "2026-11-02T10:00:00+00:00",
    };
    const onAct = card(paid, samId);

    expect(
      screen.getByText("Marked paid · waiting for you to confirm"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /I got it/ }));

    expect(onAct).toHaveBeenCalledWith(paid, "confirmed");
  });

  it("tells the sender a paid payment is waiting on the recipient", () => {
    card(
      { ...suggested, status: "paid", paidAt: "2026-11-02T10:00:00+00:00" },
      anaId,
    );

    expect(
      screen.getByText("Marked paid · waiting for Sam to confirm"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows a confirmed payment as done, for everyone", () => {
    card(
      {
        ...suggested,
        status: "confirmed",
        paidAt: "2026-11-02T10:00:00+00:00",
        confirmedAt: "2026-11-03T10:00:00+00:00",
      },
      joId,
    );

    expect(
      screen.getByRole("heading", { name: "Ana → Sam" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Confirmed/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("marks a card the viewer has to act on", () => {
    card(suggested, anaId);

    expect(screen.getByRole("listitem")).toHaveAttribute(
      "data-needs-you",
      "true",
    );
  });

  it("disables the button while the action is being sent", () => {
    card(suggested, anaId, vi.fn(), true);

    expect(screen.getByRole("button", { name: /I paid this/ })).toBeDisabled();
  });

  it("keeps the words but drops the button for a read-only viewer", () => {
    render(
      <PaymentCard
        payment={suggested}
        names={names}
        currentUserId={anaId}
        onAct={vi.fn()}
        canAct={false}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "You → Sam" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveAttribute(
      "data-needs-you",
      "false",
    );
  });

  it("names a former member it can't find", () => {
    card({ ...suggested, toUserId: "gone" }, anaId);

    expect(
      screen.getByRole("heading", { name: "You → a former member" }),
    ).toBeInTheDocument();
  });
});
