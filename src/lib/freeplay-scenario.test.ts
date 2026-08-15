import { describe, expect, it } from "vitest";
import type { FreeplayState } from "./freeplay-candidates";
import { initialRankings, toScenario } from "./freeplay-scenario";
import { tallyFptp } from "./tally-fptp";
import { tallyIrv } from "./tally-irv";
import type { Scenario } from "./types";

function stateOf(): FreeplayState {
  const candidates = [
    { id: "a", label: "A", colour: "#000", shape: "circle" as const },
    { id: "b", label: "B", colour: "#000", shape: "square" as const },
    { id: "c", label: "C", colour: "#000", shape: "triangle" as const },
  ];
  return {
    candidates,
    counts: { a: 400, b: 350, c: 250 },
    rankings: {
      a: ["b", "c"],
      b: ["a", "c"],
      c: ["a", "b"],
    },
  };
}

describe("toScenario", () => {
  it("builds one group per candidate, with the owner first and its ranking after", () => {
    const state = stateOf();
    const scenario = toScenario(state);

    expect(scenario.candidates).toBe(state.candidates);
    expect(scenario.groups).toHaveLength(3);
    const groupFor = (id: string) =>
      scenario.groups.find((g) => g.ranking[0] === id)!;

    expect(groupFor("a").ranking).toEqual(["a", "b", "c"]);
    expect(groupFor("a").count).toBe(400);
    expect(groupFor("b").ranking).toEqual(["b", "a", "c"]);
    expect(groupFor("c").ranking).toEqual(["c", "a", "b"]);
  });

  it("tallies correctly through the real tallyFptp", () => {
    const scenario = toScenario(stateOf());
    const result = tallyFptp(scenario);
    expect(result.counts).toEqual({ a: 400, b: 350, c: 250 });
    expect(result.winner).toBe("a");
  });

  it("tallies correctly through the real tallyIrv", () => {
    const scenario = toScenario(stateOf());
    const result = tallyIrv(scenario);
    // c is eliminated first (fewest first preferences); c's ranking sends
    // its votes to a, giving a an outright majority.
    expect(result.winner).toBe("a");
  });
});

describe("initialRankings", () => {
  it("derives each candidate's ranking from its own bloc's full ranking", () => {
    const scenario: Scenario = {
      candidates: [
        { id: "a", label: "A", colour: "#000", shape: "circle" },
        { id: "b", label: "B", colour: "#000", shape: "square" },
        { id: "c", label: "C", colour: "#000", shape: "triangle" },
      ],
      groups: [
        { ranking: ["a", "b", "c"], count: 400 },
        { ranking: ["b", "a", "c"], count: 350 },
        { ranking: ["c", "a", "b"], count: 250 },
      ],
    };

    expect(initialRankings(scenario)).toEqual({
      a: ["b", "c"],
      b: ["a", "c"],
      c: ["a", "b"],
    });
  });
});
