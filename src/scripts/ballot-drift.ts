import { sampleAllocation } from "../lib/sample-ballots";
import type { BoxState } from "../lib/spring";
import { springBoxKeyframes } from "../lib/spring";
import type { Candidate, Scenario } from "../lib/types";

const TOTAL_SAMPLE_CHIPS = 24;
const DRIFT_DISTANCE_PX = 60;
const HERO_FADE_DURATION_MS = 400;
const FLIGHT_DURATION_MS = 600;
// The coloured stack bar is a stack of ballot papers seen edge-on, so a
// landed chip flattens down to a thin colour-matched line rather than
// staying a small white rectangle sitting on top of it.
const LANDED_STRIP_HEIGHT_PX = 3;

interface EdgeStyle {
  backgroundColor: string;
  borderWidth: string;
  borderRadius: string;
}

// Animates a small representative sample of mini ballot-paper chips drifting
// down into each candidate's stack, triggered once the section scrolls into
// view. When a hero ballot illustration is present, it fades out while a
// clone of the real ballot flies (and visibly shrinks/clips its own content
// down to a flat line) from the hero's position to its first preference's
// stack fill — reversing that handoff (grows back, fades back in) when the
// hero scrolls back into view, since that's the one animation in this piece
// the user wants scroll-reversible. The swarm sample stays one-shot: it has
// no "undo" state to return to. The hero can live in a different chapter
// from the stacks it flies into (an intro chapter handing off to the next),
// so heroRoot and targetRoot are scoped independently; pass the same root
// for both when they share one chapter. Skips straight to the final
// flattened position/shape for prefers-reduced-motion, and degrades
// gracefully (immediate placement, no animation, no reversal) wherever
// IntersectionObserver or Element.animate aren't available at all.
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

  function applyEdgeStyle(el: HTMLElement, style: EdgeStyle): void {
    el.style.backgroundColor = style.backgroundColor;
    el.style.borderWidth = style.borderWidth;
    el.style.borderRadius = style.borderRadius;
  }

  function flyTo(
    el: HTMLElement,
    from: BoxState,
    to: BoxState,
    fromStyle: EdgeStyle,
    toStyle: EdgeStyle,
  ): Promise<void> {
    if (reducedMotion || typeof el.animate !== "function") {
      el.style.transform = `translate(${to.x}px, ${to.y}px)`;
      el.style.width = `${to.width}px`;
      el.style.height = `${to.height}px`;
      applyEdgeStyle(el, toStyle);
      return Promise.resolve();
    }
    const frames = springBoxKeyframes(from, to, { stiffness: 170, damping: 20 });
    frames[0] = { ...frames[0], ...fromStyle };
    frames[frames.length - 1] = { ...frames[frames.length - 1], ...toStyle };
    const animation = el.animate(frames, {
      duration: FLIGHT_DURATION_MS,
      fill: "forwards",
    });
    return animation.finished.then(() => {});
  }

  function fadeOutMark(mark: HTMLElement): void {
    if (reducedMotion || typeof mark.animate !== "function") {
      mark.style.opacity = "0";
      return;
    }
    mark.animate(
      [
        { opacity: 1, offset: 0 },
        { opacity: 0, offset: 0.5 },
        { opacity: 0, offset: 1 },
      ],
      { duration: FLIGHT_DURATION_MS, fill: "forwards" },
    );
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

      const toX = (targetRect?.left ?? containerRect.left) - containerRect.left;
      const toY = (targetRect?.top ?? containerRect.top) - containerRect.top;
      const to: BoxState = {
        x: toX,
        y: toY,
        width: targetRect?.width ?? containerRect.width,
        height: LANDED_STRIP_HEIGHT_PX,
      };

      for (let i = 0; i < count; i++) {
        const chip = createMiniBallot(candidate);
        container!.appendChild(chip);
        const naturalRect = chip.getBoundingClientRect();

        const from: BoxState = {
          x: toX,
          y: toY - DRIFT_DISTANCE_PX,
          width: naturalRect.width,
          height: naturalRect.height,
        };

        const mark = chip.querySelector<HTMLElement>(
          ".ballot-paper-mini-mark",
        );
        if (mark) fadeOutMark(mark);

        void flyTo(
          chip,
          from,
          to,
          { backgroundColor: "#fff", borderWidth: "1px", borderRadius: "0.15rem" },
          { backgroundColor: candidate.colour, borderWidth: "0px", borderRadius: "0px" },
        );
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
  let heroNaturalSize: { width: number; height: number } | null = null;
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

    const clone = hero!.cloneNode(true) as HTMLElement;
    clone.removeAttribute("data-hero-ballot");
    clone.dataset.heroBallotChip = "";
    clone.setAttribute("aria-hidden", "true");
    clone.style.position = "absolute";
    clone.style.top = "0";
    clone.style.left = "0";
    clone.style.margin = "0";
    clone.style.boxSizing = "border-box";
    clone.style.overflow = "hidden";
    clone.style.pointerEvents = "none";
    container!.appendChild(clone);

    const naturalRect = clone.getBoundingClientRect();
    heroNaturalSize = { width: naturalRect.width, height: naturalRect.height };
    heroChip = clone;

    const origin = heroOrigin();
    const destination = heroDestination();
    const destRect = fillRectFor(heroCandidate!.id);

    const from: BoxState = {
      ...origin,
      width: naturalRect.width,
      height: naturalRect.height,
    };
    const to: BoxState = {
      ...destination,
      width: destRect?.width ?? naturalRect.width,
      height: LANDED_STRIP_HEIGHT_PX,
    };

    await flyTo(
      clone,
      from,
      to,
      { backgroundColor: "#fff", borderWidth: "1px", borderRadius: "0.25rem" },
      {
        backgroundColor: heroCandidate!.colour,
        borderWidth: "0px",
        borderRadius: "0px",
      },
    );
  }

  async function flyBackward(): Promise<void> {
    if (!heroAway) return;
    heroAway = false;
    fadeHero(hero!, 1);

    const chip = heroChip;
    const naturalSize = heroNaturalSize;
    heroChip = null;
    heroNaturalSize = null;
    if (!chip || !naturalSize) return;

    const origin = heroOrigin();
    const destination = heroDestination();
    const destRect = fillRectFor(heroCandidate!.id);

    const from: BoxState = {
      ...destination,
      width: destRect?.width ?? naturalSize.width,
      height: LANDED_STRIP_HEIGHT_PX,
    };
    const to: BoxState = { ...origin, ...naturalSize };

    await flyTo(
      chip,
      from,
      to,
      {
        backgroundColor: heroCandidate!.colour,
        borderWidth: "0px",
        borderRadius: "0px",
      },
      { backgroundColor: "#fff", borderWidth: "1px", borderRadius: "0.25rem" },
    );
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
