import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { initStrategicStory } from "./strategic-story";

// initStrategicStory syncs the strategic-voting section's scroll-revealed
// text with a spotlight/dim state on its sincere/tactical ballot pair (same
// reversible centred-band idiom as spoiler-story.test.ts), plus a one-shot
// extra: the first time a ballot is spotlighted, its tick mark draws in by
// hand (same mechanism as ballot-marks.test.ts). jsdom has neither
// IntersectionObserver, Element.animate, nor SVGPathElement's
// getTotalLength, so setUp() stubs each on demand.

function tickMarkup(ballotId: string): string {
  return (
    `<div data-ballot="${ballotId}">` +
    `<svg class="ballot-paper-mark ballot-paper-check-mark">` +
    `<path d="M0,0" /></svg></div>`
  );
}

function setUp(reducedMotion = false) {
  const markup =
    `<div id="prose">` +
    `<p class="scroll-step" data-spotlight="sincere">step one</p>` +
    `<p class="scroll-step" data-spotlight="tactical">step two</p>` +
    `</div>` +
    `<div id="viz">${tickMarkup("sincere")}${tickMarkup("tactical")}</div>`;
  const dom = new JSDOM(`<!doctype html><html><body>${markup}</body></html>`, {
    url: "http://localhost/",
  });
  const { window } = dom;
  window.matchMedia = vi.fn().mockReturnValue({ matches: reducedMotion });
  (window.SVGElement.prototype as unknown as SVGPathElement).getTotalLength =
    () => 20;
  const animateSpy = vi
    .fn()
    .mockReturnValue({ finished: Promise.resolve(), cancel: vi.fn() });
  window.Element.prototype.animate = animateSpy;

  const proseRoot = window.document.querySelector("#prose")!;
  const vizRoot = window.document.querySelector("#viz")!;
  const steps = [...window.document.querySelectorAll(".scroll-step")];
  return { window, proseRoot, vizRoot, steps, animateSpy };
}

