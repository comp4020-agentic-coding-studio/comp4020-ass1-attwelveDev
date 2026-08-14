import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { initBallotDrift } from "./ballot-drift";
import type { Scenario } from "../lib/types";

// Ballot-drift animates a small sample of dots into each candidate's stack
// when the section scrolls into view. jsdom has neither IntersectionObserver
// nor Element.animate, so this exercises the graceful-degradation paths
// deliberately built for that: no IntersectionObserver -> animate
// immediately instead of waiting for a scroll checkpoint; no
// prefers-reduced-motion match -> use WAAPI; reduced-motion requested ->
// place dots at their final position without animating at all.

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

function setUp(reducedMotion: boolean) {
  const dom = new JSDOM(
    `<!doctype html><html><body><section><div data-candidate="a"></div><div data-candidate="b"></div><div data-ballot-drift></div></section></body></html>`,
  );
  const { window } = dom;
  window.matchMedia = vi.fn().mockReturnValue({ matches: reducedMotion });
  const animateSpy = vi.fn();
  window.HTMLElement.prototype.animate = animateSpy;
  const root = window.document.querySelector("section")!;
  return { root, animateSpy };
}

describe("initBallotDrift", () => {
  it("creates one dot per sampled ballot, proportioned to each candidate's votes", () => {
    const { root } = setUp(false);
    initBallotDrift(root, scenario());

    const dotsA = root.querySelectorAll('[data-ballot-dot-for="a"]');
    const dotsB = root.querySelectorAll('[data-ballot-dot-for="b"]');
    expect(dotsA.length + dotsB.length).toBe(24);
    expect(dotsA.length).toBeGreaterThan(dotsB.length);
  });

  it("animates dots into place with WAAPI when motion isn't reduced", () => {
    const { root, animateSpy } = setUp(false);
    initBallotDrift(root, scenario());
    expect(animateSpy).toHaveBeenCalled();
  });

  it("skips the animation and places dots directly when reduced motion is requested", () => {
    const { root, animateSpy } = setUp(true);
    initBallotDrift(root, scenario());

    expect(animateSpy).not.toHaveBeenCalled();
    const dot = root.querySelector<HTMLElement>('[data-ballot-dot-for="a"]')!;
    expect(dot.style.transform).toBe("translate(0px, 0px)");
  });

  it("does nothing when there's no ballot-drift container in the root", () => {
    const dom = new JSDOM(
      `<!doctype html><html><body><section></section></body></html>`,
    );
    const root = dom.window.document.querySelector("section")!;
    expect(() => initBallotDrift(root, scenario())).not.toThrow();
  });
});
