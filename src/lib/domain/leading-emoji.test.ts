import { describe, expect, it } from "vitest";
import { splitLeadingEmoji } from "./leading-emoji";

describe("splitLeadingEmoji", () => {
  it.each([
    ["🥛 Milk", "🥛", "Milk"],
    ["🧻Paper towels", "🧻", "Paper towels"],
    ["👨‍👩‍👧 Family dinner", "👨‍👩‍👧", "Family dinner"],
    ["👋🏽 Thank-you card", "👋🏽", "Thank-you card"],
    ["🇺🇸 Flag", "🇺🇸", "Flag"],
    ["❤️ Flowers", "❤️", "Flowers"],
  ])("takes the whole emoji off the front of %j", (title, emoji, text) => {
    expect(splitLeadingEmoji(title)).toEqual({ emoji, text });
  });

  it.each(["Milk", "1 dozen eggs", "élise's gift", "#1 priority"])(
    "leaves %j without an emoji",
    (title) => {
      expect(splitLeadingEmoji(title)).toEqual({ emoji: null, text: title });
    },
  );

  it("only looks at the start of the title", () => {
    expect(splitLeadingEmoji("Milk 🥛")).toEqual({
      emoji: null,
      text: "Milk 🥛",
    });
  });

  it("keeps a title that is only an emoji as its text", () => {
    expect(splitLeadingEmoji("🥛")).toEqual({ emoji: null, text: "🥛" });
  });
});
