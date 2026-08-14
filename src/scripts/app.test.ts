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
  const stacks = candidateIds
    .map(
      (id) =>
        `<div class="candidate-stack" data-candidate="${id}">` +
        `<div data-fill-for="${id}"></div>` +
        `<input type="range" data-slider-for="${id}" />` +
        `</div>`,
    )
    .join("");
  const counts = candidateIds
    .map((id) => `<span data-count-for="${id}">0</span>`)
    .join("");
  return `<section>${stacks}${counts}<p data-testid="winner"></p></section>`;
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

  it("sets --fill-pct on each candidate's fill element, proportional to its share of the total", () => {
    const dom = new JSDOM(
      `<!doctype html><html><body>${section(["a", "b"])}</body></html>`,
    );
    const root = dom.window.document.querySelector("section")!;
    initApp(root, scenarioFor(["a", "b"], [60, 40]));

    expect(
      root.querySelector<HTMLElement>('[data-fill-for="a"]')!.style
        .getPropertyValue("--fill-pct"),
    ).toBe("60%");
    expect(
      root.querySelector<HTMLElement>('[data-fill-for="b"]')!.style
        .getPropertyValue("--fill-pct"),
    ).toBe("40%");
  });

  it("marks the currently-ahead candidate's stack as leading, and only that one", () => {
    const dom = new JSDOM(
      `<!doctype html><html><body>${section(["a", "b"])}</body></html>`,
    );
    const root = dom.window.document.querySelector("section")!;
    initApp(root, scenarioFor(["a", "b"], [60, 40]));

    expect(
      root.querySelector('[data-candidate="a"]')!.classList.contains(
        "is-leading",
      ),
    ).toBe(true);
    expect(
      root.querySelector('[data-candidate="b"]')!.classList.contains(
        "is-leading",
      ),
    ).toBe(false);
  });

  it("moves the leading indicator once a slider change flips who's ahead", () => {
    const dom = new JSDOM(
      `<!doctype html><html><body>${section(["a", "b"])}</body></html>`,
    );
    const root = dom.window.document.querySelector("section")!;
    initApp(root, scenarioFor(["a", "b"], [60, 40]));

    const sliderB = root.querySelector<HTMLInputElement>(
      'input[data-slider-for="b"]',
    )!;
    sliderB.value = sliderB.max;
    sliderB.dispatchEvent(new dom.window.Event("input", { bubbles: true }));

    expect(
      root.querySelector('[data-candidate="a"]')!.classList.contains(
        "is-leading",
      ),
    ).toBe(false);
    expect(
      root.querySelector('[data-candidate="b"]')!.classList.contains(
        "is-leading",
      ),
    ).toBe(true);
  });
});
