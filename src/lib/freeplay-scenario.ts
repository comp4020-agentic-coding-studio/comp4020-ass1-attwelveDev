import type { FreeplayState } from "./freeplay-candidates";
import type { CandidateId, Scenario } from "./types";

// Turns editable free-play state into a real Scenario, so every existing
// tally/controller function (tallyFptp, tallyIrv, createIrvController) works
// completely unchanged against reader-authored data.
export function toScenario(state: FreeplayState): Scenario {
  return {
    candidates: state.candidates,
    groups: state.candidates.map((candidate) => ({
      ranking: [candidate.id, ...state.rankings[candidate.id]!],
      count: state.counts[candidate.id]!,
    })),
  };
}

// Derives a starting rankings map from a scenario whose groups already carry
// one full ranking per candidate bloc (every src/data/scenario-*.ts file, and
// scenario-freeplay.ts in particular) -- each group's ranking's own first
// preference is that bloc-owning candidate, so the rest of the ranking is its
// initial "if eliminated" order.
export function initialRankings(scenario: Scenario): Record<CandidateId, CandidateId[]> {
  const rankings: Record<CandidateId, CandidateId[]> = {};
  for (const group of scenario.groups) {
    const [ownerId, ...rest] = group.ranking;
    if (ownerId) rankings[ownerId] = rest;
  }
  return rankings;
}
