import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppSidebar } from "./AppSidebar";

const mocks = vi.hoisted(() => ({ usePathname: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: mocks.usePathname,
  useRouter: () => ({ push: vi.fn() }),
}));

beforeEach(() => {
  mocks.usePathname.mockReturnValue("/");
});

describe("AppSidebar", () => {
  it("is the desktop navigation, named for screen readers, with the logo", () => {
    render(<AppSidebar />);

    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav.className).toContain("hidden");
    expect(nav.className).toContain("md:flex");
    expect(screen.getByRole("link", { name: "LifeBoard" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("links Overview, Lists, Settle up and Groups", () => {
    render(<AppSidebar />);

    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Groups" })).toHaveAttribute(
      "href",
      "/groups",
    );
    expect(screen.getByRole("link", { name: /Lists/ })).toHaveAttribute(
      "href",
      "/lists",
    );
    expect(screen.getByRole("link", { name: /Settle up/ })).toHaveAttribute(
      "href",
      "/settle-up",
    );
  });

  it("marks Lists and Settle up as current on their pages", () => {
    mocks.usePathname.mockReturnValue("/lists");
    const { unmount } = render(<AppSidebar />);
    expect(screen.getByRole("link", { name: /Lists/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    unmount();

    mocks.usePathname.mockReturnValue("/settle-up");
    render(<AppSidebar />);
    expect(screen.getByRole("link", { name: /Settle up/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks the current page with aria-current", () => {
    mocks.usePathname.mockReturnValue("/groups");

    render(<AppSidebar />);

    expect(screen.getByRole("link", { name: "Groups" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("puts the groups it is given under the page links, then the New group button", () => {
    render(
      <AppSidebar>
        <p>The groups</p>
      </AppSidebar>,
    );

    const nav = screen.getByRole("navigation", { name: "Main" });
    const groups = screen.getByText("The groups");
    const button = screen.getByRole("button", { name: /New group/ });
    expect(nav).toContainElement(groups);
    expect(
      groups.compareDocumentPosition(
        screen.getByRole("link", { name: "Groups" }),
      ),
    ).toBe(Node.DOCUMENT_POSITION_PRECEDING);
    expect(groups.compareDocumentPosition(button)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});
