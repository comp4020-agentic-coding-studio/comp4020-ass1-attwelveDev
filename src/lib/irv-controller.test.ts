import { describe, expect, it } from "vitest";
import { createIrvController } from "./irv-controller";
import type { Scenario } from "./types";

// The IRV recount section steps a reader through tallyIrv's round history one
// click at a time. This controller owns just that round-index state — no DOM
// — so the stepping logic (bounds, when the winner becomes known) is tested
// without needing a browser.

function candidates(ids: string[]) {
  return ids.map((id) => ({
    id,
    label: id.toUpperCase(),
    colour: "#000",
    shape: "circle" as const,
  }));
}

const threeCandidateScenario: Scenario = {
  candidates: candidates(["a", "b", "c"]),
  groups: [
    { ranking: ["a", "b", "c"], count: 40 },
    { ranking: ["b", "a", "c"], count: 35 },
    { ranking: ["c", "a", "b"], count: 25 },
  ],
};

describe("createIrvController", () => {
  it("starts at the first round, with no winner or elimination declared yet", () => {
    const controller = createIrvController(threeCandidateScenario);
    expect(controller.roundIndex).toBe(0);
    expect(controller.currentRound.counts).toEqual({ a: 40, b: 35, c: 25 });
    expect(controller.isFinal).toBe(false);
    expect(controller.winner).toBeNull();
    expect(controller.justEliminated).toBeNull();
  });

  it("advances to the next round, revealing the winner and who was just eliminated", () => {
    const controller = createIrvController(threeCandidateScenario);
    const advanced = controller.next();
    expect(advanced).toBe(true);
    expect(controller.roundIndex).toBe(1);
    expect(controller.currentRound.counts).toEqual({ a: 65, b: 35 });
    expect(controller.isFinal).toBe(true);
    expect(controller.winner).toBe("a");
    expect(controller.justEliminated).toBe("c");
  });

  it("won't advance past the final round", () => {
    const controller = createIrvController(threeCandidateScenario);
    controller.next();
    const advanced = controller.next();
    expect(advanced).toBe(false);
    expect(controller.roundIndex).toBe(1);
  });

  it("can step backward, and the winner is hidden again", () => {
    const controller = createIrvController(threeCandidateScenario);
    controller.next();
    const wentBack = controller.prev();
    expect(wentBack).toBe(true);
    expect(controller.roundIndex).toBe(0);
    expect(controller.isFinal).toBe(false);
    expect(controller.winner).toBeNull();
  });

  it("won't step back before the first round", () => {
    const controller = createIrvController(threeCandidateScenario);
    const wentBack = controller.prev();
    expect(wentBack).toBe(false);
    expect(controller.roundIndex).toBe(0);
  });

  it("resolves immediately when the first round already has a majority", () => {
    const scenario: Scenario = {
      candidates: candidates(["a", "b"]),
      groups: [
        { ranking: ["a", "b"], count: 60 },
        { ranking: ["b", "a"], count: 40 },
      ],
    };
    const controller = createIrvController(scenario);
    expect(controller.isFinal).toBe(true);
    expect(controller.winner).toBe("a");
    expect(controller.next()).toBe(false);
  });
});
