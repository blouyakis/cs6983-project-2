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

  it("links Overview and Groups, and shows Lists and Settle up as not built yet", () => {
    render(<TabBar />);

    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Groups" })).toHaveAttribute(
      "href",
      "/groups",
    );
    expect(screen.queryByRole("link", { name: /Lists/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Settle up/ })).toBeNull();
    expect(screen.getByText("Lists")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Settle up")).toHaveAttribute(
      "aria-disabled",
      "true",
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
