import { tallyFptp } from "./tally-fptp";
import type { CandidateId, Scenario } from "./types";

// Largest-remainder allocation of a fixed number of visual "sample ballot"
// dots across candidates, proportional to their current FPTP first-
// preference counts. We never draw one dot per real voter, just a
// representative sample sized for the ballot-drift animation.
export function sampleAllocation(
  scenario: Scenario,
  totalSamples: number,
): Record<CandidateId, number> {
  const { counts } = tallyFptp(scenario);
  const ids = scenario.candidates.map((c) => c.id);
  const total = ids.reduce((sum, id) => sum + counts[id], 0);

  const allocation: Record<CandidateId, number> = {};
  if (total === 0) {
    for (const id of ids) allocation[id] = 0;
    return allocation;
  }

  const raw = ids.map((id) => (counts[id] / total) * totalSamples);
  const floors = raw.map(Math.floor);
  let remainder = totalSamples - floors.reduce((sum, n) => sum + n, 0);

  ids.forEach((id, i) => {
    allocation[id] = floors[i];
  });

  const byRemainingFraction = ids
    .map((id, i) => ({ id, frac: raw[i] - floors[i] }))
    .sort((a, b) => b.frac - a.frac);

  for (const { id } of byRemainingFraction) {
    if (remainder <= 0) break;
    allocation[id]++;
    remainder--;
  }

  return allocation;
}
