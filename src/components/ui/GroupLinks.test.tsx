import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GroupLinks } from "./GroupLinks";

const mocks = vi.hoisted(() => ({ usePathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: mocks.usePathname }));

const groups = [
  { id: "a", name: "🏠 Dorm 4B", isPersonal: false },
  { id: "b", name: "Saturday picnic", isPersonal: false },
  { id: "p", name: "Personal space", isPersonal: true },
];

beforeEach(() => {
  mocks.usePathname.mockReturnValue("/");
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
