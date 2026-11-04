// @vitest-environment node
import { describe, expect, it } from "vitest";
import { centsToInputText, formatCents, parseDollars } from "./money";

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

describe("parseDollars", () => {
  it.each([
    ["12.34", 1234],
    ["12", 1200],
    ["12.5", 1250],
    ["0", 0],
    ["0.07", 7],
    ["  8.00 ", 800],
    ["$1,234.56", 123456],
    ["$5", 500],
    ["1234567.89", 123456789],
    ["21474836.47", 2147483647],
  ])("reads %j as %i cents", (text, cents) => {
    expect(parseDollars(text)).toBe(cents);
  });

  it.each([
    "",
    "   ",
    "abc",
    "-5",
    "1.234",
    "1.",
    ".5",
    "1,23",
    "1,2,3",
    "12 34",
    "1e3",
    "$",
    // Ten digits of dollars is the most that stays a safe integer in cents.
    "12345678901",
    "99999999999999999999",
  ])("returns null for %j", (text) => {
    expect(parseDollars(text)).toBeNull();
  });
});

describe("centsToInputText", () => {
  it.each([
    [0, "0.00"],
    [7, "0.07"],
    [100, "1.00"],
    [1234, "12.34"],
    [123456, "1234.56"],
  ])(
    "writes %i cents as %s, with no symbol or commas, to edit in a field",
    (cents, text) => {
      expect(centsToInputText(cents)).toBe(text);
    },
  );

  it("reads back as the same cents", () => {
    for (const cents of [0, 1, 99, 100, 101, 123456, 2_147_483_647]) {
      expect(parseDollars(centsToInputText(cents))).toBe(cents);
    }
  });
});
