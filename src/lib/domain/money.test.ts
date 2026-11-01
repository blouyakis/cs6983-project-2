// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatCents } from "./money";

describe("formatCents", () => {
  it.each([
    [0, "$0.00"],
    [1, "$0.01"],
    [999, "$9.99"],
    [100, "$1.00"],
    [123456, "$1,234.56"],
  ])("formats %i cents as %s", (cents, text) => {
    expect(formatCents(cents)).toBe(text);
  });
});
