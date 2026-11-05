import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("has the title as the page's only level-one heading", () => {
    render(<PageHeader title="Overview" />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Overview" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });

  it("shows the emoji beside the title but keeps it out of the heading's name", () => {
    render(<PageHeader title="Dorm 4B" emoji="🏠" />);

    const heading = screen.getByRole("heading", { level: 1, name: "Dorm 4B" });
    expect(heading).toHaveTextContent("🏠");
    expect(heading.querySelector("[aria-hidden='true']")).toHaveTextContent(
      "🏠",
    );
  });

  it("shows one line of context under the title", () => {
    render(
      <PageHeader title="Dorm 4B" context="Dorm 4B · period since Oct 1" />,
    );

    expect(
      screen.getByText("Dorm 4B · period since Oct 1"),
    ).toBeInTheDocument();
  });

  it("has a back link for phone screens when given one", () => {
    render(
      <PageHeader
        title="Dorm 4B"
        back={{ href: "/groups", label: "Back to all groups" }}
      />,
    );

    const back = screen.getByRole("link", { name: "Back to all groups" });
    expect(back).toHaveAttribute("href", "/groups");
    expect(back.className).toContain("md:hidden");
  });

  it("has no back link without one", () => {
    render(<PageHeader title="Overview" />);

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("puts its children beside the title, for a button or the members' avatars", () => {
    render(
      <PageHeader title="Your corners of life">
        <button type="button">New group</button>
      </PageHeader>,
    );

    expect(
      screen.getByRole("button", { name: "New group" }),
    ).toBeInTheDocument();
  });
});
