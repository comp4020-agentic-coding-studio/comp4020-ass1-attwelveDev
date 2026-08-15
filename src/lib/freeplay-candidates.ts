import { redistribute } from "./redistribute";
import {
  FREEPLAY_MAX_CANDIDATES,
  FREEPLAY_MIN_CANDIDATES,
  FREEPLAY_PALETTE,
} from "./freeplay-palette";
import type { Candidate, CandidateId } from "./types";

export interface FreeplayState {
  candidates: Candidate[];
  counts: Record<CandidateId, number>;
  // For each candidate id, every OTHER candidate id in preference order --
  // where that candidate's own bloc's votes go, in order, once eliminated.
  // Always a full permutation of the remaining candidates: tallyIrv throws
  // if a ranking runs out of active candidates before finding one, so
  // addCandidate/removeCandidate/moveRankingEntry below all keep this in
  // sync with the current candidate list rather than letting it drift.
  rankings: Record<CandidateId, CandidateId[]>;
}

export function addCandidate(state: FreeplayState, total: number): FreeplayState {
  if (state.candidates.length >= FREEPLAY_MAX_CANDIDATES) return state;

  const usedIds = new Set(state.candidates.map((c) => c.id));
  const entry = FREEPLAY_PALETTE.find((e) => !usedIds.has(e.id));
  if (!entry) return state;

  const fairShare = Math.round(total / (state.candidates.length + 1));
  const counts = redistribute(
    { ...state.counts, [entry.id]: 0 },
    entry.id,
    fairShare,
    total,
  );

  const existingIds = state.candidates.map((c) => c.id);
  const rankings: Record<CandidateId, CandidateId[]> = {};
  for (const id of existingIds) {
    // A brand new candidate isn't anyone's second choice until the reader
    // says otherwise, so it starts last in every existing bloc's ranking.
    rankings[id] = [...state.rankings[id]!, entry.id];
  }
  rankings[entry.id] = [...existingIds].sort();

  return {
    candidates: [
      ...state.candidates,
      { id: entry.id, label: entry.label, colour: entry.colour, shape: entry.shape },
    ],
    counts,
    rankings,
  };
}

export function removeCandidate(
  state: FreeplayState,
  id: CandidateId,
  total: number,
): FreeplayState {
  if (state.candidates.length <= FREEPLAY_MIN_CANDIDATES) return state;
  if (!(id in state.counts)) return state;

  const rescaled = redistribute(state.counts, id, 0, total);
  const counts: Record<CandidateId, number> = {};
  for (const key of Object.keys(rescaled)) {
    if (key !== id) counts[key] = rescaled[key]!;
  }

  const rankings: Record<CandidateId, CandidateId[]> = {};
  for (const candidate of state.candidates) {
    if (candidate.id === id) continue;
    rankings[candidate.id] = state.rankings[candidate.id]!.filter(
      (otherId) => otherId !== id,
    );
  }

  return {
    candidates: state.candidates.filter((c) => c.id !== id),
    counts,
    rankings,
  };
}

// Swaps candidateId with its neighbour in ownerId's ranking; a no-op at
// either end of the list rather than wrapping around.
export function moveRankingEntry(
  state: FreeplayState,
  ownerId: CandidateId,
  candidateId: CandidateId,
  direction: "up" | "down",
): FreeplayState {
  const ranking = state.rankings[ownerId];
  if (!ranking) return state;

  const index = ranking.indexOf(candidateId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= ranking.length) return state;

  const nextRanking = [...ranking];
  [nextRanking[index], nextRanking[swapIndex]] = [
    nextRanking[swapIndex]!,
    nextRanking[index]!,
  ];

  return {
    ...state,
    rankings: { ...state.rankings, [ownerId]: nextRanking },
  };
}
