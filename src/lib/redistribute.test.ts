import { describe, expect, it } from "vitest";
import { redistribute } from "./redistribute";

// Moving one candidate's slider rescales everyone else proportionally to
// their existing relative shares, using a largest-remainder method so the
// integers still sum to the fixed total pool exactly.

describe("redistribute", () => {
  it("rescales the others proportionally to their prior ratio", () => {
    const result = redistribute({ a: 50, b: 30, c: 20 }, "a", 70, 100);
    expect(result).toEqual({ a: 70, b: 18, c: 12 });
    expect(Object.values(result).reduce((sum, n) => sum + n, 0)).toBe(100);
  });

  it("sums to the total exactly even when proportional shares aren't whole numbers", () => {
    // remaining = 80, split 31:19 -> b = 49.6, c = 30.4; largest remainder
    // (0.6 > 0.4) rounds up to b.
    const result = redistribute({ a: 50, b: 31, c: 19 }, "a", 20, 100);
    expect(result).toEqual({ a: 20, b: 50, c: 30 });
    expect(Object.values(result).reduce((sum, n) => sum + n, 0)).toBe(100);
  });

  it("zeroes everyone else out when the changed candidate takes the full pool", () => {
    const result = redistribute({ a: 50, b: 30, c: 20 }, "a", 100, 100);
    expect(result).toEqual({ a: 100, b: 0, c: 0 });
  });

  it("fills the pool proportionally when the changed candidate drops to zero", () => {
    const result = redistribute({ a: 50, b: 30, c: 20 }, "a", 0, 100);
    expect(result).toEqual({ a: 0, b: 60, c: 40 });
  });

  it("splits evenly among others that were previously all zero", () => {
    const result = redistribute({ a: 100, b: 0, c: 0 }, "a", 40, 100);
    expect(result).toEqual({ a: 40, b: 30, c: 30 });
  });

  it("clamps the changed value into [0, total]", () => {
    const over = redistribute({ a: 50, b: 50 }, "a", 150, 100);
    expect(over).toEqual({ a: 100, b: 0 });

    const under = redistribute({ a: 50, b: 50 }, "a", -10, 100);
    expect(under).toEqual({ a: 0, b: 100 });
  });
});
