import { describe, expect, it } from "vitest";
import { firstCharacter } from "./first-character";

describe("firstCharacter", () => {
  it.each([
    ["Sam", "S"],
    ["sam", "S"],
    ["  Jo", "J"],
    ["élise", "É"],
  ])("takes the first letter of %j, in capitals", (name, expected) => {
    expect(firstCharacter(name)).toBe(expected);
  });

  it.each([
    ["🏠 Flat", "🏠"],
    ["👨‍👩‍👧 Family", "👨‍👩‍👧"],
    ["🇺🇸 Trip", "🇺🇸"],
    ["👋🏽 Hi", "👋🏽"],
  ])("keeps the whole emoji at the start of %j", (name, expected) => {
    expect(firstCharacter(name)).toBe(expected);
  });

  it("keeps a letter with a combining accent together", () => {
    expect(firstCharacter("éva")).toBe("É");
  });

  it.each(["", "   "])("falls back to ? for %j", (name) => {
    expect(firstCharacter(name)).toBe("?");
  });
});
