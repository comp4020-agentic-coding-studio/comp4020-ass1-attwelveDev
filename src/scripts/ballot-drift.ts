import { sampleAllocation } from "../lib/sample-ballots";
import { springTranslateKeyframes } from "../lib/spring";
import type { Candidate, Scenario } from "../lib/types";

const TOTAL_SAMPLE_CHIPS = 24;
const DRIFT_DISTANCE_PX = 60;
const HERO_FADE_DURATION_MS = 400;

// Animates a small representative sample of mini ballot-paper chips drifting
// down into each candidate's stack, triggered once the section scrolls into
// view. When a hero ballot illustration is present, it fades out in place
// while one extra chip flies the real cross-column path from the hero's
// position to its first preference's stack. Skips straight to the final
// position for prefers-reduced-motion, and degrades gracefully (immediate
// placement, no animation) wherever IntersectionObserver or Element.animate
// aren't available at all.
export function initBallotDrift(root: ParentNode, scenario: Scenario): void {
  const container = root.querySelector<HTMLElement>("[data-ballot-drift]");
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
  ): void {
    if (reducedMotion || typeof el.animate !== "function") {
      el.style.transform = `translate(${to.x}px, ${to.y}px)`;
      return;
    }
    el.animate(
      springTranslateKeyframes(from, to, { stiffness: 170, damping: 20 }),
      { duration: 600, fill: "forwards" },
    );
  }

  function fadeHero(hero: HTMLElement): void {
    if (reducedMotion || typeof hero.animate !== "function") {
      hero.style.opacity = "0";
      return;
    }
    hero.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: HERO_FADE_DURATION_MS,
      fill: "forwards",
    });
  }

  function placeChips(): void {
    const containerRect = container!.getBoundingClientRect();

    for (const candidate of scenario.candidates) {
      const target = root.querySelector<HTMLElement>(
        `[data-candidate="${candidate.id}"]`,
      );
      const count = allocation[candidate.id] ?? 0;
      const targetRect = target?.getBoundingClientRect();

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

    const hero = root.querySelector<HTMLElement>("[data-hero-ballot]");
    if (!hero) return;

    fadeHero(hero);

    const heroCandidateId = hero.getAttribute("data-hero-ballot");
    const heroCandidate = heroCandidateId
      ? candidatesById.get(heroCandidateId)
      : undefined;
    if (!heroCandidate) return;

    const heroRect = hero.getBoundingClientRect();
    const target = root.querySelector<HTMLElement>(
      `[data-candidate="${heroCandidate.id}"]`,
    );
    const targetRect = target?.getBoundingClientRect();

    const from = {
      x: heroRect.left - containerRect.left,
      y: heroRect.top - containerRect.top,
    };
    const to = {
      x: (targetRect?.left ?? containerRect.left) - containerRect.left,
      y: (targetRect?.top ?? containerRect.top) - containerRect.top,
    };

    const heroChip = createMiniBallot(heroCandidate);
    container!.appendChild(heroChip);
    flyTo(heroChip, from, to);
  }

  if (typeof view.IntersectionObserver === "function") {
    const observer = new view.IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            placeChips();
            observer.disconnect();
          }
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(container);
  } else {
    placeChips();
  }
}
