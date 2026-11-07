// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NAV_ITEMS, isCurrentPage } from "./nav-items";

describe("NAV_ITEMS", () => {
  it("lists Overview, Lists, Settle up and Groups in that order", () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      "Overview",
      "Lists",
      "Settle up",
      "Groups",
    ]);
  });

  it("links all four navigation pages now that #68 built Lists and Settle up", () => {
    expect(
      NAV_ITEMS.filter((item) => item.built).map((item) => item.href),
    ).toEqual(["/", "/lists", "/settle-up", "/groups"]);
  });
});

describe("isCurrentPage", () => {
  it.each([
    ["/", "/", true],
    ["/groups", "/", false],
    ["/groups", "/groups", true],
    ["/groups/123", "/groups", true],
    ["/groups-archive", "/groups", false],
    ["/", "/groups", false],
    ["/lists", "/lists", true],
    ["/", "/lists", false],
    ["/settle-up", "/settle-up", true],
    ["/", "/settle-up", false],
  ])("on %s, the link to %s is current: %s", (pathname, href, current) => {
    expect(isCurrentPage(pathname, href)).toBe(current);
  });
});
