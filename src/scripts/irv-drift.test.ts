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
  const stacks = ids
    .map(
      (id) =>
        `<div data-candidate="${id}"><div data-fill-for="${id}"></div></div>`,
    )
    .join("");
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

function rect(top: number, left: number, width = 0, height = 0): DOMRect {
  return {
    top,
    left,
    right: left + width,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
    toJSON() {
      return this;
    },
  };
}

function cssColor(doc: Document, hex: string): string {
  const probe = doc.createElement("span");
  probe.style.backgroundColor = hex;
  return probe.style.backgroundColor;
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

  it("still spawns transfer chips under reduced motion, snapped instantly instead of animated", () => {
    const { root, animateSpy } = setUp(["a", "b", "c"], true);
    initIrvDrift(root, threeCandidateScenario());

    clickNext(root);

    const chips = root.querySelectorAll('[data-transfer-chip-for="a"]');
    expect(chips.length).toBeGreaterThan(0);
    expect(animateSpy).not.toHaveBeenCalled();

    const chip = chips[0] as HTMLElement;
    expect(chip.style.borderWidth).toBe("0px");
    expect(chip.style.borderRadius).toBe("0px");
    expect(chip.style.backgroundColor).toBe(cssColor(root.ownerDocument, "#000"));

    const mark = chip.querySelector<HTMLElement>(".ballot-paper-mini-mark")!;
    expect(mark.style.opacity).toBe("0");
  });

  it("lands transfer chips on the receiving candidate's colour fill, not the whole stack", () => {
    const dom = new JSDOM(
      `<!doctype html><html><body>${markup(["a", "b", "c"])}</body></html>`,
    );
    const { window } = dom;
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    // No `animate` on this prototype -> flyTo's fallback branch runs,
    // setting style.transform synchronously from the resolved rect, so the
    // landing target is observable without touching WAAPI at all.
    window.Element.prototype.getBoundingClientRect = function (
      this: Element,
    ) {
      if (this.hasAttribute("data-fill-for")) return rect(500, 500, 40, 192);
      if (this.hasAttribute("data-candidate")) return rect(100, 100);
      return rect(0, 0, 14, 19);
    };
    const root = window.document.querySelector("section")!;

    initIrvDrift(root, threeCandidateScenario());
    clickNext(root);

    const chip = root.querySelector<HTMLElement>(
      '[data-transfer-chip-for="a"]',
    )!;
    expect(chip.style.transform).toBe("translate(500px, 500px)");
  });

  it("flattens a landed transfer chip into a colour-matched line the width of the fill, no border or white box left behind", () => {
    const dom = new JSDOM(
      `<!doctype html><html><body>${markup(["a", "b", "c"])}</body></html>`,
    );
    const { window } = dom;
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.Element.prototype.getBoundingClientRect = function (
      this: Element,
    ) {
      if (this.hasAttribute("data-fill-for")) return rect(500, 500, 40, 192);
      if (this.hasAttribute("data-candidate")) return rect(100, 100);
      return rect(0, 0, 14, 19);
    };
    const root = window.document.querySelector("section")!;

    initIrvDrift(root, threeCandidateScenario());
    clickNext(root);

    const chip = root.querySelector<HTMLElement>(
      '[data-transfer-chip-for="a"]',
    )!;
    expect(chip.style.width).toBe("40px");
    expect(chip.style.height).toBe("3px");
    expect(chip.style.borderWidth).toBe("0px");
    expect(chip.style.borderRadius).toBe("0px");
    expect(chip.style.backgroundColor).toBe(cssColor(window.document, "#000"));

    const mark = chip.querySelector<HTMLElement>(".ballot-paper-mini-mark")!;
    expect(mark.style.opacity).toBe("0");
  });

  it("does nothing when there's no ballot-drift container or next button", () => {
    const dom = new JSDOM(
      `<!doctype html><html><body><section></section></body></html>`,
    );
    const root = dom.window.document.querySelector("section")!;
    expect(() => initIrvDrift(root, threeCandidateScenario())).not.toThrow();
  });
});
