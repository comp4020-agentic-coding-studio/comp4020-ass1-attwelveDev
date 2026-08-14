import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { initApp } from "./app";
import type { Scenario } from "../lib/types";

// The explore section and the spoiler section (step 5 onward) are two
// independent initApp instances on the same page. This locks in the contract
// that makes that safe: initApp only ever reads/writes inside the root
// element it's given, so one instance's slider can't leak into another's
// counts or winner banner.

function section(candidateIds: string[]): string {
  const sliders = candidateIds
    .map((id) => `<input type="range" data-slider-for="${id}" />`)
    .join("");
  const counts = candidateIds
    .map((id) => `<span data-count-for="${id}">0</span>`)
    .join("");
  return `<section>${sliders}${counts}<p data-testid="winner"></p></section>`;
}

function scenarioFor(ids: [string, string], counts: [number, number]): Scenario {
  return {
    candidates: ids.map((id) => ({
      id,
      label: id,
      colour: "#000",
      shape: "circle" as const,
    })),
    groups: [
      { ranking: [ids[0], ids[1]], count: counts[0] },
      { ranking: [ids[1], ids[0]], count: counts[1] },
    ],
  };
}

describe("initApp scoping", () => {
  it("doesn't let one instance's slider affect a sibling instance", () => {
    const dom = new JSDOM(
      `<!doctype html><html><body>${section(["a", "b"])}${section(["c", "d"])}</body></html>`,
    );
    const document = dom.window.document;
    const [sectionA, sectionB] = document.querySelectorAll("section");

    const scenarioA = scenarioFor(["a", "b"], [60, 40]);
    const scenarioC = scenarioFor(["c", "d"], [30, 70]);

    initApp(sectionA, scenarioA);
    initApp(sectionB, scenarioC);

    const winnerBBefore = sectionB.querySelector(
      '[data-testid="winner"]',
    )!.textContent;
    const countDBefore = sectionB.querySelector(
      '[data-count-for="d"]',
    )!.textContent;

    const sliderA = sectionA.querySelector<HTMLInputElement>(
      'input[data-slider-for="a"]',
    )!;
    sliderA.value = sliderA.max;
    sliderA.dispatchEvent(new dom.window.Event("input", { bubbles: true }));

    expect(
      sectionB.querySelector('[data-testid="winner"]')!.textContent,
    ).toBe(winnerBBefore);
    expect(sectionB.querySelector('[data-count-for="d"]')!.textContent).toBe(
      countDBefore,
    );
    expect(sectionA.querySelector('[data-count-for="a"]')!.textContent).toBe(
      "100",
    );
  });
});
