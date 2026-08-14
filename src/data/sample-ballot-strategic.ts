import type { CandidateId } from "../lib/types";

// One illustrative voter from scenario-spoiler's birch group. Sincerely they
// rank birch first — but birch is the weaker of the two similar candidates,
// so under FPTP that vote is effectively wasted while cedar wins. Backing
// aster instead (their genuine second choice) is the tactical alternative.
export const strategicBallot: {
  sincereRanking: CandidateId[];
  tacticalRanking: CandidateId[];
} = {
  sincereRanking: ["birch", "aster", "cedar"],
  tacticalRanking: ["aster", "birch", "cedar"],
};
