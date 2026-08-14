import type { CandidateId, Scenario } from "./types";

export interface IrvRound {
  counts: Record<CandidateId, number>;
  eliminated: CandidateId | null;
  transfers: Record<CandidateId, Record<CandidateId, number>>;
}

export interface IrvResult {
  rounds: IrvRound[];
  winner: CandidateId;
}

function currentPreference(
  ranking: CandidateId[],
  active: Set<CandidateId>,
): CandidateId {
  const preference = ranking.find((id) => active.has(id));
  if (preference === undefined) {
    throw new Error("ballot ranking is exhausted — no active candidate left");
  }
  return preference;
}

function tallyActive(
  scenario: Scenario,
  active: Set<CandidateId>,
): Record<CandidateId, number> {
  const counts: Record<CandidateId, number> = {};
  for (const id of active) counts[id] = 0;
  for (const group of scenario.groups) {
    counts[currentPreference(group.ranking, active)] += group.count;
  }
  return counts;
}

// Ties are broken deterministically, consistently with tallyFptp: among
// candidates tied for fewest votes, the one whose id sorts last
// (lexicographically) is eliminated — the same "lower id wins a tie" rule,
// applied here to who survives rather than who wins outright.
function pickElimination(counts: Record<CandidateId, number>): CandidateId {
  const ids = Object.keys(counts);
  let loser = ids[0];
  for (const id of ids) {
    if (
      counts[id] < counts[loser] ||
      (counts[id] === counts[loser] && id > loser)
    ) {
      loser = id;
    }
  }
  return loser;
}

export function tallyIrv(scenario: Scenario): IrvResult {
  const active = new Set(scenario.candidates.map((c) => c.id));
  const rounds: IrvRound[] = [];

  while (true) {
    const counts = tallyActive(scenario, active);
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    const majorityWinner = Object.keys(counts).find(
      (id) => counts[id] > total / 2,
    );

    if (majorityWinner !== undefined) {
      rounds.push({ counts, eliminated: null, transfers: {} });
      return { rounds, winner: majorityWinner };
    }

    const eliminated = pickElimination(counts);
    const remaining = new Set(active);
    remaining.delete(eliminated);

    const received: Record<CandidateId, number> = {};
    for (const group of scenario.groups) {
      if (currentPreference(group.ranking, active) !== eliminated) continue;
      const next = currentPreference(group.ranking, remaining);
      received[next] = (received[next] ?? 0) + group.count;
    }

    rounds.push({ counts, eliminated, transfers: { [eliminated]: received } });
    active.delete(eliminated);
  }
}
