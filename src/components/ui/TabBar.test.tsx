import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TabBar } from "./TabBar";

const mocks = vi.hoisted(() => ({ usePathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: mocks.usePathname }));

beforeEach(() => {
  mocks.usePathname.mockReturnValue("/");
});

describe("TabBar", () => {
  it("is the phone navigation, named for screen readers", () => {
    render(<TabBar />);

    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav.className).toContain("md:hidden");
  });

  it("links Overview, Lists, Settle up and Groups", () => {
    render(<TabBar />);

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

  it("marks the current tab with aria-current", () => {
    mocks.usePathname.mockReturnValue("/groups/abc");

    render(<TabBar />);

    expect(screen.getByRole("link", { name: "Groups" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks Lists and Settle up as current on their pages", () => {
    mocks.usePathname.mockReturnValue("/lists");
    const { unmount } = render(<TabBar />);
    expect(screen.getByRole("link", { name: /Lists/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    unmount();

    mocks.usePathname.mockReturnValue("/settle-up");
    render(<TabBar />);
    expect(screen.getByRole("link", { name: /Settle up/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks Overview on the root path only", () => {
    render(<TabBar />);

    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Groups" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
