import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SettleUpPage from "./page";

vi.mock("@/components/settle-up/SettleUpDetail", () => ({
  SettleUpDetail: () => <p>The settle-up</p>,
}));

describe("settle-up page", () => {
  it("renders the settle-up detail inside the page's main", () => {
    render(<SettleUpPage params={Promise.resolve({ groupId: "g1" })} />);

    expect(screen.getByRole("main")).toContainElement(
      screen.getByText("The settle-up"),
    );
  });
});
