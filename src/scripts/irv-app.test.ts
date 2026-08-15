import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { initIrvApp } from "./irv-app";
import type { Scenario } from "../lib/types";

// DOM wiring for the IRV recount section: reuses the same
// [data-count-for="<id>"] contract as the explore/spoiler sections, plus a
// winner banner, a round-status line, and next/prev buttons that step
// through tallyIrv's round history one click at a time.

function candidates(ids: string[]) {
  return ids.map((id) => ({
    id,
    label: id.toUpperCase(),
    colour: "#000",
    shape: "circle" as const,
  }));
}

const scenario: Scenario = {
  candidates: candidates(["a", "b", "c"]),
  groups: [
    { ranking: ["a", "b", "c"], count: 40 },
    { ranking: ["b", "a", "c"], count: 35 },
    { ranking: ["c", "a", "b"], count: 25 },
  ],
};

function markup(ids: string[]): string {
  const stacks = ids
    .map(
      (id) =>
        `<div data-candidate="${id}"><span data-count-for="${id}">0</span><div data-fill-for="${id}"></div><span class="candidate-stack-leader-badge"></span></div>`,
    )
    .join("");
  return `<section>${stacks}<p data-testid="round-status"></p><p data-testid="winner"></p><button data-action="prev-round">Prev</button><button data-action="next-round">Next</button></section>`;
}

function setUp(reducedMotion = false) {
  const dom = new JSDOM(
    `<!doctype html><html><body>${markup(["a", "b", "c"])}</body></html>`,
  );
  const { window } = dom;
  window.matchMedia = vi.fn().mockReturnValue({ matches: reducedMotion });
  const root = window.document.querySelector("section")!;
  initIrvApp(root, scenario);
  return root;
}

