import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { initApp } from "../src/scripts/app";
import { scenarioExplore } from "../src/data/scenario-explore";

// Assignment 1's published spec requires that "the visitor does something
// that changes what they see" — this is the mechanically-checkable core of
// that line. It runs against the BUILT page's markup (so it fails if the
// markup initApp expects ever drifts from what index.astro renders), but
// drives the interaction directly through initApp rather than trying to get
// JSDOM to execute Astro's real bundled, hashed, base-prefixed <script src>.
//
// Contract initApp(root, scenario) is expected to uphold:
// - one `input[type="range"][data-slider-for="<candidateId>"]` per candidate
// - one `[data-count-for="<candidateId>"]` text node per candidate, showing
//   that candidate's current vote count
// - one `[data-testid="winner"]` element showing the current winner's label
// - moving a slider (an "input" event) recomputes counts and winner in place
//
// Scoped to #explore-app specifically (not the whole document) because the
// real page now hosts a second, independent initApp instance for the spoiler
// scenario — this matches how src/scripts/bootstrap.ts actually calls it.

describe("the visitor changes what they see", () => {
  it("updates the vote counts and winner when a slider moves", () => {
    const distPath = resolve("dist/index.html");
    const dom = new JSDOM(readFileSync(distPath, "utf8"), {
      url: "http://localhost/",
    });
    const document = dom.window.document;
    const exploreRoot = document.querySelector("#explore-app")!;
    expect(exploreRoot).toBeTruthy();

    initApp(exploreRoot, scenarioExplore);

    const sliders = exploreRoot.querySelectorAll<HTMLInputElement>(
      'input[type="range"][data-slider-for]',
    );
    expect(sliders.length).toBeGreaterThan(1);

    const winner = exploreRoot.querySelector('[data-testid="winner"]');
    expect(winner).toBeTruthy();
    const winnerBefore = winner!.textContent;

    const firstCandidateId = sliders[0].dataset.sliderFor!;
    const countBefore = exploreRoot.querySelector(
      `[data-count-for="${firstCandidateId}"]`,
    )!.textContent;

    // Push the first candidate's slider to its maximum and let the app
    // recompute — a real reader dragging a slider fires the same event.
    // scenario-explore is authored so the first candidate doesn't already
    // hold a majority, so this is expected to flip the winner too.
    sliders[0].value = sliders[0].max;
    sliders[0].dispatchEvent(new dom.window.Event("input", { bubbles: true }));

    const countAfter = exploreRoot.querySelector(
      `[data-count-for="${firstCandidateId}"]`,
    )!.textContent;
    const winnerAfter = exploreRoot.querySelector(
      '[data-testid="winner"]',
    )!.textContent;

    expect(countAfter).not.toBe(countBefore);
    expect(winnerAfter).not.toBe(winnerBefore);
  });
});
