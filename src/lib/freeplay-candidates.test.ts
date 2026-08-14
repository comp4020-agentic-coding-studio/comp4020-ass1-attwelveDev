import { describe, expect, it } from "vitest";
import { addCandidate, removeCandidate } from "./freeplay-candidates";
import { FREEPLAY_PALETTE } from "./freeplay-palette";
import type { FreeplayState } from "./freeplay-candidates";

const TOTAL = 1000;

function stateOf(n: number): FreeplayState {
  const entries = FREEPLAY_PALETTE.slice(0, n);
  const share = Math.floor(TOTAL / n);
  const counts: Record<string, number> = {};
  entries.forEach((e, i) => {
    counts[e.id] = i === entries.length - 1 ? TOTAL - share * (n - 1) : share;
  });
  return {
    candidates: entries.map((e) => ({
      id: e.id,
      label: e.label,
      colour: e.colour,
      shape: e.shape,
    })),
    counts,
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
});
