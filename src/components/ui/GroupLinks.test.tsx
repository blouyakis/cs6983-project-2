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
});
