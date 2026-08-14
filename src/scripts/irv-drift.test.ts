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

// d is weakest and eliminated round 1. Its 100 ballots split 99/1 between a
// and b — a real, nonzero transfer to b, but small enough a share that a
// plain largest-remainder split over a small chip budget rounds it to 0.
function skewedTransferScenario(): Scenario {
  return {
    candidates: candidates(["a", "b", "d"]),
    groups: [
      { ranking: ["d", "a"], count: 99 },
      { ranking: ["d", "b"], count: 1 },
      { ranking: ["a"], count: 200 },
      { ranking: ["b"], count: 200 },
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

  it("gives at least one chip to every candidate with a real, nonzero transfer, even a very small share", () => {
    const { root, animateSpy } = setUp(["a", "b", "d"], false);
    initIrvDrift(root, skewedTransferScenario());

    clickNext(root);

    expect(animateSpy).toHaveBeenCalled();
    expect(
      root.querySelectorAll('[data-transfer-chip-for="b"]').length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      root.querySelectorAll('[data-transfer-chip-for="a"]').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("staggers a receiving candidate's chip departures instead of launching them all at once, so the transfer reads as a gradual stream rather than one simultaneous jump", () => {
    const { root, animateSpy } = setUp(["a", "b", "c"], false);
    initIrvDrift(root, threeCandidateScenario());

    clickNext(root);

    // c is eliminated and all of its votes transfer to a alone, so every
    // sampled chip flies to "a" -- a good-sized single-receiver batch to
    // check the stagger on.
    const flightCalls = animateSpy.mock.calls.filter((call) =>
      "transform" in (call[0] as Array<Record<string, unknown>>)[0],
    );
    expect(flightCalls.length).toBeGreaterThan(1);

    const delays = flightCalls.map(
      (call) => (call[1] as { delay?: number }).delay ?? 0,
    );
    const uniqueDelays = new Set(delays);
    expect(uniqueDelays.size).toBeGreaterThan(1);

    // Every chip must still finish (delay + duration) within the same
    // window the receiving stack's own height transition uses, so nothing
    // visibly lands after the bar has already stopped growing.
    for (const call of flightCalls) {
      const options = call[1] as { delay?: number; duration: number };
      expect((options.delay ?? 0) + options.duration).toBeLessThanOrEqual(
        600,
      );
    }
  });

  it("captures the eliminated candidate's fill geometry before any other click listener can collapse it", () => {
    const dom = new JSDOM(
      `<!doctype html><html><body>${markup(["a", "b", "c"])}</body></html>`,
    );
    const { window } = dom;
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });

    let collapsed = false;
    window.Element.prototype.getBoundingClientRect = function (
      this: Element,
    ) {
      if (this.getAttribute("data-fill-for") === "c") {
        // Mirrors .candidate-stack-fill's real CSS (position: absolute;
        // bottom: 0; height: var(--fill-pct)): once irv-app.ts's render()
        // zeroes the eliminated candidate's --fill-pct, its box collapses
        // to a zero-height sliver pinned to the same bottom edge.
        return collapsed ? rect(392, 300, 40, 0) : rect(200, 300, 40, 192);
      }
      if (this.hasAttribute("data-fill-for")) return rect(500, 500, 40, 40);
      if (this.hasAttribute("data-candidate")) return rect(100, 100);
      return rect(0, 0, 14, 19);
    };

    const animateSpy = vi.fn();
    window.HTMLElement.prototype.animate = animateSpy;
    const root = window.document.querySelector("section")!;

    // Registered before initIrvDrift, mirroring bootstrap.ts calling
    // initIrvApp first: its click listener's render() call collapses the
    // eliminated candidate's fill height before initIrvDrift's own
    // bubble-phase listener would otherwise read it.
    root
      .querySelector<HTMLButtonElement>('button[data-action="next-round"]')!
      .addEventListener("click", () => {
        collapsed = true;
      });

    initIrvDrift(root, threeCandidateScenario());
    clickNext(root);

    // animateSpy also catches fadeOutMark's opacity-only animation on each
    // chip's mark span — find the chip-flight call specifically (its first
    // keyframe carries a transform, fadeOutMark's doesn't).
    const flightCall = animateSpy.mock.calls.find((call) =>
      "transform" in (call[0] as Array<Record<string, unknown>>)[0],
    );
    expect(flightCall).toBeDefined();
    const frames = flightCall![0] as Array<Record<string, unknown>>;
    expect(frames[0].transform).toBe("translate(300px, 200px)");
  });
});
