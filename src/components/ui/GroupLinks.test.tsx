import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GroupLinks } from "./GroupLinks";

const mocks = vi.hoisted(() => ({ usePathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: mocks.usePathname }));

const groups = [
  { id: "a", name: "🏠 Dorm 4B", isPersonal: false },
  { id: "b", name: "Saturday picnic", isPersonal: false },
  { id: "p", name: "Personal space", isPersonal: true },
];

const fetchMock = vi.fn();

beforeEach(() => {
  mocks.usePathname.mockReturnValue("/");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GroupLinks", () => {
  it("lists the shared groups first, then the personal space, each linking to its page", () => {
    render(<GroupLinks groups={groups} />);

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "🏠 Dorm 4B",
      "Saturday picnic",
      "Personal space",
    ]);
    expect(links[0]).toHaveAttribute("href", "/groups/a");
    expect(links[2]).toHaveAttribute("href", "/groups/p");
  });

  it("names the section for screen readers", () => {
    render(<GroupLinks groups={groups} />);

    expect(
      screen.getByRole("list", { name: "Your groups" }),
    ).toBeInTheDocument();
  });

  it("marks the open group with aria-current", () => {
    mocks.usePathname.mockReturnValue("/groups/b");

    render(<GroupLinks groups={groups} />);

    expect(
      screen.getByRole("link", { name: "Saturday picnic" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: "🏠 Dorm 4B" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("renders nothing for a user with no groups yet", () => {
    const { container } = render(<GroupLinks groups={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("writes each shared group's balance in words, and none for the personal space", () => {
    render(
      <GroupLinks
        groups={[
          {
            id: "a",
            name: "🏠 Dorm 4B",
            isPersonal: false,
            balanceCents: -3100,
          },
          {
            id: "b",
            name: "Saturday picnic",
            isPersonal: false,
            balanceCents: 1850,
          },
          { id: "c", name: "Date nights", isPersonal: false, balanceCents: 0 },
          { id: "p", name: "Personal space", isPersonal: true },
        ]}
      />,
    );

    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(
      [
        "🏠 Dorm 4BYou owe $31.00",
        "Saturday picnicYou are owed $18.50",
        "Date nightsYou are all settled up",
        "Personal space",
      ],
    );
  });

  it("keeps the open group's balance off the owe color, which is too dark on ink", () => {
    mocks.usePathname.mockReturnValue("/groups/a");

    render(
      <GroupLinks
        groups={[
          {
            id: "a",
            name: "🏠 Dorm 4B",
            isPersonal: false,
            balanceCents: -3100,
          },
        ]}
      />,
    );

    const amount = screen.getByText("$31.00");
    expect(amount.closest("[data-on-ink]")).not.toBeNull();
  });
});

// The (app) layout isn't rendered again on client navigation, so the groups
// and balances it rendered would stay as they were when another member
// changes them (#89). After each navigation the sidebar asks the server again.
describe("GroupLinks after a client navigation", () => {
  const first = [
    { id: "a", name: "🏠 Dorm 4B", isPersonal: false, balanceCents: -3100 },
    { id: "p", name: "Personal space", isPersonal: true },
  ];

  function answer(groups: unknown) {
    return new Response(JSON.stringify({ groups }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  function deferred() {
    let resolve: (response: Response) => void = () => {};
    const promise = new Promise<Response>((done) => {
      resolve = done;
    });
    return { promise, resolve };
  }

  function linkTexts() {
    return screen.getAllByRole("link").map((link) => link.textContent);
  }

  it("doesn't ask again on the first render, which already has the server's groups", () => {
    render(<GroupLinks groups={first} />);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(linkTexts()).toEqual(["🏠 Dorm 4BYou owe $31.00", "Personal space"]);
  });

  it("shows the current groups and balances from the server after the path changes", async () => {
    fetchMock.mockResolvedValue(
      answer([
        { id: "a", name: "🏠 Dorm 4B", isPersonal: false, balanceCents: -4500 },
        {
          id: "c",
          name: "🏖️ Cape weekend",
          isPersonal: false,
          balanceCents: 0,
        },
        { id: "p", name: "Personal space", isPersonal: true },
      ]),
    );
    const { rerender } = render(<GroupLinks groups={first} />);

    mocks.usePathname.mockReturnValue("/groups");
    rerender(<GroupLinks groups={first} />);

    await waitFor(() =>
      expect(linkTexts()).toEqual([
        "🏠 Dorm 4BYou owe $45.00",
        "🏖️ Cape weekendYou are all settled up",
        "Personal space",
      ]),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sidebar-groups",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("still lists the groups, without balances, when the request fails", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "INTERNAL_ERROR" } }), {
        status: 500,
      }),
    );
    const { rerender } = render(<GroupLinks groups={first} />);

    mocks.usePathname.mockReturnValue("/groups");
    rerender(<GroupLinks groups={first} />);

    await waitFor(() =>
      expect(linkTexts()).toEqual(["🏠 Dorm 4B", "Personal space"]),
    );
  });

  it("still lists the groups, without balances, when the network fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const { rerender } = render(<GroupLinks groups={first} />);

    mocks.usePathname.mockReturnValue("/groups");
    rerender(<GroupLinks groups={first} />);

    await waitFor(() =>
      expect(linkTexts()).toEqual(["🏠 Dorm 4B", "Personal space"]),
    );
  });

  it("shows the answer to the latest navigation, not a late answer to an earlier one", async () => {
    const toGroups = deferred();
    const toLists = deferred();
    fetchMock
      .mockReturnValueOnce(toGroups.promise)
      .mockReturnValueOnce(toLists.promise);
    const { rerender } = render(<GroupLinks groups={first} />);

    mocks.usePathname.mockReturnValue("/groups");
    rerender(<GroupLinks groups={first} />);
    mocks.usePathname.mockReturnValue("/lists");
    rerender(<GroupLinks groups={first} />);

    // The earlier request is cancelled when the next navigation starts.
    const earlier = fetchMock.mock.calls[0][1] as RequestInit;
    expect(earlier.signal?.aborted).toBe(true);

    await act(async () => {
      toLists.resolve(
        answer([
          { id: "a", name: "🏠 Dorm 4B", isPersonal: false, balanceCents: 900 },
        ]),
      );
    });
    await act(async () => {
      toGroups.resolve(
        answer([
          {
            id: "a",
            name: "🏠 Dorm 4B",
            isPersonal: false,
            balanceCents: -100,
          },
        ]),
      );
    });

    expect(linkTexts()).toEqual(["🏠 Dorm 4BYou are owed $9.00"]);
  });

  it("takes the groups the layout renders again after router.refresh()", async () => {
    fetchMock.mockResolvedValue(
      answer([
        { id: "a", name: "🏠 Dorm 4B", isPersonal: false, balanceCents: -4500 },
      ]),
    );
    const { rerender } = render(<GroupLinks groups={first} />);
    mocks.usePathname.mockReturnValue("/groups");
    rerender(<GroupLinks groups={first} />);
    await waitFor(() =>
      expect(linkTexts()).toEqual(["🏠 Dorm 4BYou owe $45.00"]),
    );

    // An action in the app calls router.refresh(), which renders the layout
    // again with the groups after the change.
    rerender(
      <GroupLinks
        groups={[
          { id: "a", name: "🏠 Dorm 4B", isPersonal: false, balanceCents: 0 },
          { id: "p", name: "Personal space", isPersonal: true },
        ]}
      />,
    );

    expect(linkTexts()).toEqual([
      "🏠 Dorm 4BYou are all settled up",
      "Personal space",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