// Mirrors spoiler-story.test.ts/ballot-marks.test.ts's fake observer.
function fakeIntersectionObserver() {
  const instances: FakeObserver[] = [];

  class FakeObserver {
    private readonly callback: IntersectionObserverCallback;
    observed: Element[] = [];

    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
      instances.push(this);
    }

    observe(el: Element): void {
      this.observed.push(el);
    }

    unobserve(): void {}
    disconnect(): void {}

    trigger(el: Element, isIntersecting: boolean): void {
      this.callback(
        [{ target: el, isIntersecting } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
    }
  }

  return { FakeObserver, instances };
}

function isDimmed(vizRoot: ParentNode, id: string): boolean {
  return vizRoot
    .querySelector(`[data-ballot="${id}"]`)!
    .classList.contains("is-dimmed");
}

function dashOffsetOf(vizRoot: ParentNode, id: string): string {
  return (
    vizRoot.querySelector<SVGPathElement>(
      `[data-ballot="${id}"] .ballot-paper-mark path`,
    )!.style.strokeDashoffset
  );
}

describe("initStrategicStory", () => {
  it("reveals a step and dims the ballot not named in its data-spotlight", () => {
    const { window, proseRoot, vizRoot, steps } = setUp();
    const { FakeObserver, instances } = fakeIntersectionObserver();
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    initStrategicStory(proseRoot, vizRoot);
    const observer = instances[0];

    observer.trigger(steps[0], true);

    expect(steps[0].classList.contains("is-revealed")).toBe(true);
    expect(isDimmed(vizRoot, "sincere")).toBe(false);
    expect(isDimmed(vizRoot, "tactical")).toBe(true);
  });

  it("switches which ballot is dimmed when the next step takes over", () => {
    const { window, proseRoot, vizRoot, steps } = setUp();
    const { FakeObserver, instances } = fakeIntersectionObserver();
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    initStrategicStory(proseRoot, vizRoot);
    const observer = instances[0];

    observer.trigger(steps[0], true);
    observer.trigger(steps[0], false);
    observer.trigger(steps[1], true);

    expect(isDimmed(vizRoot, "sincere")).toBe(true);
    expect(isDimmed(vizRoot, "tactical")).toBe(false);
  });

  it("reverses the dimming cleanly when scrolling away from a step", () => {
    const { window, proseRoot, vizRoot, steps } = setUp();
    const { FakeObserver, instances } = fakeIntersectionObserver();
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    initStrategicStory(proseRoot, vizRoot);
    const observer = instances[0];

    observer.trigger(steps[0], true);
    expect(isDimmed(vizRoot, "tactical")).toBe(true);

    observer.trigger(steps[0], false);
    expect(steps[0].classList.contains("is-revealed")).toBe(false);
    expect(isDimmed(vizRoot, "sincere")).toBe(false);
    expect(isDimmed(vizRoot, "tactical")).toBe(false);
  });

  it("hides every ballot's tick mark up front, before any step is spotlighted", () => {
    const { window, vizRoot, proseRoot } = setUp();
    window.IntersectionObserver = fakeIntersectionObserver()
      .FakeObserver as unknown as typeof IntersectionObserver;

    initStrategicStory(proseRoot, vizRoot);

    expect(dashOffsetOf(vizRoot, "sincere")).toBe("20");
    expect(dashOffsetOf(vizRoot, "tactical")).toBe("20");
  });

  it("draws a ballot's tick mark in the first time it gets spotlighted", () => {
    const { window, proseRoot, vizRoot, steps, animateSpy } = setUp();
    const { FakeObserver, instances } = fakeIntersectionObserver();
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    initStrategicStory(proseRoot, vizRoot);
    expect(animateSpy).not.toHaveBeenCalled();

    instances[0].trigger(steps[0], true);
    expect(animateSpy).toHaveBeenCalledTimes(1);
  });

  it("never redraws a ballot's mark on a later re-spotlight, even though dimming keeps reversing", () => {
    const { window, proseRoot, vizRoot, steps, animateSpy } = setUp();
    const { FakeObserver, instances } = fakeIntersectionObserver();
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    initStrategicStory(proseRoot, vizRoot);
    const observer = instances[0];

    observer.trigger(steps[0], true);
    expect(animateSpy).toHaveBeenCalledTimes(1);

    // Scroll away, then back onto the same step -- the dim/reveal state
    // toggles again, but the tick was already drawn once and must not
    // replay.
    observer.trigger(steps[0], false);
    observer.trigger(steps[0], true);
    expect(animateSpy).toHaveBeenCalledTimes(1);
  });

  it("reveals every step immediately, draws both ballots' marks, and applies no dimming when IntersectionObserver is unavailable", () => {
    const { proseRoot, vizRoot, steps, animateSpy } = setUp();

    initStrategicStory(proseRoot, vizRoot);

    for (const step of steps) {
      expect(step.classList.contains("is-revealed")).toBe(true);
    }
    expect(isDimmed(vizRoot, "sincere")).toBe(false);
    expect(isDimmed(vizRoot, "tactical")).toBe(false);
    expect(animateSpy).toHaveBeenCalledTimes(2);
  });

  it("skips hiding and drawing marks under reduced motion, leaving CSS's fully-drawn default alone", () => {
    const { window, proseRoot, vizRoot, steps, animateSpy } = setUp(true);
    const { FakeObserver, instances } = fakeIntersectionObserver();
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    initStrategicStory(proseRoot, vizRoot);
    instances[0].trigger(steps[0], true);

    expect(animateSpy).not.toHaveBeenCalled();
    expect(dashOffsetOf(vizRoot, "sincere")).toBe("");
    expect(dashOffsetOf(vizRoot, "tactical")).toBe("");
  });

  it("tolerates a root with no .scroll-step elements", () => {
    const dom = new JSDOM(
      `<!doctype html><html><body><div id="prose"></div><div id="viz"></div></body></html>`,
    );
    const proseRoot = dom.window.document.querySelector("#prose")!;
    const vizRoot = dom.window.document.querySelector("#viz")!;
    expect(() => initStrategicStory(proseRoot, vizRoot)).not.toThrow();
  });
});
