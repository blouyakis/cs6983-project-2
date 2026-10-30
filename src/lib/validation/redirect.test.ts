import { describe, expect, it } from "vitest";
import { safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it.each([
    ["/groups", "/groups"],
    ["/groups/abc?tab=bill", "/groups/abc?tab=bill"],
  ])("keeps the in-app path %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    [undefined],
    [""],
    ["https://evil.example"],
    ["//evil.example"],
    ["/\\evil.example"],
    ["groups"],
    [["/a", "/b"]],
  ])("falls back to the overview for %j", (input) => {
    expect(safeNextPath(input)).toBe("/");
  });
});
