import { tiedCandidateIds } from "./format";
import { tallyIrv, type IrvRound } from "./tally-irv";
import type { CandidateId, Scenario } from "./types";

// Steps a reader through tallyIrv's round history one click at a time. The
// full result is computed once up front; this just owns which round is
// currently shown, so the DOM wiring (step 6) only ever asks "what round am
// I on" and "can I go further."
export interface IrvController {
  readonly roundIndex: number;
  readonly currentRound: IrvRound;
  readonly isFinal: boolean;
  readonly winner: CandidateId | null;
  readonly justEliminated: CandidateId | null;
  readonly justEliminatedTiedWith: CandidateId[];
  readonly justTransfers: Record<CandidateId, number> | null;
  next(): boolean;
  prev(): boolean;
}

export function createIrvController(scenario: Scenario): IrvController {
  const { rounds, winner } = tallyIrv(scenario);
  let roundIndex = 0;

  return {
    get roundIndex() {
      return roundIndex;
    },
    get currentRound() {
      return rounds[roundIndex];
    },
    get isFinal() {
      return roundIndex === rounds.length - 1;
    },
    get winner() {
      return roundIndex === rounds.length - 1 ? winner : null;
    },
    // A round's own `eliminated` field names who is *about to be* eliminated
    // once its transfers are applied — so the elimination that led to the
    // current round lives on the previous round, not this one.
    get justEliminated() {
      return roundIndex > 0 ? rounds[roundIndex - 1].eliminated : null;
    },
    // Who the just-eliminated candidate was actually tied with for fewest
    // votes, before pickElimination's deterministic tie-break picked them —
    // read off the previous round's counts, the same round that recorded
    // the elimination itself.
    get justEliminatedTiedWith() {
      const previous = roundIndex > 0 ? rounds[roundIndex - 1] : null;
      return previous?.eliminated
        ? tiedCandidateIds(previous.counts, previous.eliminated)
        : [];
    },
    get justTransfers() {
      const previous = roundIndex > 0 ? rounds[roundIndex - 1] : null;
      return previous?.eliminated
        ? (previous.transfers[previous.eliminated] ?? null)
        : null;
    },
    next(): boolean {
      if (roundIndex >= rounds.length - 1) return false;
      roundIndex++;
      return true;
    },
    prev(): boolean {
      if (roundIndex <= 0) return false;
      roundIndex--;
      return true;
    },
  };
}
