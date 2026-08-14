import type { CandidateId } from "./types";

const EPSILON = 1e-9;

// Moving one candidate's slider to `newValue` rescales everyone else
// proportionally to their existing relative shares, so the pool always sums
// to `total`. Fractional shares are settled with a largest-remainder method:
// floor every share, then hand the few leftover votes to whoever's fractional
// part was biggest (ties going to the lower id), rather than always rounding
// the same way and drifting off the total.
export function redistribute(
  current: Record<CandidateId, number>,
  changedId: CandidateId,
  newValue: number,
  total: number,
): Record<CandidateId, number> {
  const clamped = Math.min(total, Math.max(0, newValue));
  const remaining = total - clamped;
  const others = Object.keys(current).filter((id) => id !== changedId);

  const result: Record<CandidateId, number> = { [changedId]: clamped };

  const othersSum = others.reduce((sum, id) => sum + current[id], 0);
  const weights =
    othersSum === 0
      ? Object.fromEntries(others.map((id) => [id, 1 / others.length]))
      : Object.fromEntries(others.map((id) => [id, current[id] / othersSum]));

  const raw = Object.fromEntries(
    others.map((id) => [id, remaining * weights[id]]),
  );
  const floors = Object.fromEntries(
    others.map((id) => [id, Math.floor(raw[id] + EPSILON)]),
  );
  let leftover = remaining - others.reduce((sum, id) => sum + floors[id], 0);

  const byRemainderDesc = [...others].sort((a, b) => {
    const diff = raw[b] - Math.floor(raw[b] + EPSILON) - (raw[a] - Math.floor(raw[a] + EPSILON));
    if (diff !== 0) return diff;
    return a < b ? -1 : 1;
  });

  for (const id of others) result[id] = floors[id];
  for (const id of byRemainderDesc) {
    if (leftover <= 0) break;
    result[id] += 1;
    leftover -= 1;
  }

  return result;
}
