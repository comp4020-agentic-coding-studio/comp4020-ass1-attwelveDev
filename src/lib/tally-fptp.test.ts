import { describe, expect, it } from "vitest";
import { tallyFptp } from "./tally-fptp";
import type { Scenario } from "./types";

// First-past-the-post: whoever has the most first preferences wins, full
// stop — later preferences on a ballot are never looked at.

const threeWay: Scenario = {
  candidates: [
    { id: "a", label: "Candidate A", colour: "#1", shape: "circle" },
    { id: "b", label: "Candidate B", colour: "#2", shape: "square" },
    { id: "c", label: "Candidate C", colour: "#3", shape: "triangle" },
  ],
  groups: [
    { ranking: ["a", "b", "c"], count: 40 },
    { ranking: ["b", "a", "c"], count: 35 },
    { ranking: ["c", "a", "b"], count: 25 },
  ],
};

describe("tallyFptp", () => {
  it("counts only first preferences", () => {
    const result = tallyFptp(threeWay);
    expect(result.counts).toEqual({ a: 40, b: 35, c: 25 });
  });

  it("declares the plurality winner", () => {
    const result = tallyFptp(threeWay);
    expect(result.winner).toBe("a");
  });

  it("breaks a tie deterministically, in favour of the lower id", () => {
    const tied: Scenario = {
      candidates: threeWay.candidates,
      groups: [
        { ranking: ["a", "b", "c"], count: 50 },
        { ranking: ["b", "a", "c"], count: 50 },
      ],
    };
    const result = tallyFptp(tied);
    expect(result.counts).toEqual({ a: 50, b: 50, c: 0 });
    expect(result.winner).toBe("a");
  });

  it("works for two candidates", () => {
    const twoWay: Scenario = {
      candidates: threeWay.candidates.slice(0, 2),
      groups: [
        { ranking: ["a", "b"], count: 60 },
        { ranking: ["b", "a"], count: 40 },
      ],
    };
    const result = tallyFptp(twoWay);
    expect(result.winner).toBe("a");
    expect(result.counts).toEqual({ a: 60, b: 40 });
  });

  it("scales to six candidates", () => {
    const ids = ["a", "b", "c", "d", "e", "f"];
    const sixWay: Scenario = {
      candidates: ids.map((id) => ({
        id,
        label: id,
        colour: "#000",
        shape: "circle",
      })),
      groups: ids.map((id, i) => ({
        ranking: [id, ...ids.filter((other) => other !== id)],
        count: 30 - i * 2,
      })),
    };
    const result = tallyFptp(sixWay);
    expect(result.winner).toBe("a");
    expect(Object.keys(result.counts).sort()).toEqual(ids);
  });
});
