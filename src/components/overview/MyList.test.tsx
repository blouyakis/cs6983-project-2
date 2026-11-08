import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
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
import type { ListItem } from "@/lib/db/list-items";
import { MyList } from "./MyList";

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
const personalId = "0b7e8a10-2222-4333-8444-a55566667777";

function item(id: string, title: string, estimatedCents: number | null) {
  return {
    id,
    groupId: personalId,
    title,
    quantity: null,
    note: null,
    estimatedCents,
    status: "open",
    addedBy: ana,
    completedBy: null,
    completedAt: null,
    expenseId: null,
    createdAt: "2026-11-02T10:00:00+00:00",
  } satisfies ListItem;
}

function WithNotices({ children }: { children: ReactNode }) {
  return (
    <NoticeProvider>
      <NoticeLine />
      {children}
    </NoticeProvider>
  );
}

function setup(items: ListItem[], openEstimateCents: number) {
  return render(
    <MyList
      groupId={personalId}
      currentUserId={ana}
      items={items}
      openEstimateCents={openEstimateCents}
    />,
    { wrapper: WithNotices },
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("MyList", () => {
  it("lists the personal space's open items with their estimated total", () => {
    setup(
      [
        item("1", "💇 Haircut", 3500),
        item("2", "📶 Internet bill", 6000),
        item("3", "📮 Stamps", 400),
      ],
      9900,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: /My list/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/open$/)).toHaveTextContent("est. $99.00 open");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("Haircut")).toBeInTheDocument();
  });

  it("offers no edit or delete, which live on the personal list", () => {
    setup([item("1", "💇 Haircut", 3500)], 3500);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("says when nothing is planned", () => {
    setup([], 0);

    expect(screen.getByText("Nothing planned yet.")).toBeInTheDocument();
  });

  it("checks an item off as a personal expense, as on the personal list (#12)", async () => {
    const haircut = item(
      "1d5a6182-3333-4444-8555-b66677778888",
      "💇 Haircut",
      3500,
    );
    mocks.postJson.mockResolvedValue({
      ok: true,
      data: { item: { ...haircut, status: "done" } },
    });
    setup([haircut], 3500);

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Check off Haircut" }),
    );
    expect(screen.queryByText("How is it split?")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Actual cost"), {
      target: { value: "32" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check off" }));

    await waitFor(() =>
      expect(mocks.postJson).toHaveBeenCalledWith(
        `/api/groups/${personalId}/list-items/${haircut.id}/complete`,
        { amountCents: 3200, mode: "even", sharedBy: [ana] },
      ),
    );
    expect(
      await screen.findByText("Checked off Haircut for $32.00."),
    ).toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalled();
  });
});
