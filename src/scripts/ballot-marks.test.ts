import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { initBallotMarks } from "./ballot-marks";

// ballot-marks.ts strokes each full ballot's tick/preference-number marks in
// by hand the first time the ballot scrolls into a centred view. jsdom has
// neither IntersectionObserver, Element.animate, nor SVGPathElement's
// getTotalLength, so every test here stubs exactly the API each scenario
// needs -- same "mock the DOM API jsdom doesn't have" convention already
// used in ballot-drift.test.ts/irv-drift.test.ts.

const NUMBER_BOX = (rank: number, pathD = "M0,0") =>
  `<span class="ballot-paper-number-box" data-pref-rank="${rank}">` +
  `<svg class="ballot-paper-mark ballot-paper-number-mark"><path d="${pathD}" /></svg>` +
  `</span>`;

const CHECKBOX = (checked: boolean) =>
  `<span class="ballot-paper-checkbox${checked ? " ballot-paper-checkbox-checked" : ""}">` +
  (checked
    ? `<svg class="ballot-paper-mark ballot-paper-check-mark"><path d="M0,0" /></svg>`
    : "") +
  `</span>`;

// Deliberately prints the number boxes out of rank order (2, then 1, then
// 3) -- a real ballot's printed candidate order has no relationship to any
// one voter's ranking, so the DOM order here must not match rank order,
// or a bug that draws in DOM order rather than data-pref-rank order would
// go unnoticed.
function irvBallotMarkup(): string {
  return (
    `<div class="ballot-paper ballot-paper-full">` +
    `<ul class="ballot-paper-ranking">` +
    `<li>${NUMBER_BOX(2)}</li>` +
    `<li>${NUMBER_BOX(1)}</li>` +
    `<li>${NUMBER_BOX(3)}</li>` +
    `</ul></div>`
  );
}

function fptpBallotMarkup(checkedIndex: number): string {
  const boxes = [0, 1, 2]
    .map((i) => `<li>${CHECKBOX(i === checkedIndex)}</li>`)
    .join("");
  return (
    `<div class="ballot-paper ballot-paper-full">` +
    `<ul class="ballot-paper-ranking">${boxes}</ul></div>`
  );
}

function setUp(markup: string, reducedMotion = false) {
  const dom = new JSDOM(`<!doctype html><html><body>${markup}</body></html>`, {
    url: "http://localhost/",
  });
  const { window } = dom;
  window.matchMedia = vi.fn().mockReturnValue({ matches: reducedMotion });
  // jsdom renders <path> as a plain SVGElement -- SVGPathElement isn't
  // implemented at all -- so the stub has to live on the shared prototype
  // (cast past the type, which (correctly) doesn't declare this method on
  // the base SVGElement).
  (window.SVGElement.prototype as unknown as SVGPathElement).getTotalLength =
    () => 20;
  const animateSpy = vi
    .fn()
    .mockReturnValue({ finished: Promise.resolve(), cancel: vi.fn() });
  window.Element.prototype.animate = animateSpy;
  const root = window.document.body;
  return { window, root, animateSpy };
}

