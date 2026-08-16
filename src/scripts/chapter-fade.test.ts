import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { initChapterFade } from "./chapter-fade";

// jsdom has no real IntersectionObserver, so most tests use a fake one
// (mirroring ballot-drift.test.ts) to fire scroll-checkpoint crossings on
// demand; the no-IntersectionObserver case exercises graceful degradation.

function setUp(markup: string) {
  const dom = new JSDOM(`<!doctype html><html><body>${markup}</body></html>`);
  const { window } = dom;
  const root = window.document.querySelector("#prose")!;
  return { window, root };
}

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

describe("initChapterFade", () => {
  it("does nothing when there's no .scroll-step in the root", () => {
    const { root } = setUp(`<div id="prose"><p>plain</p></div>`);
    expect(() => initChapterFade(root)).not.toThrow();
  });

  it("reveals every step immediately when IntersectionObserver is unavailable", () => {
    // jsdom has no real IntersectionObserver at all, so simply not
    // installing a fake one exercises the graceful-degradation path.
    const { root } = setUp(
      `<div id="prose"><p class="scroll-step">only step</p></div>`,
    );

    initChapterFade(root);

    expect(root.querySelector(".scroll-step")!.classList.contains(
      "is-revealed",
    )).toBe(true);
  });

  it("adds is-revealed once the step intersects the centred band", () => {
    const { window, root } = setUp(
      `<div id="prose"><p class="scroll-step">only step</p></div>`,
    );
    const { FakeObserver, instances } = fakeIntersectionObserver();
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    initChapterFade(root);
    const step = root.querySelector(".scroll-step")!;
    expect(step.classList.contains("is-revealed")).toBe(false);

    instances[0].trigger(step, true);
    expect(step.classList.contains("is-revealed")).toBe(true);
  });

  it("removes is-revealed once the step scrolls back out of the band", () => {
    const { window, root } = setUp(
      `<div id="prose"><p class="scroll-step">only step</p></div>`,
    );
    const { FakeObserver, instances } = fakeIntersectionObserver();
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    initChapterFade(root);
    const step = root.querySelector(".scroll-step")!;

    instances[0].trigger(step, true);
    instances[0].trigger(step, false);
    expect(step.classList.contains("is-revealed")).toBe(false);
  });
});
