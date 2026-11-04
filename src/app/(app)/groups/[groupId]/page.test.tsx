import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GroupPage from "./page";

vi.mock("@/components/groups/GroupDetail", () => ({
  GroupDetail: () => <p>The group</p>,
}));

describe("group page", () => {
  it("renders the group detail with a link back to all groups", () => {
    render(<GroupPage params={Promise.resolve({ groupId: "g1" })} />);

    expect(screen.getByText("The group")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /All groups/ })).toHaveAttribute(
      "href",
      "/groups",
    );
  });
});
