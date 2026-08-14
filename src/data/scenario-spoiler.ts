import type { Scenario } from "../lib/types";

// The one authored scenario the whole piece's argument rests on: two
// similar candidates (aster, birch) split a majority that would rather see
// either of them win over cedar, handing cedar the plurality under FPTP.
// Their voters' shared second preference for each other is exactly what IRV
// recovers.
//
// FPTP: aster 320, birch 300, cedar 380 -> cedar wins on a minority of first
// preferences, despite 620 of 1000 voters (aster + birch) preferring anyone
// but cedar.
// IRV: birch (lowest) is eliminated first; birch's ballots list aster next,
// so all 300 transfer to aster -> aster 620, cedar 380 -> aster wins.
export const scenarioSpoiler: Scenario = {
  candidates: [
    { id: "aster", label: "Aster", colour: "#0072B2", shape: "circle" },
    { id: "birch", label: "Birch", colour: "#56B4E9", shape: "square" },
    { id: "cedar", label: "Cedar", colour: "#D55E00", shape: "triangle" },
  ],
  groups: [
    { ranking: ["aster", "birch", "cedar"], count: 320 },
    { ranking: ["birch", "aster", "cedar"], count: 300 },
    { ranking: ["cedar", "aster", "birch"], count: 380 },
  ],
};
