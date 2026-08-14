import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
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
  const counts = ids
    .map((id) => `<span data-count-for="${id}">0</span>`)
    .join("");
  return `<section>${counts}<p data-testid="winner"></p><p data-testid="round-status"></p><button data-action="prev-round">Prev</button><button data-action="next-round">Next</button></section>`;
}

function setUp() {
  const dom = new JSDOM(
    `<!doctype html><html><body>${markup(["a", "b", "c"])}</body></html>`,
  );
  const root = dom.window.document.querySelector("section")!;
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
});
