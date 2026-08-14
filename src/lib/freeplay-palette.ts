import type { CandidateId, CandidateShape } from "./types";

export interface PaletteEntry {
  id: CandidateId;
  label: string;
  colour: string;
  shape: CandidateShape;
}

// Okabe-Ito colourblind-safe palette, paired with a distinct shape each so
// no two candidates are ever told apart by colour alone.
export const FREEPLAY_PALETTE: PaletteEntry[] = [
  { id: "alder", label: "Alder", colour: "#0072B2", shape: "circle" },
  { id: "beech", label: "Beech", colour: "#E69F00", shape: "square" },
  { id: "cypress", label: "Cypress", colour: "#009E73", shape: "triangle" },
  { id: "dahlia", label: "Dahlia", colour: "#D55E00", shape: "diamond" },
  { id: "ebony", label: "Ebony", colour: "#CC79A7", shape: "star" },
  { id: "fern", label: "Fern", colour: "#56B4E9", shape: "cross" },
];

export const FREEPLAY_MAX_CANDIDATES = FREEPLAY_PALETTE.length;
export const FREEPLAY_MIN_CANDIDATES = 2;
