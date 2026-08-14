import type { CandidateId, Scenario } from "./types";

export interface FptpResult {
  counts: Record<CandidateId, number>;
  winner: CandidateId;
}

// Ties are broken deterministically: among candidates tied for the most
// votes, the one whose id sorts first (lexicographically) wins. A
// simplification — real FPTP ties are resolved by lot or by-election — but
// picking anything non-deterministic would make the scenario unreproducible.
export function tallyFptp(scenario: Scenario): FptpResult {
  const counts: Record<CandidateId, number> = {};
  for (const candidate of scenario.candidates) {
    counts[candidate.id] = 0;
  }
  for (const group of scenario.groups) {
    const firstPreference = group.ranking[0];
    counts[firstPreference] += group.count;
  }

  let winner = scenario.candidates[0].id;
  for (const candidate of scenario.candidates) {
    const id = candidate.id;
    if (counts[id] > counts[winner] || (counts[id] === counts[winner] && id < winner)) {
      winner = id;
    }
  }

  return { counts, winner };
}
