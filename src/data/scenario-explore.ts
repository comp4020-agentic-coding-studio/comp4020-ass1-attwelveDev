import type { Scenario } from "../lib/types";
import { candidates } from "./candidates";

// The freely-explorable default for the opening section: the same three
// candidates carried through the whole piece (see ./candidates.ts), no
// scripted outcome yet. One ballot group per candidate — since this section
// only ever displays first-preference (FPTP) counts, the later preferences
// are placeholders (fixed id order) rather than authored content; only the
// group headed by each candidate is ever touched by the sliders.
//
// Deliberately not tied — with birch (320) ahead of aster (280) and cedar
// (300), nudging aster's slider up is enough to flip the plurality winner,
// which is the whole point of a section built around "try it yourself."
export const scenarioExplore: Scenario = {
  candidates,
  groups: [
    { ranking: ["aster", "birch", "cedar"], count: 280 },
    { ranking: ["birch", "aster", "cedar"], count: 320 },
    { ranking: ["cedar", "birch", "aster"], count: 300 },
  ],
};
