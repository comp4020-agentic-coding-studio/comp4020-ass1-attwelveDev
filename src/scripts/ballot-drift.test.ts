import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { initBallotDrift } from "./ballot-drift";
import type { Scenario } from "../lib/types";

// Ballot-drift animates a small sample of mini-ballot chips into each
// candidate's stack when the section scrolls into view, and (when a hero
// ballot illustration is present) fades that hero out while an extra chip
// flies from its position. The hero and the target stacks can live in two
// different chapters (an intro chapter's hero flying forward into the next
// chapter's stacks), so initBallotDrift takes heroRoot and targetRoot
// separately rather than one shared root. jsdom has neither
// IntersectionObserver nor Element.animate, so this exercises the
// graceful-degradation paths deliberately built for that: no
// IntersectionObserver -> animate immediately instead of waiting for a
// scroll checkpoint; no prefers-reduced-motion match -> use WAAPI;
// reduced-motion requested -> place everything at its final position
// without animating at all.

function scenario(): Scenario {
  return {
    candidates: [
      { id: "a", label: "A", colour: "#000", shape: "circle" },
      { id: "b", label: "B", colour: "#111", shape: "square" },
    ],
    groups: [
      { ranking: ["a", "b"], count: 75 },
      { ranking: ["b", "a"], count: 25 },
    ],
  };
}

