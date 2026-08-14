import type { Candidate } from "./types";

export function ariaValueText(
  candidate: Candidate,
  count: number,
  total: number,
): string {
  return `${candidate.label}: ${count} of ${total} votes`;
}
