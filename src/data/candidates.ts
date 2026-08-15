import type { Candidate } from "../lib/types";

// The one shared candidate roster carried through the whole piece -- see
// PLAN.md's Premise ("One hypothetical election, three candidates, carried
// through the whole piece"). Every scenario (explore, spoiler, IRV recount)
// reuses this same array; only each scenario's `groups` (vote tallies)
// differ, so scrolling from one chapter to the next changes tallies, not
// candidate identities.
export const candidates: Candidate[] = [
  { id: "aster", label: "Aster", colour: "#0072B2", shape: "circle" },
  { id: "birch", label: "Birch", colour: "#56B4E9", shape: "square" },
  { id: "cedar", label: "Cedar", colour: "#D55E00", shape: "triangle" },
];
