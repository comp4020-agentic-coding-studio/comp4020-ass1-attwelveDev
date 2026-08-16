import type { Candidate, CandidateId } from "./types";

export function ariaValueText(
  candidate: Candidate,
  count: number,
  total: number,
): string {
  return `${candidate.label}: ${count} of ${total} votes`;
}

// Other candidate ids sharing outcomeId's exact count -- i.e. who outcomeId
// was actually tied with before tallyFptp/tallyIrv's deterministic
// tie-break picked it.
export function tiedCandidateIds(
  counts: Record<CandidateId, number>,
  outcomeId: CandidateId,
): CandidateId[] {
  const value = counts[outcomeId];
  return Object.keys(counts).filter(
    (id) => id !== outcomeId && counts[id] === value,
  );
}

// "" when untied; otherwise a sentence fragment to append to a status
// string. `onWhat` names what the tie was over ("votes", "fewest votes").
// Describes the tie-break as "alphabetically by name" rather than "by id"
// because id isn't reader-visible -- true today since every scenario's
// candidate id is just its lowercased label.
export function tieNote(tiedLabels: string[], onWhat: string): string {
  if (tiedLabels.length === 0) return "";
  const list =
    tiedLabels.length === 1
      ? tiedLabels[0]
      : `${tiedLabels.slice(0, -1).join(", ")} and ${tiedLabels[tiedLabels.length - 1]}`;
  return ` Tied with ${list} on ${onWhat} — ties are broken alphabetically by name.`;
}

// tallyIrv declares a winner the moment any candidate clears a majority of
// the vote still in play, which can happen while other candidates are still
// standing (not yet eliminated) -- naming the actual count here is what
// tells a reader that's the rule working as intended, not a bug.
export function winnerAnnouncement(
  label: string,
  count: number,
  total: number,
): string {
  return `${label} wins after the recount, having crossed a majority of the vote (${count} of ${total}).`;
}
