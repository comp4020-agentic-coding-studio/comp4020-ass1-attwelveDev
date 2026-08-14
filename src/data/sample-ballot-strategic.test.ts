import { describe, expect, it } from "vitest";
import { tallyFptp } from "../lib/tally-fptp";
import { scenarioSpoiler } from "./scenario-spoiler";
import { strategicBallot } from "./sample-ballot-strategic";

// The strategic-voting illustration only makes the point it claims to if the
// numbers actually back it up: a birch supporter's sincere vote isn't going
// to elect their favourite, but backing the stronger of the two similar
// candidates (aster) instead of splitting the vote is a real improvement —
// not just a plausible-looking arrow on a diagram.

describe("strategicBallot", () => {
  it("keeps every candidate ranked exactly once in both versions", () => {
    const candidateIds = scenarioSpoiler.candidates.map((c) => c.id).sort();
    expect([...strategicBallot.sincereRanking].sort()).toEqual(candidateIds);
    expect([...strategicBallot.tacticalRanking].sort()).toEqual(candidateIds);
  });

  it("changes the voter's expressed first preference", () => {
    expect(strategicBallot.tacticalRanking[0]).not.toBe(
      strategicBallot.sincereRanking[0],
    );
  });

  it("backs a candidate who is currently doing better than the sincere favourite", () => {
    const { counts, winner } = tallyFptp(scenarioSpoiler);
    const sincereFirst = strategicBallot.sincereRanking[0];
    const tacticalFirst = strategicBallot.tacticalRanking[0];

    // Their sincere favourite isn't winning under FPTP...
    expect(winner).not.toBe(sincereFirst);
    // ...but the candidate they'd back tactically instead is stronger.
    expect(counts[tacticalFirst]).toBeGreaterThan(counts[sincereFirst]);
  });
});
