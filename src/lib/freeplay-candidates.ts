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

  return {
    candidates: [
      ...state.candidates,
      { id: entry.id, label: entry.label, colour: entry.colour, shape: entry.shape },
    ],
    counts,
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

  return {
    candidates: state.candidates.filter((c) => c.id !== id),
    counts,
  };
}
