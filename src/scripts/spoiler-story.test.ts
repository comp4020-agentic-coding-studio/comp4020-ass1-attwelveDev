import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { initSpoilerStory } from "./spoiler-story";

// initSpoilerStory syncs the spoiler section's scroll-revealed text with a
// spotlight/dim state on the viz's candidate stacks. jsdom has no real
// IntersectionObserver, so most of these tests use a fake one (mirroring the
// pattern in ballot-drift.test.ts) to fire scroll-checkpoint crossings on
// demand; the no-IntersectionObserver case exercises the graceful
// degradation path directly.

function setUp() {
  const markup =
    `<section><div id="prose">` +
    `<p class="scroll-step" data-spotlight="a,b">step one</p>` +
    `<p class="scroll-step" data-spotlight="c">step two</p>` +
    `<p class="scroll-step" data-spotlight="">step three</p>` +
    `</div>` +
    `<div id="viz">` +
    `<div data-candidate="a"><input type="range" class="candidate-stack-slider" /></div>` +
    `<div data-candidate="b"><input type="range" class="candidate-stack-slider" /></div>` +
    `<div data-candidate="c"><input type="range" class="candidate-stack-slider" /></div>` +
    `</div></section>`;
  const dom = new JSDOM(`<!doctype html><html><body>${markup}</body></html>`);
  const { window } = dom;
  const proseRoot = window.document.querySelector("#prose")!;
  const vizRoot = window.document.querySelector("#viz")!;
  const steps = [...window.document.querySelectorAll(".scroll-step")];
  return { window, proseRoot, vizRoot, steps };
}

// Mirrors ballot-drift.test.ts's fakeIntersectionObserver(): captures the
// callback so a test can fire { target, isIntersecting } entries on demand.
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
    .querySelector(`[data-candidate="${id}"]`)!
    .classList.contains("is-dimmed");
}

function slidersLocked(vizRoot: ParentNode): boolean {
  return [
    ...vizRoot.querySelectorAll<HTMLInputElement>(".candidate-stack-slider"),
  ].every((slider) => slider.disabled);
}

describe("initSpoilerStory", () => {
  it("locks every slider before the reader reaches the closing step", () => {
    const { window, proseRoot, vizRoot } = setUp();
    const { FakeObserver } = fakeIntersectionObserver();
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    initSpoilerStory(proseRoot, vizRoot);

    expect(slidersLocked(vizRoot)).toBe(true);
  });

  it("unlocks the sliders only on the closing, empty-data-spotlight step", () => {
    const { window, proseRoot, vizRoot, steps } = setUp();
    const { FakeObserver, instances } = fakeIntersectionObserver();
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    initSpoilerStory(proseRoot, vizRoot);
    const observer = instances[0];

    observer.trigger(steps[0], true);
    expect(slidersLocked(vizRoot)).toBe(true);

    observer.trigger(steps[0], false);
    observer.trigger(steps[2], true);
    expect(slidersLocked(vizRoot)).toBe(false);
  });

  it("re-locks the sliders when scrolling away from the closing step", () => {
    const { window, proseRoot, vizRoot, steps } = setUp();
    const { FakeObserver, instances } = fakeIntersectionObserver();
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    initSpoilerStory(proseRoot, vizRoot);
    const observer = instances[0];

    observer.trigger(steps[2], true);
    expect(slidersLocked(vizRoot)).toBe(false);

    observer.trigger(steps[2], false);
    expect(slidersLocked(vizRoot)).toBe(true);
  });

  it("unlocks the sliders when IntersectionObserver is unavailable, matching the shown final state", () => {
    const { proseRoot, vizRoot } = setUp();

    initSpoilerStory(proseRoot, vizRoot);

    expect(slidersLocked(vizRoot)).toBe(false);
  });

  it("reveals a step and dims every candidate not named in its data-spotlight", () => {
    const { window, proseRoot, vizRoot, steps } = setUp();
    const { FakeObserver, instances } = fakeIntersectionObserver();
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    initSpoilerStory(proseRoot, vizRoot);
    const observer = instances[0];

    observer.trigger(steps[0], true);

    expect(steps[0].classList.contains("is-revealed")).toBe(true);
    expect(isDimmed(vizRoot, "a")).toBe(false);
    expect(isDimmed(vizRoot, "b")).toBe(false);
    expect(isDimmed(vizRoot, "c")).toBe(true);
  });

  it("reverses cleanly when the step scrolls back out of the band, in either direction", () => {
    const { window, proseRoot, vizRoot, steps } = setUp();
    const { FakeObserver, instances } = fakeIntersectionObserver();
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    initSpoilerStory(proseRoot, vizRoot);
    const observer = instances[0];

    observer.trigger(steps[1], true);
    expect(isDimmed(vizRoot, "a")).toBe(true);
    expect(isDimmed(vizRoot, "c")).toBe(false);

    observer.trigger(steps[1], false);
    expect(steps[1].classList.contains("is-revealed")).toBe(false);
    expect(isDimmed(vizRoot, "a")).toBe(false);
    expect(isDimmed(vizRoot, "c")).toBe(false);
  });

  it("clears every dim on the empty-data-spotlight closing step", () => {
    const { window, proseRoot, vizRoot, steps } = setUp();
    const { FakeObserver, instances } = fakeIntersectionObserver();
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    initSpoilerStory(proseRoot, vizRoot);
    const observer = instances[0];

    observer.trigger(steps[0], true);
    expect(isDimmed(vizRoot, "c")).toBe(true);

    observer.trigger(steps[0], false);
    observer.trigger(steps[2], true);
    expect(steps[2].classList.contains("is-revealed")).toBe(true);
    expect(isDimmed(vizRoot, "a")).toBe(false);
    expect(isDimmed(vizRoot, "b")).toBe(false);
    expect(isDimmed(vizRoot, "c")).toBe(false);
  });

  it("reveals every step immediately and applies no dimming when IntersectionObserver is unavailable", () => {
    // jsdom has no real IntersectionObserver at all, so simply not installing
    // the fake one here exercises the graceful-degradation path directly.
    const { proseRoot, vizRoot, steps } = setUp();

    initSpoilerStory(proseRoot, vizRoot);

    for (const step of steps) {
      expect(step.classList.contains("is-revealed")).toBe(true);
    }
    expect(isDimmed(vizRoot, "a")).toBe(false);
    expect(isDimmed(vizRoot, "b")).toBe(false);
    expect(isDimmed(vizRoot, "c")).toBe(false);
  });

  it("tolerates a root with no .scroll-step elements", () => {
    const dom = new JSDOM(
      `<!doctype html><html><body><div id="prose"></div><div id="viz"></div></body></html>`,
    );
    const proseRoot = dom.window.document.querySelector("#prose")!;
    const vizRoot = dom.window.document.querySelector("#viz")!;
    expect(() => initSpoilerStory(proseRoot, vizRoot)).not.toThrow();
  });
});
