import { describe, expect, it } from "vitest";
import { tallyIrv } from "./tally-irv";
import type { Scenario } from "./types";

// Instant-runoff: eliminate the last-place candidate each round, transfer
// their ballots to each voter's next continuing preference, repeat until
// someone has a majority of the (still-active) ballots.

function candidates(ids: string[]) {
  return ids.map((id) => ({
    id,
    label: id.toUpperCase(),
    colour: "#000",
    shape: "circle" as const,
  }));
}

describe("tallyIrv", () => {
  it("declares a first-round majority winner with no elimination", () => {
    const scenario: Scenario = {
      candidates: candidates(["a", "b"]),
      groups: [
        { ranking: ["a", "b"], count: 60 },
        { ranking: ["b", "a"], count: 40 },
      ],
    };
    const result = tallyIrv(scenario);
    expect(result.winner).toBe("a");
    expect(result.rounds).toHaveLength(1);
    expect(result.rounds[0]).toEqual({
      counts: { a: 60, b: 40 },
      eliminated: null,
      transfers: {},
    });
  });

  it("resolves a single-round elimination among three candidates", () => {
    // No one has a first-round majority (need > 50 of 100). C, last place,
    // is eliminated; C's ballots (ranked [c, a, b]) transfer to a.
    const scenario: Scenario = {
      candidates: candidates(["a", "b", "c"]),
      groups: [
        { ranking: ["a", "b", "c"], count: 40 },
        { ranking: ["b", "a", "c"], count: 35 },
        { ranking: ["c", "a", "b"], count: 25 },
      ],
    };
    const result = tallyIrv(scenario);

    expect(result.rounds).toHaveLength(2);
    expect(result.rounds[0]).toEqual({
      counts: { a: 40, b: 35, c: 25 },
      eliminated: "c",
      transfers: { c: { a: 25 } },
    });
    expect(result.rounds[1]).toEqual({
      counts: { a: 65, b: 35 },
      eliminated: null,
      transfers: {},
    });
    expect(result.winner).toBe("a");
  });

  it("carries a full round-by-round history through multiple eliminations (5 candidates)", () => {
    // Round 1: eliminate E (10) -> transfers to A (E's next continuing pref).
    // Round 2: eliminate D (15) -> transfers to C (D's next continuing pref,
    //   since E is already gone).
    // Round 3: eliminate B (25) -> transfers to A (B's next continuing pref,
    //   since D and E are already gone).
    // Round 4: A has a majority.
    const scenario: Scenario = {
      candidates: candidates(["a", "b", "c", "d", "e"]),
      groups: [
        { ranking: ["a", "b", "c", "d", "e"], count: 30 },
        { ranking: ["b", "a", "c", "d", "e"], count: 25 },
        { ranking: ["c", "d", "a", "b", "e"], count: 20 },
        { ranking: ["d", "c", "a", "b", "e"], count: 15 },
        { ranking: ["e", "a", "b", "c", "d"], count: 10 },
      ],
    };
    const result = tallyIrv(scenario);

    expect(result.rounds).toHaveLength(4);
    expect(result.rounds[0]).toEqual({
      counts: { a: 30, b: 25, c: 20, d: 15, e: 10 },
      eliminated: "e",
      transfers: { e: { a: 10 } },
    });
    expect(result.rounds[1]).toEqual({
      counts: { a: 40, b: 25, c: 20, d: 15 },
      eliminated: "d",
      transfers: { d: { c: 15 } },
    });
    expect(result.rounds[2]).toEqual({
      counts: { a: 40, b: 25, c: 35 },
      eliminated: "b",
      transfers: { b: { a: 25 } },
    });
    expect(result.rounds[3]).toEqual({
      counts: { a: 65, c: 35 },
      eliminated: null,
      transfers: {},
    });
    expect(result.winner).toBe("a");
  });

  it("breaks an elimination tie deterministically, eliminating the higher id", () => {
    // b and c are tied for fewest (25 each); the tie-break eliminates c
    // (higher id survives-preference rule: lower id survives a tie).
    const scenario: Scenario = {
      candidates: candidates(["a", "b", "c"]),
      groups: [
        { ranking: ["a", "b", "c"], count: 50 },
        { ranking: ["b", "a", "c"], count: 25 },
        { ranking: ["c", "a", "b"], count: 25 },
      ],
    };
    const result = tallyIrv(scenario);
    expect(result.rounds[0].eliminated).toBe("c");
    expect(result.winner).toBe("a");
  });
});
