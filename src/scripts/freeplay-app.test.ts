import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { initFreeplayApp } from "./freeplay-app";
import { FREEPLAY_MAX_CANDIDATES, FREEPLAY_MIN_CANDIDATES } from "../lib/freeplay-palette";
import { tallyIrv } from "../lib/tally-irv";
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
      <button type="button" data-action="switch-system">Switch to preferential voting</button>
      <div data-freeplay-recount hidden></div>
    </div></body></html>`,
  );
  // initIrvApp/initIrvDrift (run inside the recount panel once IRV mode is
  // switched on) each check prefers-reduced-motion -- jsdom has no real
  // matchMedia, so stub it the same way irv-app.test.ts/irv-drift.test.ts do
  // to avoid an unimplemented-API console warning on every test run.
  dom.window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  const root = dom.window.document.querySelector("#freeplay-app")!;
  initFreeplayApp(root, scenario(n));
  return { dom, root };
}

function click(dom: JSDOM, el: Element): void {
  el.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
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

  it("names a tie in the winner banner when two candidates end up level", () => {
    const { root } = setUp(2);

    expect(root.querySelector('[data-testid="winner"]')!.textContent).toBe(
      "A is currently ahead. Tied with B on votes — ties are broken alphabetically by name.",
    );
  });

  it("pairs each candidate's stack and slider inside one shared candidate-column", () => {
    const { root } = setUp(3);
    const stack = root.querySelector('[data-candidate="a"]')!;
    const slider = root.querySelector('input[data-slider-for="a"]')!;
    const column = stack.closest(".candidate-column");
    expect(column).not.toBeNull();
    expect(column!.contains(slider)).toBe(true);
  });

  it("nests each slider inside its own stack's bar, not as a separate sibling widget", () => {
    const { root } = setUp(3);
    const bar = root.querySelector('[data-candidate="a"] .candidate-stack-bar')!;
    const slider = root.querySelector('input[data-slider-for="a"]')!;
    expect(bar.contains(slider)).toBe(true);
  });

  it("gives each slider an accessible name now that it has no visible label", () => {
    const { root } = setUp(3);
    const slider = root.querySelector('input[data-slider-for="a"]')!;
    expect(slider.getAttribute("aria-label")).toBe("A");
  });

  it("marks the currently-ahead candidate's stack as leading, and only that one", () => {
    const { root } = setUp(3);
    const winnerLabel = root.querySelector('[data-testid="winner"]')!
      .textContent!;
    const leadingStacks = root.querySelectorAll(".candidate-stack.is-leading");
    expect(leadingStacks.length).toBe(1);
    expect(winnerLabel).toContain(
      leadingStacks[0].querySelector(".candidate-stack-label")!.textContent,
    );
  });

  it("moves the leading indicator once a slider change flips who's ahead", () => {
    const { dom, root } = setUp(3);
    const sliderA = root.querySelector<HTMLInputElement>(
      'input[data-slider-for="a"]',
    )!;
    sliderA.value = sliderA.max;
    sliderA.dispatchEvent(new dom.window.Event("input", { bubbles: true }));

    expect(
      root
        .querySelector('[data-candidate="a"]')!
        .classList.contains("is-leading"),
    ).toBe(true);
    expect(
      root
        .querySelector('[data-candidate="b"]')!
        .classList.contains("is-leading"),
    ).toBe(false);
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

  it("toggling switch-system shows the ranking lists and recount panel, and flips its own label", () => {
    const { dom, root } = setUp(3);
    const switchButton = root.querySelector<HTMLButtonElement>(
      'button[data-action="switch-system"]',
    )!;
    const recount = root.querySelector<HTMLElement>(
      "[data-freeplay-recount]",
    )!;

    expect(recount.hidden).toBe(true);
    const rankingGroups = root.querySelectorAll<HTMLElement>(
      ".freeplay-ranking-group",
    );
    expect(rankingGroups.length).toBe(3);
    for (const group of rankingGroups) expect(group.hidden).toBe(true);

    click(dom, switchButton);

    expect(switchButton.textContent).toBe("Switch to first-past-the-post");
    expect(recount.hidden).toBe(false);
    for (const group of rankingGroups) expect(group.hidden).toBe(false);

    click(dom, switchButton);

    expect(switchButton.textContent).toBe("Switch to preferential voting");
    expect(recount.hidden).toBe(true);
    for (const group of rankingGroups) expect(group.hidden).toBe(true);
  });

  it("builds a recount panel whose eventual winner matches tallyIrv on the equivalent scenario", () => {
    const { dom, root } = setUp(3);
    const switchButton = root.querySelector<HTMLButtonElement>(
      'button[data-action="switch-system"]',
    )!;
    click(dom, switchButton);

    const recount = root.querySelector<HTMLElement>(
      "[data-freeplay-recount]",
    )!;
    const nextButton = recount.querySelector<HTMLButtonElement>(
      'button[data-action="next-round"]',
    )!;
    // Free play hasn't been edited yet, so its rankings are exactly the
    // starting scenario's -- tallyIrv on that same scenario is the ground
    // truth this recount should reach once fully stepped through.
    while (!nextButton.disabled) click(dom, nextButton);

    const expectedWinner = tallyIrv(scenario(3)).winner;
    expect(
      recount.querySelector('[data-testid="winner"]')!.textContent,
    ).toBe(`${expectedWinner.toUpperCase()} wins after the recount.`);
  });

  it("resets the recount panel back to round 0 after any edit made while in IRV mode", () => {
    const { dom, root } = setUp(3);
    const switchButton = root.querySelector<HTMLButtonElement>(
      'button[data-action="switch-system"]',
    )!;
    click(dom, switchButton);

    const recount = root.querySelector<HTMLElement>(
      "[data-freeplay-recount]",
    )!;
    click(
      dom,
      recount.querySelector<HTMLButtonElement>(
        'button[data-action="next-round"]',
      )!,
    );
    expect(
      recount.querySelector<HTMLButtonElement>(
        'button[data-action="prev-round"]',
      )!.disabled,
    ).toBe(false);

    // Any state-changing action taken while in IRV mode rebuilds the
    // recount panel from scratch, so a changed vote always restarts the
    // walkthrough at round 0.
    const downButton = root.querySelector<HTMLButtonElement>(
      ".freeplay-ranking-group button[data-action=\"move-ranking-down\"]:not([disabled])",
    )!;
    click(dom, downButton);

    expect(
      recount.querySelector<HTMLButtonElement>(
        'button[data-action="prev-round"]',
      )!.disabled,
    ).toBe(true);
  });

  it("adding or removing a candidate while in IRV mode leaves every ranking a valid permutation, without throwing", () => {
    const { dom, root } = setUp(3);
    const switchButton = root.querySelector<HTMLButtonElement>(
      'button[data-action="switch-system"]',
    )!;
    click(dom, switchButton);

    const columns = root.querySelector("[data-freeplay-columns]")!;
    const rankingsAreValid = (ids: string[]) => {
      for (const ownerId of ids) {
        const list = columns.querySelector(
          `ol[data-ranking-for="${ownerId}"]`,
        )!;
        const rankedIds = [
          ...list.querySelectorAll('button[data-action="move-ranking-up"]'),
        ].map((button) => button.getAttribute("data-candidate-id"));
        expect(rankedIds).not.toContain(ownerId);
        expect(new Set(rankedIds)).toEqual(
          new Set(ids.filter((id) => id !== ownerId)),
        );
      }
    };

    const addButton = root.querySelector<HTMLButtonElement>(
      'button[data-action="add-candidate"]',
    )!;
    expect(() => click(dom, addButton)).not.toThrow();

    const idsAfterAdd = [...columns.querySelectorAll("[data-candidate]")].map(
      (el) => el.getAttribute("data-candidate")!,
    );
    expect(idsAfterAdd).toHaveLength(4);
    rankingsAreValid(idsAfterAdd);

    const removeButton = root.querySelector<HTMLButtonElement>(
      'button[data-action="remove-candidate"]',
    )!;
    expect(() => click(dom, removeButton)).not.toThrow();

    const idsAfterRemove = [
      ...columns.querySelectorAll("[data-candidate]"),
    ].map((el) => el.getAttribute("data-candidate")!);
    expect(idsAfterRemove).toHaveLength(3);
    rankingsAreValid(idsAfterRemove);

    const recount = root.querySelector<HTMLElement>(
      "[data-freeplay-recount]",
    )!;
    expect(recount.querySelectorAll("[data-candidate]").length).toBe(3);
  });
});
