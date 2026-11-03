import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemberList } from "./MemberList";

const anaId = "6f1c2d4e-1111-4222-8333-944455556666";
const samId = "7a2d3e5f-1111-4222-8333-944455556666";

const members = [
  { userId: anaId, name: "Ana", defaultShareWeight: 1 },
  { userId: samId, name: "Sam", defaultShareWeight: 1 },
];

describe("MemberList", () => {
  it("is titled as DESIGN.md says", () => {
    render(<MemberList members={members} currentUserId={anaId} />);

    expect(
      screen.getByRole("heading", {
        name: "Members · all equal, anyone can invite",
      }),
    ).toBeInTheDocument();
  });

  it("lists each member once, with the current user marked as you", () => {
    render(<MemberList members={members} currentUserId={anaId} />);

    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "AAna (you)",
      "SSam",
    ]);
  });
});
