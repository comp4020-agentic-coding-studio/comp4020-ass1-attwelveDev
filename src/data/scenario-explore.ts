import type { Scenario } from "../lib/types";

// The freely-explorable default for the opening section: three hypothetical
// candidates, no scripted outcome. One ballot group per candidate — since
// this section only ever displays first-preference (FPTP) counts, the later
// preferences are placeholders (fixed id order) rather than authored content;
// only the group headed by each candidate is ever touched by the sliders.
//
// Deliberately not tied — with fig (320) ahead of elm (280) and gum (300),
// nudging elm's slider up is enough to flip the plurality winner, which is
// the whole point of a section built around "try it yourself."
export const scenarioExplore: Scenario = {
  candidates: [
    { id: "elm", label: "Elm", colour: "#0072B2", shape: "circle" },
    { id: "fig", label: "Fig", colour: "#E69F00", shape: "square" },
    { id: "gum", label: "Gum", colour: "#009E73", shape: "triangle" },
  ],
  groups: [
    { ranking: ["elm", "fig", "gum"], count: 280 },
    { ranking: ["fig", "elm", "gum"], count: 320 },
    { ranking: ["gum", "fig", "elm"], count: 300 },
  ],
};
