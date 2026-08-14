import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { initIrvDrift } from "./irv-drift";
import type { Scenario } from "../lib/types";

// The IRV recount section has its own transfer animation: when "Next round"
// eliminates a candidate, a small sample of mini-ballot chips fly from the
// eliminated candidate's stack to whichever stacks received their votes,
// using tally-irv's per-round `transfers` data. This owns its own
// irv-controller instance (mirroring initApp/initBallotDrift already being
// independent siblings over the same root+scenario) so it stays in lockstep
// with irv-app.ts's controller without either depending on the other.

function candidates(ids: string[]) {
  return ids.map((id) => ({
    id,
    label: id.toUpperCase(),
    colour: "#000",
    shape: "circle" as const,
  }));
}

function threeCandidateScenario(): Scenario {
  return {
    candidates: candidates(["a", "b", "c"]),
    groups: [
      { ranking: ["a", "b", "c"], count: 40 },
      { ranking: ["b", "a", "c"], count: 35 },
      { ranking: ["c", "a", "b"], count: 25 },
    ],
  };
}

function immediateMajorityScenario(): Scenario {
  return {
    candidates: candidates(["a", "b"]),
    groups: [
      { ranking: ["a", "b"], count: 60 },
      { ranking: ["b", "a"], count: 40 },
    ],
  };
}

function markup(ids: string[]): string {
  const stacks = ids.map((id) => `<div data-candidate="${id}"></div>`).join("");
  return `<section>${stacks}<div data-ballot-drift></div><button data-action="prev-round">Prev</button><button data-action="next-round">Next</button></section>`;
}

function setUp(ids: string[], reducedMotion: boolean) {
  const dom = new JSDOM(
    `<!doctype html><html><body>${markup(ids)}</body></html>`,
  );
  const { window } = dom;
  window.matchMedia = vi.fn().mockReturnValue({ matches: reducedMotion });
  const animateSpy = vi.fn();
  window.HTMLElement.prototype.animate = animateSpy;
  const root = window.document.querySelector("section")!;
  return { root, animateSpy };
}

function clickNext(root: ParentNode) {
  root
    .querySelector<HTMLButtonElement>('button[data-action="next-round"]')!
    .click();
}

function clickPrev(root: ParentNode) {
  root
    .querySelector<HTMLButtonElement>('button[data-action="prev-round"]')!
    .click();
}

describe("initIrvDrift", () => {
  it("spawns chips flying from the eliminated candidate's stack on an eliminating next()", () => {
    const { root, animateSpy } = setUp(["a", "b", "c"], false);
    initIrvDrift(root, threeCandidateScenario());

    clickNext(root);

    const chips = root.querySelectorAll('[data-transfer-chip-for="a"]');
    expect(chips.length).toBeGreaterThan(0);
    expect(animateSpy).toHaveBeenCalled();
  });

  it("spawns nothing on prev()", () => {
    const { root } = setUp(["a", "b", "c"], false);
    initIrvDrift(root, threeCandidateScenario());

    clickPrev(root);

    expect(root.querySelectorAll("[data-transfer-chip-for]").length).toBe(0);
  });

  it("spawns nothing when next() can't advance because the result is already final", () => {
    const { root } = setUp(["a", "b"], false);
    initIrvDrift(root, immediateMajorityScenario());

    clickNext(root);

    expect(root.querySelectorAll("[data-transfer-chip-for]").length).toBe(0);
  });

  it("suppresses chip spawning entirely under reduced motion", () => {
    const { root, animateSpy } = setUp(["a", "b", "c"], true);
    initIrvDrift(root, threeCandidateScenario());

    clickNext(root);

    expect(root.querySelectorAll("[data-transfer-chip-for]").length).toBe(0);
    expect(animateSpy).not.toHaveBeenCalled();
  });

  it("does nothing when there's no ballot-drift container or next button", () => {
    const dom = new JSDOM(
      `<!doctype html><html><body><section></section></body></html>`,
    );
    const root = dom.window.document.querySelector("section")!;
    expect(() => initIrvDrift(root, threeCandidateScenario())).not.toThrow();
  });
});
