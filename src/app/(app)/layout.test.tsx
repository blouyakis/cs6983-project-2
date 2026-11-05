import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AppLayout from "./layout";

vi.mock("@/components/ui/SidebarGroups", () => ({
  SidebarGroups: () => <p>The groups</p>,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

describe("signed-in layout", () => {
  it("wraps the page in the sidebar and the tab bar", () => {
    render(
      <AppLayout>
        <main>The page</main>
      </AppLayout>,
    );

    expect(screen.getByRole("main")).toHaveTextContent("The page");
    const navs = screen.getAllByRole("navigation", { name: "Main" });
    expect(navs).toHaveLength(2);
    expect(navs[0].className).toContain("md:flex");
    expect(navs[1].className).toContain("md:hidden");
  });

  it("gives the sidebar the user's groups", () => {
    render(
      <AppLayout>
        <main>The page</main>
      </AppLayout>,
    );

    const [sidebar] = screen.getAllByRole("navigation", { name: "Main" });
    expect(sidebar).toHaveTextContent("The groups");
  });
});
