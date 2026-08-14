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