function setUp(
  reducedMotion: boolean,
  opts: { hero?: boolean; separateHeroSection?: boolean } = {},
) {
  const heroMarkup = opts.hero
    ? `<div data-hero-ballot="a" class="ballot-paper ballot-paper-full">` +
      `<p class="ballot-paper-heading">Ballot paper</p>` +
      `<ol class="ballot-paper-ranking"><li>A</li><li>B</li></ol></div>`
    : "";
  const stacks =
    `<div data-candidate="a"><div data-fill-for="a"></div>` +
    `<input type="range" data-slider-for="a" /></div>` +
    `<div data-candidate="b"><div data-fill-for="b"></div>` +
    `<input type="range" data-slider-for="b" /></div>`;
  const markup = opts.separateHeroSection
    ? `<section>${heroMarkup}</section><section>${stacks}<div data-ballot-drift></div></section>`
    : `<section>${heroMarkup}${stacks}<div data-ballot-drift></div></section>`;
  const dom = new JSDOM(`<!doctype html><html><body>${markup}</body></html>`, {
    url: "http://localhost/",
  });
  const { window } = dom;
  window.matchMedia = vi.fn().mockReturnValue({ matches: reducedMotion });
  const animateSpy = vi
    .fn()
    .mockReturnValue({ finished: Promise.resolve(), cancel: vi.fn() });
  window.HTMLElement.prototype.animate = animateSpy;
  const sections = window.document.querySelectorAll("section");
  const heroRoot = sections[0];
  const targetRoot = opts.separateHeroSection ? sections[1] : sections[0];
  return {
    heroRoot,
    targetRoot,
    animateSpy,
    calledOn: animateSpy.mock.contexts,
    window,
  };
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

// Renders a colour the same way jsdom's CSSOM will serialise it back out of
// `el.style.backgroundColor`, so assertions don't have to hardcode jsdom's
// internal rgb() format.
function cssColor(doc: Document, hex: string): string {
  const probe = doc.createElement("span");
  probe.style.backgroundColor = hex;
  return probe.style.backgroundColor;
}

// jsdom has no real IntersectionObserver at all, so exercising the hero's
// bidirectional trigger (as opposed to the graceful-degradation "no
// IntersectionObserver -> place immediately" path already covered above)
// needs a fake one the test can fire on demand. The constructor captures its
// callback and observed element so a test can call .trigger(el, bool) to
// simulate a scroll checkpoint crossing.
function fakeIntersectionObserver() {
  const instances: FakeObserver[] = [];

  class FakeObserver {
    private readonly callback: IntersectionObserverCallback;
    observed: Element[] = [];
    options?: IntersectionObserverInit;

    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.callback = callback;
      this.options = options;
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

function observerFor(
  instances: {
    observed: Element[];
    trigger(el: Element, isIntersecting: boolean): void;
    options?: IntersectionObserverInit;
  }[],
  el: Element,
) {
  const found = instances.find((observer) => observer.observed.includes(el));
  if (!found) throw new Error("no observer was registered for that element");
  return found;
}

describe("initBallotDrift", () => {
  it("creates one mini-ballot chip per sampled ballot, proportioned to each candidate's votes", () => {
    const { heroRoot, targetRoot } = setUp(false);
    initBallotDrift(heroRoot, targetRoot, scenario());

    const chipsA = targetRoot.querySelectorAll('[data-mini-ballot-for="a"]');
    const chipsB = targetRoot.querySelectorAll('[data-mini-ballot-for="b"]');
    expect(chipsA.length + chipsB.length).toBe(24);
    expect(chipsA.length).toBeGreaterThan(chipsB.length);
  });

  it("animates chips into place with WAAPI when motion isn't reduced", () => {
    const { heroRoot, targetRoot, animateSpy } = setUp(false);
    initBallotDrift(heroRoot, targetRoot, scenario());
    expect(animateSpy).toHaveBeenCalled();
  });

  it("skips the animation and places chips directly when reduced motion is requested", () => {
    const { heroRoot, targetRoot, animateSpy } = setUp(true);
    initBallotDrift(heroRoot, targetRoot, scenario());

    expect(animateSpy).not.toHaveBeenCalled();
    const chip = targetRoot.querySelector<HTMLElement>(
      '[data-mini-ballot-for="a"]',
    )!;
    expect(chip.style.transform).toBe("translate(0px, 0px)");
  });

  it("lands chips on the candidate's colour fill, not the whole stack", () => {
    const { heroRoot, targetRoot, window } = setUp(true);
    window.Element.prototype.getBoundingClientRect = function (
      this: Element,
    ) {
      if (this.hasAttribute("data-fill-for")) return rect(500, 500, 40, 192);
      if (this.hasAttribute("data-candidate")) return rect(100, 100);
      return rect(0, 0, 14, 19);
    };

    initBallotDrift(heroRoot, targetRoot, scenario());

    const chip = targetRoot.querySelector<HTMLElement>(
      '[data-mini-ballot-for="a"]',
    )!;
    expect(chip.style.transform).toBe("translate(500px, 500px)");
  });

  it("flattens a landed chip into a colour-matched line the width of the fill, no border or white box left behind", () => {
    const { heroRoot, targetRoot, window } = setUp(true);
    window.Element.prototype.getBoundingClientRect = function (
      this: Element,
    ) {
      if (this.hasAttribute("data-fill-for")) return rect(500, 500, 40, 192);
      if (this.hasAttribute("data-candidate")) return rect(100, 100);
      return rect(0, 0, 14, 19);
    };

    initBallotDrift(heroRoot, targetRoot, scenario());

    const chip = targetRoot.querySelector<HTMLElement>(
      '[data-mini-ballot-for="a"]',
    )!;
    expect(chip.style.width).toBe("40px");
    expect(chip.style.height).toBe("3px");
    expect(chip.style.borderWidth).toBe("0px");
    expect(chip.style.borderRadius).toBe("0px");
    expect(chip.style.backgroundColor).toBe(cssColor(window.document, "#000"));

    const mark = chip.querySelector<HTMLElement>(".ballot-paper-mini-mark")!;
    expect(mark.style.opacity).toBe("0");
  });

  it("hero forward-flight chip is a clone of the real ballot, not a mini-ballot chip", () => {
    const { heroRoot, targetRoot } = setUp(true, { hero: true });
    initBallotDrift(heroRoot, targetRoot, scenario());

    const chip = targetRoot.querySelector<HTMLElement>(
      "[data-hero-ballot-chip]",
    )!;
    expect(chip.classList.contains("ballot-paper-full")).toBe(true);
    expect(chip.querySelector("ol.ballot-paper-ranking")).not.toBeNull();
    expect(chip.hasAttribute("data-hero-ballot")).toBe(false);
  });

  it("hero chip lands flattened into the candidate colour, sized to the fill, under reduced motion", async () => {
    const { heroRoot, targetRoot, window } = setUp(true, { hero: true });
    window.Element.prototype.getBoundingClientRect = function (
      this: Element,
    ) {
      if (this.hasAttribute("data-fill-for")) return rect(500, 500, 40, 192);
      return rect(0, 0, 150, 120);
    };

    initBallotDrift(heroRoot, targetRoot, scenario());

    const chip = targetRoot.querySelector<HTMLElement>(
      "[data-hero-ballot-chip]",
    )!;
    expect(chip.style.width).toBe("40px");
    expect(chip.style.height).toBe("3px");
    expect(chip.style.borderWidth).toBe("0px");
    expect(chip.style.backgroundColor).toBe(cssColor(window.document, "#000"));
    // The real ballot's padding would otherwise floor the landed height well
    // above a flattened strip, leaving its text visibly clipped on top of
    // the candidate colour instead of disappearing.
    expect(chip.style.paddingTop).toBe("0px");
    expect(chip.style.paddingRight).toBe("0px");
    expect(chip.style.paddingBottom).toBe("0px");
    expect(chip.style.paddingLeft).toBe("0px");

    // A landed hero clone is a hand-off illusion, not a permanent stand-in
    // for the (live) fill it's impersonating — it should disappear once
    // it's done its job, same as under full motion.
    await vi.waitFor(() => {
      expect(targetRoot.querySelector("[data-hero-ballot-chip]")).toBeNull();
    });
  });

  it("snaps the hero chip's shape and colour back to its natural size and white once it scrolls back into view", async () => {
    const { FakeObserver, instances } = fakeIntersectionObserver();
    const { heroRoot, targetRoot, window } = setUp(true, { hero: true });
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;
    window.Element.prototype.getBoundingClientRect = function (
      this: Element,
    ) {
      if (this.hasAttribute("data-fill-for")) return rect(500, 500, 40, 192);
      if (
        this.hasAttribute("data-hero-ballot") ||
        this.hasAttribute("data-hero-ballot-chip")
      ) {
        return rect(0, 0, 150, 120);
      }
      return rect(0, 0);
    };

    initBallotDrift(heroRoot, targetRoot, scenario());
    const hero = heroRoot.querySelector<HTMLElement>("[data-hero-ballot]")!;
    const heroObserver = observerFor(instances, hero);

    // The observer's very first report just reflects whatever the hero's
    // state happens to be at observe() time, not a real scroll transition —
    // it must be ignored, or every hero would flash on load.
    heroObserver.trigger(hero, true);

    heroObserver.trigger(hero, false);
    const chip = targetRoot.querySelector<HTMLElement>(
      "[data-hero-ballot-chip]",
    )!;
    expect(chip.style.width).toBe("40px");
    expect(chip.style.height).toBe("3px");
    expect(chip.style.paddingTop).toBe("0px");
    expect(chip.style.paddingLeft).toBe("0px");

    heroObserver.trigger(hero, true);
    expect(chip.style.width).toBe("150px");
    expect(chip.style.height).toBe("120px");
    expect(chip.style.backgroundColor).toBe(cssColor(window.document, "#fff"));
    expect(chip.style.borderWidth).toBe("1px");
    expect(chip.style.paddingTop).toBe("0.75rem");
    expect(chip.style.paddingLeft).toBe("1rem");

    await vi.waitFor(() => {
      expect(targetRoot.querySelector("[data-hero-ballot-chip]")).toBeNull();
    });
  });

  it("does nothing when there's no ballot-drift container in the target root", () => {
    const dom = new JSDOM(
      `<!doctype html><html><body><section></section></body></html>`,
    );
    const root = dom.window.document.querySelector("section")!;
    expect(() => initBallotDrift(root, root, scenario())).not.toThrow();
  });

  it("fades the hero ballot out in place when one is present", () => {
    const { heroRoot, targetRoot, calledOn } = setUp(false, { hero: true });
    initBallotDrift(heroRoot, targetRoot, scenario());

    const hero = heroRoot.querySelector('[data-hero-ballot]')!;
    expect(calledOn.includes(hero)).toBe(true);
  });

  it("hides the hero ballot instantly, without animating it, under reduced motion", () => {
    const { heroRoot, targetRoot, animateSpy } = setUp(true, { hero: true });
    initBallotDrift(heroRoot, targetRoot, scenario());

    expect(animateSpy).not.toHaveBeenCalled();
    const hero = heroRoot.querySelector<HTMLElement>('[data-hero-ballot]')!;
    expect(hero.style.opacity).toBe("0");
  });

  it("tolerates there being no hero ballot to fade", () => {
    const { heroRoot, targetRoot } = setUp(false);
    expect(() => initBallotDrift(heroRoot, targetRoot, scenario())).not.toThrow();
  });

  it("fades and flies the hero ballot even when it lives in a separate section from the stacks", () => {
    const { heroRoot, targetRoot, calledOn } = setUp(false, {
      hero: true,
      separateHeroSection: true,
    });
    initBallotDrift(heroRoot, targetRoot, scenario());

    const hero = heroRoot.querySelector('[data-hero-ballot]')!;
    expect(calledOn.includes(hero)).toBe(true);
    const chipsA = targetRoot.querySelectorAll('[data-mini-ballot-for="a"]');
    expect(chipsA.length).toBeGreaterThan(0);
  });

  it("places swarm chips without touching any hero when heroRoot is null", () => {
    const { targetRoot, animateSpy } = setUp(false, {
      hero: true,
      separateHeroSection: true,
    });
    expect(() => initBallotDrift(null, targetRoot, scenario())).not.toThrow();

    const chipsA = targetRoot.querySelectorAll('[data-mini-ballot-for="a"]');
    const chipsB = targetRoot.querySelectorAll('[data-mini-ballot-for="b"]');
    expect(chipsA.length + chipsB.length).toBe(24);
    expect(animateSpy.mock.calls.length).toBeGreaterThan(0);
    expect(
      animateSpy.mock.contexts.some((el) =>
        (el as HTMLElement).hasAttribute("data-hero-ballot"),
      ),
    ).toBe(false);
  });

  it("flies a chip forward and fades the hero out when it scrolls out of view", () => {
    const { FakeObserver, instances } = fakeIntersectionObserver();
    const { heroRoot, targetRoot, window, calledOn } = setUp(false, {
      hero: true,
    });
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    initBallotDrift(heroRoot, targetRoot, scenario());
    const hero = heroRoot.querySelector<HTMLElement>("[data-hero-ballot]")!;
    const heroObserver = observerFor(instances, hero);
    heroObserver.trigger(hero, true);
    heroObserver.trigger(hero, false);

    expect(calledOn.includes(hero)).toBe(true);
    expect(
      targetRoot.querySelector("[data-hero-ballot-chip]"),
    ).not.toBeNull();
  });

  it("keeps the hero hidden until its return flight actually lands, so the two are never both visible", async () => {
    const { FakeObserver, instances } = fakeIntersectionObserver();
    const { heroRoot, targetRoot, window, animateSpy } = setUp(false, {
      hero: true,
    });
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    initBallotDrift(heroRoot, targetRoot, scenario());
    const hero = heroRoot.querySelector<HTMLElement>("[data-hero-ballot]")!;
    const heroObserver = observerFor(instances, hero);
    heroObserver.trigger(hero, true);
    heroObserver.trigger(hero, false);
    heroObserver.trigger(hero, true);

    function heroFadeCalls(): number {
      return animateSpy.mock.contexts.filter((el) => el === hero).length;
    }

    // The clone is still mid-flight back toward the hero's position here --
    // revealing the real hero already would show both on screen at once.
    expect(heroFadeCalls()).toBe(1);

    // Once the clone lands it's removed and the two are visually
    // coincident, so the hero should reappear as an instant cut -- no
    // second .animate() call on the hero, just the style flipping straight
    // to visible.
    await vi.waitFor(() => {
      expect(targetRoot.querySelector("[data-hero-ballot-chip]")).toBeNull();
    });
    expect(hero.style.opacity).toBe("1");
    expect(heroFadeCalls()).toBe(1);
  });

  it("does not fly the hero back until the target section it flew into has actually been visited", () => {
    const { FakeObserver, instances } = fakeIntersectionObserver();
    const { heroRoot, targetRoot, window, animateSpy } = setUp(false, {
      hero: true,
      separateHeroSection: true,
    });
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    initBallotDrift(heroRoot, targetRoot, scenario());
    const hero = heroRoot.querySelector<HTMLElement>("[data-hero-ballot]")!;
    const heroObserver = observerFor(instances, hero);

    heroObserver.trigger(hero, true);
    heroObserver.trigger(hero, false);
    expect(targetRoot.querySelector("[data-hero-ballot-chip]")).not.toBeNull();

    // Scrolling back up to the hero's own (intro) chapter regaining
    // visibility isn't the same as having reached the section it flew
    // into -- without that visit, flying it back would be premature.
    const callsBefore = animateSpy.mock.calls.length;
    heroObserver.trigger(hero, true);
    expect(animateSpy.mock.calls.length).toBe(callsBefore);
    expect(targetRoot.querySelector("[data-hero-ballot-chip]")).not.toBeNull();
  });

  it("flies the hero back once it re-enters view, as long as the target section has genuinely been visited at some point", async () => {
    const { FakeObserver, instances } = fakeIntersectionObserver();
    const { heroRoot, targetRoot, window } = setUp(false, {
      hero: true,
      separateHeroSection: true,
    });
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    initBallotDrift(heroRoot, targetRoot, scenario());
    const hero = heroRoot.querySelector<HTMLElement>("[data-hero-ballot]")!;
    const heroObserver = observerFor(instances, hero);
    const container = targetRoot.querySelector<HTMLElement>(
      "[data-ballot-drift]",
    )!;
    const swarmObserver = observerFor(instances, container);

    heroObserver.trigger(hero, true);
    heroObserver.trigger(hero, false);
    swarmObserver.trigger(container, true);

    heroObserver.trigger(hero, true);
    await vi.waitFor(() => {
      expect(hero.style.opacity).toBe("1");
    });
  });

  it("doesn't spawn a second hero chip when the same direction repeats", () => {
    const { FakeObserver, instances } = fakeIntersectionObserver();
    const { heroRoot, targetRoot, window } = setUp(false, { hero: true });
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    initBallotDrift(heroRoot, targetRoot, scenario());
    const hero = heroRoot.querySelector<HTMLElement>("[data-hero-ballot]")!;
    const heroObserver = observerFor(instances, hero);
    heroObserver.trigger(hero, true);
    heroObserver.trigger(hero, false);
    heroObserver.trigger(hero, false);

    expect(
      targetRoot.querySelectorAll("[data-hero-ballot-chip]").length,
    ).toBe(1);
  });

  it("ignores the observer's first report of pre-existing state, only reacting to a real transition afterwards", () => {
    const { FakeObserver, instances } = fakeIntersectionObserver();
    const { heroRoot, targetRoot, window } = setUp(false, { hero: true });
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    initBallotDrift(heroRoot, targetRoot, scenario());
    const hero = heroRoot.querySelector<HTMLElement>("[data-hero-ballot]")!;
    const heroObserver = observerFor(instances, hero);

    // A first callback reporting "not intersecting" (below the fold at
    // mount) must not be treated as a real scroll-past — only a
    // subsequent report is a genuine transition.
    heroObserver.trigger(hero, false);
    expect(hero.style.opacity).not.toBe("0");
    expect(targetRoot.querySelector("[data-hero-ballot-chip]")).toBeNull();

    heroObserver.trigger(hero, false);
    expect(
      targetRoot.querySelector("[data-hero-ballot-chip]"),
    ).not.toBeNull();
  });

  it("cancels a still-running flight and reuses the same clone when the direction reverses mid-flight", () => {
    const { FakeObserver, instances } = fakeIntersectionObserver();
    const { heroRoot, targetRoot, window } = setUp(false, { hero: true });
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    const firstCancel = vi.fn();
    const secondCancel = vi.fn();
    let calls = 0;
    // fadeHero() also calls .animate() on the hero element itself (a plain
    // opacity fade) alongside the chip's own box-morph flight, on the same
    // shared prototype mock — distinguish the chip flight by its keyframes
    // (it always carries a backgroundColor) rather than by raw call order.
    window.HTMLElement.prototype.animate = vi
      .fn()
      .mockImplementation((frames: Array<Record<string, unknown>>) => {
        const isChipFlight = "backgroundColor" in (frames[0] ?? {});
        if (!isChipFlight) {
          return { finished: Promise.resolve(), cancel: vi.fn() };
        }
        calls++;
        if (calls === 1) {
          return { finished: new Promise<void>(() => {}), cancel: firstCancel };
        }
        return { finished: Promise.resolve(), cancel: secondCancel };
      });

    initBallotDrift(heroRoot, targetRoot, scenario());
    const hero = heroRoot.querySelector<HTMLElement>("[data-hero-ballot]")!;
    const heroObserver = observerFor(instances, hero);

    heroObserver.trigger(hero, true);
    heroObserver.trigger(hero, false);
    heroObserver.trigger(hero, true);

    expect(firstCancel).toHaveBeenCalled();
    expect(calls).toBe(2);
    expect(
      targetRoot.querySelectorAll("[data-hero-ballot-chip]").length,
    ).toBe(1);
  });

  it("removes the hero clone from the DOM after an uninterrupted forward flight lands", async () => {
    const { heroRoot, targetRoot } = setUp(false, { hero: true });
    initBallotDrift(heroRoot, targetRoot, scenario());

    expect(
      targetRoot.querySelector("[data-hero-ballot-chip]"),
    ).not.toBeNull();
    await vi.waitFor(() => {
      expect(targetRoot.querySelector("[data-hero-ballot-chip]")).toBeNull();
    });
  });

  it("snaps the hero handoff instantly in both directions under reduced motion", async () => {
    const { FakeObserver, instances } = fakeIntersectionObserver();
    const { heroRoot, targetRoot, window, animateSpy } = setUp(true, {
      hero: true,
    });
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    initBallotDrift(heroRoot, targetRoot, scenario());
    const hero = heroRoot.querySelector<HTMLElement>("[data-hero-ballot]")!;
    const heroObserver = observerFor(instances, hero);

    heroObserver.trigger(hero, true);

    heroObserver.trigger(hero, false);
    expect(hero.style.opacity).toBe("0");
    expect(
      targetRoot.querySelector("[data-hero-ballot-chip]"),
    ).not.toBeNull();

    heroObserver.trigger(hero, true);
    expect(hero.style.opacity).toBe("1");
    expect(animateSpy).not.toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(targetRoot.querySelector("[data-hero-ballot-chip]")).toBeNull();
    });
  });

  it("requires the swarm's container to be substantially in view, not merely peeking at the edge, before it fires", () => {
    const { FakeObserver, instances } = fakeIntersectionObserver();
    const { heroRoot, targetRoot, window } = setUp(false);
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    initBallotDrift(heroRoot, targetRoot, scenario());

    const container = targetRoot.querySelector<HTMLElement>(
      "[data-ballot-drift]",
    )!;
    const swarmObserver = observerFor(instances, container);
    expect(swarmObserver.options?.rootMargin).toBe("-35% 0px -35% 0px");
  });

  it("requires the hero to be substantially in view, not merely peeking at the edge, before it flies back -- so a quick scroll up then down doesn't retrigger it early", () => {
    const { FakeObserver, instances } = fakeIntersectionObserver();
    const { heroRoot, targetRoot, window } = setUp(false, { hero: true });
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    initBallotDrift(heroRoot, targetRoot, scenario());
    const hero = heroRoot.querySelector<HTMLElement>("[data-hero-ballot]")!;
    const heroObserver = observerFor(instances, hero);
    expect(heroObserver.options?.rootMargin).toBe("-35% 0px -35% 0px");
  });

  it("redirects an in-flight hero flight toward a moved destination on scroll, instead of continuing toward a stale target", () => {
    const { FakeObserver, instances } = fakeIntersectionObserver();
    const { heroRoot, targetRoot, window } = setUp(false, { hero: true });
    window.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver;

    let destLeft = 500;
    window.Element.prototype.getBoundingClientRect = function (
      this: Element,
    ) {
      if (this.hasAttribute("data-fill-for")) return rect(500, destLeft, 40, 192);
      if (
        this.hasAttribute("data-hero-ballot") ||
        this.hasAttribute("data-hero-ballot-chip")
      ) {
        return rect(0, 0, 150, 120);
      }
      return rect(0, 0);
    };

    const cancels: ReturnType<typeof vi.fn>[] = [];
    let chipFlightCalls = 0;
    window.HTMLElement.prototype.animate = vi
      .fn()
      .mockImplementation((frames: Array<Record<string, unknown>>) => {
        const isChipFlight = "backgroundColor" in (frames[0] ?? {});
        if (!isChipFlight) {
          return {
            finished: Promise.resolve(),
            cancel: vi.fn(),
            playState: "finished",
          };
        }
        chipFlightCalls++;
        const cancel = vi.fn();
        cancels.push(cancel);
        return {
          finished: new Promise<void>(() => {}),
          cancel,
          playState: "running",
        };
      });

    initBallotDrift(heroRoot, targetRoot, scenario());
    const hero = heroRoot.querySelector<HTMLElement>("[data-hero-ballot]")!;
    const heroObserver = observerFor(instances, hero);

    heroObserver.trigger(hero, true);
    heroObserver.trigger(hero, false);
    expect(chipFlightCalls).toBe(1);

    destLeft = 900;
    window.dispatchEvent(new window.Event("scroll"));

    expect(cancels[0]).toHaveBeenCalled();
    expect(chipFlightCalls).toBe(2);
  });

  it("does nothing on scroll when there is no active hero flight", () => {
    const { heroRoot, targetRoot, animateSpy, window } = setUp(false, {
      hero: true,
    });
    initBallotDrift(heroRoot, targetRoot, scenario());

    const callsBefore = animateSpy.mock.calls.length;
    window.dispatchEvent(new window.Event("scroll"));
    expect(animateSpy.mock.calls.length).toBe(callsBefore);
  });

  // The swarm's landed chips are a fixed-position illustration of the
  // starting distribution; once the reader actually edits a candidate's
  // count (dragging its slider), that illustration no longer matches the
  // live fill and should retire rather than sit there as a stale coloured
  // line at its original landing height.
  it("fades and removes the swarm's landed chips once the reader adjusts a slider", async () => {
    const { heroRoot, targetRoot, window } = setUp(false);
    initBallotDrift(heroRoot, targetRoot, scenario());

    expect(
      targetRoot.querySelectorAll(".ballot-paper-mini").length,
    ).toBeGreaterThan(0);

    const slider = targetRoot.querySelector('input[data-slider-for="a"]')!;
    slider.dispatchEvent(new window.Event("input", { bubbles: true }));

    await vi.waitFor(() => {
      expect(targetRoot.querySelectorAll(".ballot-paper-mini").length).toBe(0);
    });
  });

  it("removes the swarm's landed chips immediately, without animating, under reduced motion", () => {
    const { heroRoot, targetRoot, window } = setUp(true);
    initBallotDrift(heroRoot, targetRoot, scenario());

    expect(
      targetRoot.querySelectorAll(".ballot-paper-mini").length,
    ).toBeGreaterThan(0);

    const slider = targetRoot.querySelector('input[data-slider-for="a"]')!;
    slider.dispatchEvent(new window.Event("input", { bubbles: true }));

    expect(targetRoot.querySelectorAll(".ballot-paper-mini").length).toBe(0);
  });

  it("doesn't touch the swarm chips before any slider has been adjusted", () => {
    const { heroRoot, targetRoot } = setUp(false);
    initBallotDrift(heroRoot, targetRoot, scenario());

    expect(
      targetRoot.querySelectorAll(".ballot-paper-mini").length,
    ).toBeGreaterThan(0);
  });
});
