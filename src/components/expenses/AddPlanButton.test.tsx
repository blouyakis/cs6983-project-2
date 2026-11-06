import { fireEvent, render, screen } from "@testing-library/react";
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
import type { ReactNode } from "react";
import { NoticeLine, NoticeProvider } from "@/components/ui/NoticeProvider";
import { AddPlanButton } from "./AddPlanButton";
import type { EntryGroup } from "./EntryForm";

const mocks = vi.hoisted(() => ({ postJson: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/http/api-client", () => ({ postJson: mocks.postJson }));
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
const personal: EntryGroup = {
  id: "0a1b2c3d-1111-4222-8333-944455550001",
  name: "Personal space",
  isPersonal: true,
  members: [{ userId: ana, name: "Ana", defaultShareWeight: 1 }],
};
const dorm: EntryGroup = {
  id: "0b7e8a10-2222-4333-8444-a55566667777",
  name: "🏠 Dorm 4B",
  isPersonal: false,
  members: [
    { userId: ana, name: "Ana", defaultShareWeight: 1 },
    { userId: sam, name: "Sam", defaultShareWeight: 1 },
  ],
};

function WithNotices({ children }: { children: ReactNode }) {
  return (
    <NoticeProvider>
      <NoticeLine />
      {children}
    </NoticeProvider>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("AddPlanButton", () => {
  it("opens the New entry form on Plan it, for the group it was given", () => {
    render(
      <AddPlanButton
        groups={[personal, dorm]}
        currentUserId={ana}
        defaultGroupId={dorm.id}
        label="Add plan here"
        accessibleName="Add plan here, 🏠 Dorm 4B"
      />,
      { wrapper: WithNotices },
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Add plan here, 🏠 Dorm 4B" }),
    );

    expect(
      screen.getByRole("heading", { name: "New entry" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Plan it" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "🏠 Dorm 4B" })).toBeChecked();
  });

  it("is named by its label when no other name is given", () => {
    render(
      <AddPlanButton
        groups={[personal, dorm]}
        currentUserId={ana}
        label="Add a plan or cost"
        primary
      />,
      { wrapper: WithNotices },
    );

    expect(
      screen.getByRole("button", { name: /Add a plan or cost/ }),
    ).toBeVisible();
  });

  it("says what was planned and refreshes the page", async () => {
    const saved = { id: "i1", title: "Paper towels" } as ListItem;
    mocks.postJson.mockResolvedValue({ ok: true, data: { item: saved } });
    render(
      <AddPlanButton
        groups={[dorm]}
        currentUserId={ana}
        defaultGroupId={dorm.id}
        label="Add plan here"
      />,
      { wrapper: WithNotices },
    );
    fireEvent.click(screen.getByRole("button", { name: /Add plan here/ }));

    fireEvent.change(screen.getByLabelText("What is it?"), {
      target: { value: "Paper towels" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add to list" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Added Paper towels to 🏠 Dorm 4B's list.",
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });
});