describe("initIrvApp", () => {
  it("renders round 1 counts with no winner yet, prev disabled", () => {
    const root = setUp();

    expect(root.querySelector('[data-count-for="a"]')!.textContent).toBe(
      "40",
    );
    expect(root.querySelector('[data-count-for="c"]')!.textContent).toBe(
      "25",
    );
    expect(
      root.querySelector<HTMLElement>('[data-fill-for="a"]')!.style
        .getPropertyValue("--fill-pct"),
    ).toBe("40%");
    expect(root.querySelector('[data-testid="winner"]')!.textContent).toBe(
      "",
    );
    expect(
      root.querySelector<HTMLButtonElement>('button[data-action="prev-round"]')!
        .disabled,
    ).toBe(true);
    expect(
      root.querySelector<HTMLButtonElement>('button[data-action="next-round"]')!
        .disabled,
    ).toBe(false);
  });

  it("gives each recount fill element a height transition, so round changes are visibly smooth", () => {
    const root = setUp();

    expect(
      root.querySelector<HTMLElement>('[data-fill-for="a"]')!.style.transition,
    ).toContain("height");
  });

  it("skips the height transition under reduced motion, so round changes snap instantly", () => {
    const root = setUp(true);

    expect(
      root.querySelector<HTMLElement>('[data-fill-for="a"]')!.style.transition,
    ).not.toContain("height");
  });

  it("advances on click, showing the elimination and updated counts", () => {
    const root = setUp();

    root
      .querySelector<HTMLButtonElement>('button[data-action="next-round"]')!
      .click();

    expect(root.querySelector('[data-count-for="a"]')!.textContent).toBe(
      "65",
    );
    expect(root.querySelector('[data-count-for="b"]')!.textContent).toBe(
      "35",
    );
    expect(root.querySelector('[data-count-for="c"]')!.textContent).toBe(
      "eliminated",
    );
    expect(
      root.querySelector<HTMLElement>('[data-fill-for="a"]')!.style
        .getPropertyValue("--fill-pct"),
    ).toBe("65%");
    expect(
      root.querySelector<HTMLElement>('[data-fill-for="c"]')!.style
        .getPropertyValue("--fill-pct"),
    ).toBe("0%");
    expect(
      root.querySelector('[data-testid="round-status"]')!.textContent,
    ).toContain("C");
  });

  it("declares the winner once the final round is reached, and disables next", () => {
    const root = setUp();

    root
      .querySelector<HTMLButtonElement>('button[data-action="next-round"]')!
      .click();

    expect(root.querySelector('[data-testid="winner"]')!.textContent).toContain(
      "A",
    );
    expect(
      root.querySelector<HTMLButtonElement>('button[data-action="next-round"]')!
        .disabled,
    ).toBe(true);
  });

  it("steps backward on prev click, hiding the winner again", () => {
    const root = setUp();

    root
      .querySelector<HTMLButtonElement>('button[data-action="next-round"]')!
      .click();
    root
      .querySelector<HTMLButtonElement>('button[data-action="prev-round"]')!
      .click();

    expect(root.querySelector('[data-count-for="a"]')!.textContent).toBe(
      "40",
    );
    expect(root.querySelector('[data-testid="winner"]')!.textContent).toBe(
      "",
    );
  });

  it("highlights round 1's leading candidate with is-leading and a Leading badge", () => {
    const root = setUp();

    const leaderStack = root.querySelector('[data-candidate="a"]')!;
    expect(leaderStack.classList.contains("is-leading")).toBe(true);
    expect(leaderStack.classList.contains("is-winner")).toBe(false);
    expect(
      leaderStack.querySelector(".candidate-stack-leader-badge")!
        .textContent,
    ).toBe("Leading");

    for (const id of ["b", "c"]) {
      expect(
        root.querySelector(`[data-candidate="${id}"]`)!.classList.contains(
          "is-leading",
        ),
      ).toBe(false);
    }
  });

  it("switches to is-winner with a Winner badge at the final round, clearing is-leading everywhere", () => {
    const root = setUp();

    root
      .querySelector<HTMLButtonElement>('button[data-action="next-round"]')!
      .click();

    const winnerStack = root.querySelector('[data-candidate="a"]')!;
    expect(winnerStack.classList.contains("is-winner")).toBe(true);
    expect(winnerStack.classList.contains("is-leading")).toBe(false);
    expect(
      winnerStack.querySelector(".candidate-stack-leader-badge")!
        .textContent,
    ).toBe("Winner");

    for (const id of ["a", "b", "c"]) {
      expect(
        root.querySelector(`[data-candidate="${id}"]`)!.classList.contains(
          "is-leading",
        ),
      ).toBe(false);
    }
  });

  it("names round 1's leading candidate in the round-status text", () => {
    const root = setUp();

    expect(
      root.querySelector('[data-testid="round-status"]')!.textContent,
    ).toBe("Round 1: A is leading.");
  });

  it("puts the elimination before the winner announcement in reading order", () => {
    const root = setUp();

    root
      .querySelector<HTMLButtonElement>('button[data-action="next-round"]')!
      .click();

    expect(
      root.querySelector('[data-testid="round-status"]')!.textContent,
    ).toBe("Round 2: C is eliminated.");
    expect(root.querySelector('[data-testid="winner"]')!.textContent).toBe(
      "A wins after the recount.",
    );

    const testids = [...root.querySelectorAll("[data-testid]")].map((el) =>
      el.getAttribute("data-testid"),
    );
    expect(testids.indexOf("round-status")).toBeLessThan(
      testids.indexOf("winner"),
    );
  });

  it("restores is-leading after stepping back to round 1, clearing is-winner", () => {
    const root = setUp();

    root
      .querySelector<HTMLButtonElement>('button[data-action="next-round"]')!
      .click();
    root
      .querySelector<HTMLButtonElement>('button[data-action="prev-round"]')!
      .click();

    const leaderStack = root.querySelector('[data-candidate="a"]')!;
    expect(leaderStack.classList.contains("is-leading")).toBe(true);
    expect(leaderStack.classList.contains("is-winner")).toBe(false);
    expect(
      leaderStack.querySelector(".candidate-stack-leader-badge")!
        .textContent,
    ).toBe("Leading");
  });
});
