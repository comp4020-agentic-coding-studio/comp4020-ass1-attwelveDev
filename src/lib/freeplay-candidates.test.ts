import { describe, expect, it } from "vitest";
import {
  addCandidate,
  moveRankingEntry,
  removeCandidate,
} from "./freeplay-candidates";
import { FREEPLAY_PALETTE } from "./freeplay-palette";
import type { FreeplayState } from "./freeplay-candidates";

const TOTAL = 1000;

function stateOf(n: number): FreeplayState {
  const entries = FREEPLAY_PALETTE.slice(0, n);
  const share = Math.floor(TOTAL / n);
  const counts: Record<string, number> = {};
  const rankings: Record<string, string[]> = {};
  const ids = entries.map((e) => e.id);
  entries.forEach((e, i) => {
    counts[e.id] = i === entries.length - 1 ? TOTAL - share * (n - 1) : share;
    rankings[e.id] = ids.filter((id) => id !== e.id);
  });
  return {
    candidates: entries.map((e) => ({
      id: e.id,
      label: e.label,
      colour: e.colour,
      shape: e.shape,
    })),
    counts,
    rankings,
  };
}

describe("addCandidate", () => {
  it("appends the first unused palette entry and preserves the total", () => {
    const before = stateOf(2);
    const after = addCandidate(before, TOTAL);

    expect(after.candidates).toHaveLength(3);
    expect(after.candidates[2]!.id).toBe(FREEPLAY_PALETTE[2]!.id);
    const sum = Object.values(after.counts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(TOTAL);
    expect(after.counts[FREEPLAY_PALETTE[2]!.id]).toBeGreaterThan(0);
  });

  it("is a no-op once the palette's full candidate count is reached", () => {
    const before = stateOf(FREEPLAY_PALETTE.length);
    const after = addCandidate(before, TOTAL);
    expect(after).toBe(before);
  });

  it("assigns a collision-free id after an add/remove/add sequence", () => {
    let state = stateOf(3);
    state = removeCandidate(state, FREEPLAY_PALETTE[1]!.id, TOTAL);
    state = addCandidate(state, TOTAL);

    const ids = state.candidates.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("appends the new candidate last to every existing bloc's ranking", () => {
    const before = stateOf(2);
    const after = addCandidate(before, TOTAL);
    const newId = FREEPLAY_PALETTE[2]!.id;

    for (const id of [FREEPLAY_PALETTE[0]!.id, FREEPLAY_PALETTE[1]!.id]) {
      const ranking = after.rankings[id]!;
      expect(ranking.at(-1)).toBe(newId);
    }
  });

  it("seeds the new candidate's own ranking as a full permutation of the rest", () => {
    const before = stateOf(2);
    const after = addCandidate(before, TOTAL);
    const newId = FREEPLAY_PALETTE[2]!.id;
    const otherIds = [FREEPLAY_PALETTE[0]!.id, FREEPLAY_PALETTE[1]!.id];

    expect(new Set(after.rankings[newId])).toEqual(new Set(otherIds));
    expect(after.rankings[newId]).toHaveLength(otherIds.length);
  });
});

describe("removeCandidate", () => {
  it("drops the candidate and redistributes their votes, preserving the total", () => {
    const before = stateOf(3);
    const droppedId = FREEPLAY_PALETTE[1]!.id;
    const after = removeCandidate(before, droppedId, TOTAL);

    expect(after.candidates.some((c) => c.id === droppedId)).toBe(false);
    expect(droppedId in after.counts).toBe(false);
    const sum = Object.values(after.counts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(TOTAL);
  });

  it("is a no-op once the floor of two candidates is reached", () => {
    const before = stateOf(2);
    const after = removeCandidate(before, FREEPLAY_PALETTE[0]!.id, TOTAL);
    expect(after).toBe(before);
  });

  it("is a no-op for a candidate id that isn't currently active", () => {
    const before = stateOf(2);
    const after = removeCandidate(before, FREEPLAY_PALETTE[5]!.id, TOTAL);
    expect(after).toBe(before);
  });

  it("strips the removed candidate from every remaining bloc's ranking, with no orphans", () => {
    const before = stateOf(3);
    const droppedId = FREEPLAY_PALETTE[1]!.id;
    const after = removeCandidate(before, droppedId, TOTAL);

    expect(droppedId in after.rankings).toBe(false);
    for (const candidate of after.candidates) {
      expect(after.rankings[candidate.id]).not.toContain(droppedId);
      // Every remaining ranking should be a full permutation of the other
      // remaining candidates -- tallyIrv throws if it isn't.
      const expected = after.candidates
        .map((c) => c.id)
        .filter((id) => id !== candidate.id);
      expect(new Set(after.rankings[candidate.id])).toEqual(new Set(expected));
    }
  });
});

describe("moveRankingEntry", () => {
  it("swaps a candidate with its neighbour when moved up", () => {
    const before = stateOf(3);
    const ownerId = FREEPLAY_PALETTE[0]!.id;
    const ranking = before.rankings[ownerId]!;
    const [first, second] = ranking;

    const after = moveRankingEntry(before, ownerId, second!, "up");
    expect(after.rankings[ownerId]).toEqual([second, first]);
  });

  it("swaps a candidate with its neighbour when moved down", () => {
    const before = stateOf(3);
    const ownerId = FREEPLAY_PALETTE[0]!.id;
    const ranking = before.rankings[ownerId]!;
    const [first, second] = ranking;

    const after = moveRankingEntry(before, ownerId, first!, "down");
    expect(after.rankings[ownerId]).toEqual([second, first]);
  });

  it("is a no-op moving the first entry up", () => {
    const before = stateOf(3);
    const ownerId = FREEPLAY_PALETTE[0]!.id;
    const first = before.rankings[ownerId]![0]!;

    const after = moveRankingEntry(before, ownerId, first, "up");
    expect(after).toBe(before);
  });

  it("is a no-op moving the last entry down", () => {
    const before = stateOf(3);
    const ownerId = FREEPLAY_PALETTE[0]!.id;
    const last = before.rankings[ownerId]!.at(-1)!;

    const after = moveRankingEntry(before, ownerId, last, "down");
    expect(after).toBe(before);
  });

  it("leaves other candidates' rankings untouched", () => {
    const before = stateOf(3);
    const ownerId = FREEPLAY_PALETTE[0]!.id;
    const otherId = FREEPLAY_PALETTE[1]!.id;
    const second = before.rankings[ownerId]![1]!;

    const after = moveRankingEntry(before, ownerId, second, "up");
    expect(after.rankings[otherId]).toEqual(before.rankings[otherId]);
  });
});
