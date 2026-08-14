import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { initBallotDrift } from "./ballot-drift";
import type { Scenario } from "../lib/types";

// Ballot-drift animates a small sample of mini-ballot chips into each
// candidate's stack when the section scrolls into view, and (when a hero
// ballot illustration is present) fades that hero out while an extra chip
// flies from its position. jsdom has neither IntersectionObserver nor
// Element.animate, so this exercises the graceful-degradation paths
// deliberately built for that: no IntersectionObserver -> animate
// immediately instead of waiting for a scroll checkpoint; no
// prefers-reduced-motion match -> use WAAPI; reduced-motion requested ->
// place everything at its final position without animating at all.

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

function setUp(reducedMotion: boolean, opts: { hero?: boolean } = {}) {
  const heroMarkup = opts.hero ? `<div data-hero-ballot="a"></div>` : "";
  const dom = new JSDOM(
    `<!doctype html><html><body><section>${heroMarkup}<div data-candidate="a"></div><div data-candidate="b"></div><div data-ballot-drift></div></section></body></html>`,
    { url: "http://localhost/" },
  );
  const { window } = dom;
  window.matchMedia = vi.fn().mockReturnValue({ matches: reducedMotion });
  const calledOn: unknown[] = [];
  const animateSpy = vi.fn(function (this: unknown) {
    calledOn.push(this);
  });
  window.HTMLElement.prototype.animate = animateSpy;
  const root = window.document.querySelector("section")!;
  return { root, animateSpy, calledOn };
}

describe("initBallotDrift", () => {
  it("creates one mini-ballot chip per sampled ballot, proportioned to each candidate's votes", () => {
    const { root } = setUp(false);
    initBallotDrift(root, scenario());

    const chipsA = root.querySelectorAll('[data-mini-ballot-for="a"]');
    const chipsB = root.querySelectorAll('[data-mini-ballot-for="b"]');
    expect(chipsA.length + chipsB.length).toBe(24);
    expect(chipsA.length).toBeGreaterThan(chipsB.length);
  });

  it("animates chips into place with WAAPI when motion isn't reduced", () => {
    const { root, animateSpy } = setUp(false);
    initBallotDrift(root, scenario());
    expect(animateSpy).toHaveBeenCalled();
  });

  it("skips the animation and places chips directly when reduced motion is requested", () => {
    const { root, animateSpy } = setUp(true);
    initBallotDrift(root, scenario());

    expect(animateSpy).not.toHaveBeenCalled();
    const chip = root.querySelector<HTMLElement>(
      '[data-mini-ballot-for="a"]',
    )!;
    expect(chip.style.transform).toBe("translate(0px, 0px)");
  });

  it("does nothing when there's no ballot-drift container in the root", () => {
    const dom = new JSDOM(
      `<!doctype html><html><body><section></section></body></html>`,
    );
    const root = dom.window.document.querySelector("section")!;
    expect(() => initBallotDrift(root, scenario())).not.toThrow();
  });

  it("fades the hero ballot out in place when one is present", () => {
    const { root, calledOn } = setUp(false, { hero: true });
    initBallotDrift(root, scenario());

    const hero = root.querySelector('[data-hero-ballot]')!;
    expect(calledOn.includes(hero)).toBe(true);
  });

  it("hides the hero ballot instantly, without animating it, under reduced motion", () => {
    const { root, animateSpy } = setUp(true, { hero: true });
    initBallotDrift(root, scenario());

    expect(animateSpy).not.toHaveBeenCalled();
    const hero = root.querySelector<HTMLElement>('[data-hero-ballot]')!;
    expect(hero.style.opacity).toBe("0");
  });

  it("tolerates there being no hero ballot to fade", () => {
    const { root } = setUp(false);
    expect(() => initBallotDrift(root, scenario())).not.toThrow();
  });
});
