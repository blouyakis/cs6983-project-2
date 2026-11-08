// @vitest-environment node
import { describe, expect, it } from "vitest";
import { toMicros } from "./timestamps";

// 2026-11-07T10:00:00Z in microseconds since 1970.
const tenOClock = Date.UTC(2026, 10, 7, 10) * 1000;

describe("toMicros", () => {
  it("keeps all six digits of a Postgres timestamp", () => {
    expect(toMicros("2026-11-07T10:00:00.123456+00:00")).toBe(
      tenOClock + 123456,
    );
  });

  it("tells apart two times in the same millisecond", () => {
    expect(toMicros("2026-11-07T10:00:00.123456+00:00")).toBeLessThan(
      toMicros("2026-11-07T10:00:00.1239+00:00"),
    );
  });

  it("reads a fraction Postgres printed without its trailing zeros", () => {
    expect(toMicros("2026-11-07T10:00:00.1234+00:00")).toBe(tenOClock + 123400);
  });

  it("reads a whole second with no fraction", () => {
    expect(toMicros("2026-11-07T10:00:00+00:00")).toBe(tenOClock);
  });

  it("reads Z and other offsets", () => {
    expect(toMicros("2026-11-07T10:00:00.5Z")).toBe(tenOClock + 500000);
    expect(toMicros("2026-11-07T05:00:00.000001-05:00")).toBe(tenOClock + 1);
  });

  it("throws on a string that isn't a timestamp", () => {
    expect(() => toMicros("yesterday")).toThrow("Not a timestamp: yesterday");
  });
});
