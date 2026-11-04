import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InviteForm } from "./InviteForm";

const mocks = vi.hoisted(() => ({ postJson: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/http/api-client", () => ({ postJson: mocks.postJson }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

const groupId = "0b7e8a10-2222-4333-8444-a55566667777";

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
      data: { member: { userId: "s", name: "Sam", defaultShareWeight: 1 } },
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
