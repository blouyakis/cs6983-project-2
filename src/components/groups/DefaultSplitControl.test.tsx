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
import { NoticeLine, NoticeProvider } from "@/components/ui/NoticeProvider";
import type { Member } from "@/lib/db/group-members";
import { DefaultSplitControl } from "./DefaultSplitControl";
import { DefaultSplitProvider } from "./DefaultSplitProvider";

const mocks = vi.hoisted(() => ({ patchJson: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/http/api-client", () => ({ patchJson: mocks.patchJson }));
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

const groupId = "0b7e8a10-2222-4333-8444-a55566667777";

function members(...weights: number[]): Member[] {
  return weights.map((weight, index) => ({
    userId: `user-${index}`,
    name: ["Ana", "Ben", "Cal"][index],
    defaultShareWeight: weight,
  }));
}

function show(groupMembers: Member[]) {
  render(
    <NoticeProvider>
      <DefaultSplitProvider groupId={groupId} members={groupMembers}>
        <DefaultSplitControl />
        <NoticeLine />
      </DefaultSplitProvider>
    </NoticeProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("DefaultSplitControl", () => {
  it("says the group splits evenly", () => {
    show(members(1, 1));

    expect(screen.getByText("Default split: even split")).toBeInTheDocument();
  });

  it("says the group's ratio in words", () => {
    show(members(3, 2));

    expect(
      screen.getByText("Default split: 60/40 default"),
    ).toBeInTheDocument();
  });

  it("opens the Default split form", () => {
    show(members(3, 2));

    fireEvent.click(
      screen.getByRole("button", { name: "Change the default split" }),
    );

    expect(screen.getByRole("dialog", { name: "Default split" })).toBeVisible();
  });

  // In the page's one notice, so the page never has a second status region
  // (DESIGN.md "Notices").
  it("refreshes the page after saving, so it shows the new ratio, and says so in the page's notice", async () => {
    mocks.patchJson.mockResolvedValue({ ok: true, data: {} });
    show(members(1, 1));

    fireEvent.click(
      screen.getByRole("button", { name: "Change the default split" }),
    );
    fireEvent.click(screen.getByRole("radio", { name: "Custom percentages" }));
    fireEvent.change(screen.getByLabelText("Ana (%)"), {
      target: { value: "60" },
    });
    fireEvent.change(screen.getByLabelText("Ben (%)"), {
      target: { value: "40" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save split" }));

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Saved the default split: 60/40 default.",
    );
  });
});
