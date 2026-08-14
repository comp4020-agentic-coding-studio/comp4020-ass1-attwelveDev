import { describe, expect, it } from "vitest";
import { sampleAllocation } from "./sample-ballots";
import type { Scenario } from "./types";

// The ballot-drift animation doesn't draw one dot per real voter — it draws
// a small representative sample. This is the proportional (largest-
// remainder) allocation of a fixed dot budget across candidates.

function scenario(counts: [number, number, number]): Scenario {
  return {
    candidates: [
      { id: "a", label: "A", colour: "#000", shape: "circle" },
      { id: "b", label: "B", colour: "#111", shape: "square" },
      { id: "c", label: "C", colour: "#222", shape: "triangle" },
    ],
    groups: [
      { ranking: ["a", "b", "c"], count: counts[0] },
      { ranking: ["b", "a", "c"], count: counts[1] },
      { ranking: ["c", "a", "b"], count: counts[2] },
    ],
  };
}

describe("sampleAllocation", () => {
  it("distributes the requested total exactly, even with rounding", () => {
    const allocation = sampleAllocation(scenario([320, 300, 380]), 24);
    const total = Object.values(allocation).reduce((sum, n) => sum + n, 0);
    expect(total).toBe(24);
  });

  it("gives more dots to a candidate with more votes", () => {
    const allocation = sampleAllocation(scenario([75, 15, 10]), 20);
    expect(allocation.a).toBeGreaterThan(allocation.b);
    expect(allocation.b).toBeGreaterThan(allocation.c);
  });

  it("splits evenly when candidates are tied", () => {
    const allocation = sampleAllocation(scenario([100, 100, 100]), 30);
    expect(allocation).toEqual({ a: 10, b: 10, c: 10 });
  });

  it("returns all zeros without dividing by zero when there are no votes", () => {
    const allocation = sampleAllocation(scenario([0, 0, 0]), 24);
    expect(allocation).toEqual({ a: 0, b: 0, c: 0 });
  });
});
