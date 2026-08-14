import { describe, expect, it } from "vitest";
import { tallyFptp } from "../lib/tally-fptp";
import { tallyIrv } from "../lib/tally-irv";
import { scenarioSpoiler } from "./scenario-spoiler";

// The whole piece's argument rests on this one authored scenario: it must
// reliably spoil under FPTP (vote-splitting hands the win to the reader's
// least-preferred candidate) and resolve under IRV. If this ever stops being
// true, the story has nothing to show.

describe("scenarioSpoiler", () => {
  it("produces different winners under FPTP and IRV", () => {
    const fptp = tallyFptp(scenarioSpoiler);
    const irv = tallyIrv(scenarioSpoiler);
    expect(fptp.winner).not.toBe(irv.winner);
  });

  it("has every ballot group rank every candidate exactly once", () => {
    const candidateIds = scenarioSpoiler.candidates.map((c) => c.id).sort();
    for (const group of scenarioSpoiler.groups) {
      expect([...group.ranking].sort()).toEqual(candidateIds);
    }
  });

  it("includes at least one sample ballot usable for the strategic-voting illustration", () => {
    expect(scenarioSpoiler.groups.length).toBeGreaterThan(0);
    expect(
      scenarioSpoiler.groups.every((group) => group.count > 0),
    ).toBe(true);
  });
});
