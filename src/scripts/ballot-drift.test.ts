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
  const heroMarkup = opts.hero ? `<div data-hero-ballot="a"></div>` : "";
  const markup = opts.separateHeroSection
    ? `<section>${heroMarkup}</section><section><div data-candidate="a"></div><div data-candidate="b"></div><div data-ballot-drift></div></section>`
    : `<section>${heroMarkup}<div data-candidate="a"></div><div data-candidate="b"></div><div data-ballot-drift></div></section>`;
  const dom = new JSDOM(`<!doctype html><html><body>${markup}</body></html>`, {
    url: "http://localhost/",
  });
  const { window } = dom;
  window.matchMedia = vi.fn().mockReturnValue({ matches: reducedMotion });
  const animateSpy = vi.fn();
  window.HTMLElement.prototype.animate = animateSpy;
  const sections = window.document.querySelectorAll("section");
  const heroRoot = sections[0];
  const targetRoot = opts.separateHeroSection ? sections[1] : sections[0];
  return {
    heroRoot,
    targetRoot,
    animateSpy,
    calledOn: animateSpy.mock.contexts,
  };
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
    expect(animateSpy.mock.contexts.some((el) => el.hasAttribute("data-hero-ballot"))).toBe(
      false,
    );
  });
});
