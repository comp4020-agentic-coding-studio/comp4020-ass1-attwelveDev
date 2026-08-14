import { sampleAllocation } from "../lib/sample-ballots";
import { springTranslateKeyframes } from "../lib/spring";
import type { Candidate, Scenario } from "../lib/types";

const TOTAL_SAMPLE_CHIPS = 24;
const DRIFT_DISTANCE_PX = 60;
const HERO_FADE_DURATION_MS = 400;

// Animates a small representative sample of mini ballot-paper chips drifting
// down into each candidate's stack, triggered once the section scrolls into
// view. When a hero ballot illustration is present, it fades out and flies
// one extra chip the real cross-column path from the hero's position to its
// first preference's stack fill — and reverses that handoff (fades back in,
// flies the chip home) when the hero scrolls back into view, since that's
// the one animation in this piece the user wants scroll-reversible. The
// swarm sample stays one-shot: it has no "undo" state to return to. The hero
// can live in a different chapter from the stacks it flies into (an intro
// chapter handing off to the next), so heroRoot and targetRoot are scoped
// independently; pass the same root for both when they share one chapter.
// Skips straight to the final position for prefers-reduced-motion, and
// degrades gracefully (immediate placement, no animation, no reversal)
// wherever IntersectionObserver or Element.animate aren't available at all.
export function initBallotDrift(
  heroRoot: ParentNode | null,
  targetRoot: ParentNode,
  scenario: Scenario,
): void {
  const container = targetRoot.querySelector<HTMLElement>(
    "[data-ballot-drift]",
  );
  if (!container) return;

  const doc = container.ownerDocument;
  const view = doc.defaultView;
  if (!view) return;

  const candidatesById = new Map<string, Candidate>(
    scenario.candidates.map((candidate) => [candidate.id, candidate]),
  );
  const allocation = sampleAllocation(scenario, TOTAL_SAMPLE_CHIPS);
  const reducedMotion =
    typeof view.matchMedia === "function" &&
    view.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function createMiniBallot(candidate: Candidate): HTMLElement {
    const chip = doc.createElement("span");
    chip.className = "ballot-paper ballot-paper-mini";
    chip.dataset.miniBallotFor = candidate.id;
    chip.setAttribute("aria-hidden", "true");

    const mark = doc.createElement("span");
    mark.className = `ballot-paper-mini-mark candidate-stack-swatch candidate-stack-swatch-${candidate.shape}`;
    mark.style.setProperty("--swatch-colour", candidate.colour);
    chip.appendChild(mark);

    return chip;
  }

  function flyTo(
    el: HTMLElement,
    from: { x: number; y: number },
    to: { x: number; y: number },
  ): Promise<void> {
    if (reducedMotion || typeof el.animate !== "function") {
      el.style.transform = `translate(${to.x}px, ${to.y}px)`;
      return Promise.resolve();
    }
    const animation = el.animate(
      springTranslateKeyframes(from, to, { stiffness: 170, damping: 20 }),
      { duration: 600, fill: "forwards" },
    );
    return animation.finished.then(() => {});
  }

  function fadeHero(hero: HTMLElement, targetOpacity: 0 | 1): void {
    if (reducedMotion || typeof hero.animate !== "function") {
      hero.style.opacity = String(targetOpacity);
      return;
    }
    hero.animate(
      [{ opacity: targetOpacity === 0 ? 1 : 0 }, { opacity: targetOpacity }],
      { duration: HERO_FADE_DURATION_MS, fill: "forwards" },
    );
  }

  function fillRectFor(id: string): DOMRect | undefined {
    return targetRoot
      .querySelector<HTMLElement>(`[data-fill-for="${id}"]`)
      ?.getBoundingClientRect();
  }

  function placeSwarm(): void {
    const containerRect = container!.getBoundingClientRect();

    for (const candidate of scenario.candidates) {
      const count = allocation[candidate.id] ?? 0;
      const targetRect = fillRectFor(candidate.id);

      const to = {
        x: (targetRect?.left ?? containerRect.left) - containerRect.left,
        y: (targetRect?.top ?? containerRect.top) - containerRect.top,
      };
      const from = { x: to.x, y: to.y - DRIFT_DISTANCE_PX };

      for (let i = 0; i < count; i++) {
        const chip = createMiniBallot(candidate);
        container!.appendChild(chip);
        flyTo(chip, from, to);
      }
    }
  }

  if (typeof view.IntersectionObserver === "function") {
    const swarmObserver = new view.IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            placeSwarm();
            swarmObserver.disconnect();
          }
        }
      },
      { threshold: 0.3 },
    );
    swarmObserver.observe(container);
  } else {
    placeSwarm();
  }

  const hero = heroRoot?.querySelector<HTMLElement>("[data-hero-ballot]");
  const heroCandidateId = hero?.getAttribute("data-hero-ballot");
  const heroCandidate = heroCandidateId
    ? candidatesById.get(heroCandidateId)
    : undefined;
  if (!hero || !heroCandidate) return;

  let heroChip: HTMLElement | null = null;
  let heroAway = false;

  function heroOrigin(): { x: number; y: number } {
    const containerRect = container!.getBoundingClientRect();
    const heroRect = hero!.getBoundingClientRect();
    return {
      x: heroRect.left - containerRect.left,
      y: heroRect.top - containerRect.top,
    };
  }

  function heroDestination(): { x: number; y: number } {
    const containerRect = container!.getBoundingClientRect();
    const targetRect = fillRectFor(heroCandidate!.id);
    return {
      x: (targetRect?.left ?? containerRect.left) - containerRect.left,
      y: (targetRect?.top ?? containerRect.top) - containerRect.top,
    };
  }

  async function flyForward(): Promise<void> {
    if (heroAway) return;
    heroAway = true;
    fadeHero(hero!, 0);

    const chip = createMiniBallot(heroCandidate!);
    chip.dataset.heroBallotChip = "";
    container!.appendChild(chip);
    heroChip = chip;
    await flyTo(chip, heroOrigin(), heroDestination());
  }

  async function flyBackward(): Promise<void> {
    if (!heroAway) return;
    heroAway = false;
    fadeHero(hero!, 1);

    const chip = heroChip;
    heroChip = null;
    if (!chip) return;
    await flyTo(chip, heroDestination(), heroOrigin());
    chip.remove();
  }

  if (typeof view.IntersectionObserver === "function") {
    const heroObserver = new view.IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) void flyBackward();
          else void flyForward();
        }
      },
      { threshold: 0 },
    );
    heroObserver.observe(hero);
  } else {
    void flyForward();
  }
}
