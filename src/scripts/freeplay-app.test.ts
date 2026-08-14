import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { initFreeplayApp } from "./freeplay-app";
import { FREEPLAY_MAX_CANDIDATES, FREEPLAY_MIN_CANDIDATES } from "../lib/freeplay-palette";
import type { Scenario } from "../lib/types";

// Free play is the one place candidates get added and removed at runtime, so
// its stacks/sliders can't be pre-rendered by Astro -- initFreeplayApp builds
// and rebuilds all of that markup itself. These tests exercise the full
// contract: render, slider interaction, add, remove, and the disabled state
// at the palette's floor/cap.

function scenario(n: 2 | 3): Scenario {
  const ids = ["a", "b", "c"].slice(0, n);
  const candidates = ids.map((id) => ({
    id,
    label: id.toUpperCase(),
    colour: "#000",
    shape: "circle" as const,
  }));
  const share = Math.floor(1000 / n);
  const groups = ids.map((id, i) => ({
    ranking: [id, ...ids.filter((other) => other !== id)],
    count: i === ids.length - 1 ? 1000 - share * (n - 1) : share,
  }));
  return { candidates, groups };
}

function setUp(n: 2 | 3) {
  const dom = new JSDOM(
    `<!doctype html><html><body><div id="freeplay-app">
      <div data-freeplay-columns></div>
      <p data-testid="winner"></p>
      <button type="button" data-action="add-candidate">Add candidate</button>
    </div></body></html>`,
  );
  const root = dom.window.document.querySelector("#freeplay-app")!;
  initFreeplayApp(root, scenario(n));
  return { dom, root };
}

describe("initFreeplayApp", () => {
  it("renders one stack and one slider per starting candidate, and a winner", () => {
    const { root } = setUp(3);
    expect(root.querySelectorAll("[data-candidate]").length).toBe(3);
    expect(
      root.querySelectorAll('input[type="range"][data-slider-for]').length,
    ).toBe(3);
    expect(
      root.querySelector('[data-testid="winner"]')!.textContent,
    ).not.toBe("");
  });

  it("redistributes and updates the winner when a slider moves", () => {
    const { dom, root } = setUp(3);
    const sliderA = root.querySelector<HTMLInputElement>(
      'input[data-slider-for="a"]',
    )!;
    sliderA.value = sliderA.max;
    sliderA.dispatchEvent(new dom.window.Event("input", { bubbles: true }));

    expect(root.querySelector('[data-count-for="a"]')!.textContent).toBe(
      "1000",
    );
    expect(root.querySelector('[data-count-for="b"]')!.textContent).toBe("0");
    expect(
      root.querySelector<HTMLElement>('[data-fill-for="a"]')!.style
        .getPropertyValue("--fill-pct"),
    ).toBe("100%");
    expect(
      root.querySelector<HTMLElement>('[data-fill-for="b"]')!.style
        .getPropertyValue("--fill-pct"),
    ).toBe("0%");
    expect(
      root.querySelector('[data-testid="winner"]')!.textContent,
    ).toContain("A");
  });

  it("pairs each candidate's stack and slider inside one shared candidate-column", () => {
    const { root } = setUp(3);
    const stack = root.querySelector('[data-candidate="a"]')!;
    const slider = root.querySelector('input[data-slider-for="a"]')!;
    const column = stack.closest(".candidate-column");
    expect(column).not.toBeNull();
    expect(column!.contains(slider)).toBe(true);
  });

  it("adds a candidate on click, preserving the vote total", () => {
    const { dom, root } = setUp(3);
    const addButton = root.querySelector<HTMLButtonElement>(
      'button[data-action="add-candidate"]',
    )!;
    addButton.dispatchEvent(new dom.window.Event("click", { bubbles: true }));

    expect(root.querySelectorAll("[data-candidate]").length).toBe(4);
    const counts = [...root.querySelectorAll("[data-count-for]")].map((el) =>
      Number(el.textContent),
    );
    expect(counts.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it("removes a candidate on click, preserving the vote total", () => {
    const { dom, root } = setUp(3);
    const removeButton = root.querySelector<HTMLButtonElement>(
      'button[data-action="remove-candidate"][data-candidate-id="b"]',
    )!;
    removeButton.dispatchEvent(new dom.window.Event("click", { bubbles: true }));

    expect(root.querySelectorAll("[data-candidate]").length).toBe(2);
    expect(root.querySelector('[data-count-for="b"]')).toBeNull();
    const counts = [...root.querySelectorAll("[data-count-for]")].map((el) =>
      Number(el.textContent),
    );
    expect(counts.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it("disables add-candidate once the palette's cap is reached", () => {
    const { dom, root } = setUp(2);
    const addButton = root.querySelector<HTMLButtonElement>(
      'button[data-action="add-candidate"]',
    )!;
    for (let i = 2; i < FREEPLAY_MAX_CANDIDATES; i++) {
      addButton.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    }
    expect(root.querySelectorAll("[data-candidate]").length).toBe(
      FREEPLAY_MAX_CANDIDATES,
    );
    expect(addButton.disabled).toBe(true);
  });

  it("disables remove-candidate once the palette's floor is reached", () => {
    const { root } = setUp(2);
    expect(FREEPLAY_MIN_CANDIDATES).toBe(2);
    const removeButtons = root.querySelectorAll<HTMLButtonElement>(
      'button[data-action="remove-candidate"]',
    );
    expect(removeButtons.length).toBe(2);
    for (const button of removeButtons) expect(button.disabled).toBe(true);
  });
});
