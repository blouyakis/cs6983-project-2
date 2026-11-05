import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { MoneyText } from "./MoneyText";

function textOf(element: ReactElement): string {
  return render(element).container.textContent ?? "";
}

describe("MoneyText", () => {
  describe("an amount", () => {
    it.each([
      [0, "$0.00"],
      [1, "$0.01"],
      [100, "$1.00"],
      [123456, "$1,234.56"],
    ])("formats %i cents as %s", (cents, text) => {
      expect(textOf(<MoneyText cents={cents} />)).toBe(text);
    });

    it("has no tone, because a plain amount owes nobody", () => {
      const { container } = render(<MoneyText cents={1234} />);

      expect(container.querySelector("[data-tone]")).toBeNull();
    });
  });

  describe("the current user's balance", () => {
    it("writes a negative balance as You owe", () => {
      expect(textOf(<MoneyText cents={-3100} as="balance" />)).toBe(
        "You owe $31.00",
      );
    });

    it("writes a positive balance as You are owed", () => {
      expect(textOf(<MoneyText cents={4200} as="balance" />)).toBe(
        "You are owed $42.00",
      );
    });

    it("writes zero as all settled up, with no amount", () => {
      expect(textOf(<MoneyText cents={0} as="balance" />)).toBe(
        "You are all settled up",
      );
    });

    it("puts the words outside the amount, so the meaning is never color alone", () => {
      const { getByText } = render(<MoneyText cents={-3100} as="balance" />);

      const amount = getByText("$31.00");
      expect(amount).toHaveAttribute("data-tone", "owe");
      expect(amount.parentElement).toHaveTextContent("You owe $31.00");
    });

    it("marks being owed with the owed tone", () => {
      const { getByText } = render(<MoneyText cents={4200} as="balance" />);

      expect(getByText("$42.00")).toHaveAttribute("data-tone", "owed");
    });
  });

  describe("another member's balance", () => {
    it("writes a negative balance as owes", () => {
      expect(textOf(<MoneyText cents={-3100} as="balance" who="Jo" />)).toBe(
        "Jo owes $31.00",
      );
    });

    it("writes a positive balance as is owed", () => {
      expect(textOf(<MoneyText cents={4200} as="balance" who="Sam" />)).toBe(
        "Sam is owed $42.00",
      );
    });

    it("writes zero as all settled up", () => {
      expect(textOf(<MoneyText cents={0} as="balance" who="Sam" />)).toBe(
        "Sam is all settled up",
      );
    });
  });
});
