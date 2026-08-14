export type CandidateId = string;

// A closed set, not an open string — the swatch styles (CandidateStack.astro)
// switch on it directly, so an unhandled shape should be a type error, not a
// silently-unstyled swatch.
export type CandidateShape =
  | "circle"
  | "square"
  | "triangle"
  | "diamond"
  | "star"
  | "cross";

export interface Candidate {
  id: CandidateId;
  label: string;
  colour: string;
  shape: CandidateShape;
}

// One row per distinct full ranking, not one row per voter — keeps a
// scenario with thousands of voters cheap to tally and to animate (only a
// representative sample of individual ballots ever needs to move).
export interface BallotGroup {
  ranking: CandidateId[];
  count: number;
}

export interface Scenario {
  candidates: Candidate[];
  groups: BallotGroup[];
}