// Same fake-observer harness as ballot-drift.test.ts: the constructor
// captures its callback/observed element so a test can fire it on demand to
// simulate a scroll checkpoint crossing.
function fakeIntersectionObserver() {
  const instances: FakeObserver[] = [];

  class FakeObserver {
    private readonly callback: IntersectionObserverCallback;
    observed: Element[] = [];
    disconnected = false;

    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
      instances.push(this);
    }

    observe(el: Element): void {
      this.observed.push(el);
    }

    unobserve(): void {}
    disconnect(): void {
      this.disconnected = true;
    }

    trigger(el: Element, isIntersecting: boolean): void {
      // A real disconnect() stops the browser from ever invoking the
      // callback again -- match that so a test can prove one-shot
      // behaviour by re-triggering and observing nothing happens.
      if (this.disconnected) return;
      this.callback(
        [{ target: el, isIntersecting } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
    }
  }

  return { FakeObserver, instances };
}

function observerFor(instances: { observed: Element[] }[], el: Element) {
  const found = instances.find((observer) => observer.observed.includes(el));
  if (!found) throw new Error("no observer was registered for that element");
  return found as InstanceType<ReturnType<typeof fakeIntersectionObserver>["FakeObserver"]>;
}

describe("initBallotMarks", () => {
  it("does nothing until the ballot scrolls into a centred view", () => {
    const { FakeObserver, instances } = fakeIntersectionObserver();
    const { window, root, animateSpy } = setUp(irvBallotMarkup());
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    initBallotMarks(root);
    expect(animateSpy).not.toHaveBeenCalled();

    const ballot = root.querySelector(".ballot-paper-full")!;
    observerFor(instances, ballot).trigger(ballot, true);
    expect(animateSpy).toHaveBeenCalled();
  });

  it("disconnects its observer after drawing once, so it never redraws on a later scroll", () => {
    const { FakeObserver, instances } = fakeIntersectionObserver();
    const { window, root, animateSpy } = setUp(irvBallotMarkup());
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    initBallotMarks(root);
    const ballot = root.querySelector(".ballot-paper-full")!;
    const observer = observerFor(instances, ballot);
    observer.trigger(ballot, true);
    const callsAfterFirstDraw = animateSpy.mock.calls.length;

    expect(observer.disconnected).toBe(true);
    observer.trigger(ballot, true);
    expect(animateSpy.mock.calls.length).toBe(callsAfterFirstDraw);
  });

  it("draws preference numbers in ascending rank order, not DOM order, with distinct staggered delays", () => {
    const { FakeObserver, instances } = fakeIntersectionObserver();
    const { window, root, animateSpy } = setUp(irvBallotMarkup());
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    initBallotMarks(root);
    const ballot = root.querySelector(".ballot-paper-full")!;
    observerFor(instances, ballot).trigger(ballot, true);

    const delays = animateSpy.mock.calls.map(
      (call) => (call[1] as { delay: number }).delay,
    );
    expect(delays).toEqual([...delays].sort((a, b) => a - b));
    expect(new Set(delays).size).toBe(delays.length);

    // The DOM's first number box is rank 2, so if draw order followed DOM
    // order rather than data-pref-rank, the first call would carry a
    // non-zero delay instead of 0.
    expect(delays[0]).toBe(0);
  });

  it("draws the checked box's tick mark", () => {
    const { FakeObserver, instances } = fakeIntersectionObserver();
    const { window, root, animateSpy } = setUp(fptpBallotMarkup(1));
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    initBallotMarks(root);
    const ballot = root.querySelector(".ballot-paper-full")!;
    observerFor(instances, ballot).trigger(ballot, true);

    expect(animateSpy).toHaveBeenCalledTimes(1);
  });

  it("does nothing for an unticked FPTP ballot beyond the (absent) tick", () => {
    const { FakeObserver, instances } = fakeIntersectionObserver();
    // checkedIndex out of range -- no box is checked, so no check-mark path
    // exists at all.
    const { window, root, animateSpy } = setUp(fptpBallotMarkup(-1));
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    initBallotMarks(root);
    const ballot = root.querySelector(".ballot-paper-full")!;
    observerFor(instances, ballot).trigger(ballot, true);

    expect(animateSpy).not.toHaveBeenCalled();
  });

  it("skips animating and leaves CSS's fully-drawn default alone under reduced motion", () => {
    const { window, root, animateSpy } = setUp(irvBallotMarkup(), true);
    initBallotMarks(root);

    expect(animateSpy).not.toHaveBeenCalled();
    const path = root.querySelector<SVGPathElement>(
      ".ballot-paper-number-mark path",
    )!;
    expect(path.style.strokeDasharray).toBe("");
    void window;
  });

  it("draws immediately, without waiting for a scroll checkpoint, when IntersectionObserver isn't available", () => {
    const { root, animateSpy } = setUp(irvBallotMarkup());
    initBallotMarks(root);
    expect(animateSpy).toHaveBeenCalled();
  });

  it("draws every full ballot on the page independently", () => {
    const { FakeObserver, instances } = fakeIntersectionObserver();
    const { window, root, animateSpy } = setUp(
      irvBallotMarkup() + fptpBallotMarkup(0),
    );
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    initBallotMarks(root);
    const ballots = root.querySelectorAll(".ballot-paper-full");
    expect(ballots.length).toBe(2);

    observerFor(instances, ballots[0]!).trigger(ballots[0]!, true);
    const callsAfterFirst = animateSpy.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    observerFor(instances, ballots[1]!).trigger(ballots[1]!, true);
    expect(animateSpy.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });

  it("does nothing when there are no full ballots on the page", () => {
    const { root } = setUp("<p>no ballots here</p>");
    expect(() => initBallotMarks(root)).not.toThrow();
  });
});
