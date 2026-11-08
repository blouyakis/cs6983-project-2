import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GroupPage from "./page";

const detail = vi.hoisted(() => ({ props: undefined as unknown }));
vi.mock("@/components/groups/GroupDetail", () => ({
  GroupDetail: (props: unknown) => {
    detail.props = props;
    return <p>The group</p>;
  },
}));

describe("group page", () => {
  it("renders the group detail with a link back to all groups", () => {
    render(
      <GroupPage
        params={Promise.resolve({ groupId: "g1" })}
        searchParams={Promise.resolve({})}
      />,
    );

    expect(screen.getByText("The group")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /All groups/ })).toHaveAttribute(
      "href",
      "/groups",
    );
  });

  it("hands the query on to the group detail, for the bill's period (#21)", () => {
    const params = Promise.resolve({ groupId: "g1" });
    const searchParams = Promise.resolve({ period: "p1" });

    render(<GroupPage params={params} searchParams={searchParams} />);

    expect(detail.props).toEqual({ params, searchParams });
  });
});
