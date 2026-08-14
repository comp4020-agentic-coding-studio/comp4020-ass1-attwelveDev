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
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
}

// Mirrors .ballot-paper-full's CSS padding (src/styles/global.css). The hero
// flight needs to animate padding down to 0 itself — under the clone's
// border-box sizing, an untouched padding is a floor the landed height can
// never cross, leaving clipped ballot text sitting on the candidate colour
// instead of a flattened line.
const HERO_HOME_PADDING = {
  paddingTop: "0.75rem",
  paddingRight: "1rem",
  paddingBottom: "0.75rem",
  paddingLeft: "1rem",
};
const HERO_LANDED_PADDING = {
  paddingTop: "0px",
  paddingRight: "0px",
  paddingBottom: "0px",
  paddingLeft: "0px",
};

function heroHomeStyle(): EdgeStyle {
  return {
    backgroundColor: "#fff",
    borderWidth: "1px",
    borderRadius: "0.25rem",
    ...HERO_HOME_PADDING,
  };
}

function heroLandedStyle(colour: string): EdgeStyle {
  return {
    backgroundColor: colour,
    borderWidth: "0px",
    borderRadius: "0px",
    ...HERO_LANDED_PADDING,
  };
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
    if (style.paddingTop !== undefined) el.style.paddingTop = style.paddingTop;
    if (style.paddingRight !== undefined) {
      el.style.paddingRight = style.paddingRight;
    }
    if (style.paddingBottom !== undefined) {
      el.style.paddingBottom = style.paddingBottom;
    }
    if (style.paddingLeft !== undefined) {
      el.style.paddingLeft = style.paddingLeft;
    }
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

  interface HeroFlight {
    chip: HTMLElement;
    naturalSize: { width: number; height: number };
    animation: Animation | null;
  }

  let heroFlight: HeroFlight | null = null;
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

  // The clone's actual current rendered box, mid-flight or otherwise —
  // unlike a cached from/to value, this is true regardless of which
  // Animation (if any) is currently driving it.
  function currentHeroBox(chip: HTMLElement): BoxState {
    const containerRect = container!.getBoundingClientRect();
    const chipRect = chip.getBoundingClientRect();
    return {
      x: chipRect.left - containerRect.left,
      y: chipRect.top - containerRect.top,
      width: chipRect.width,
      height: chipRect.height,
    };
  }

  function landedBoxFor(naturalSize: { width: number; height: number }): BoxState {
    const destRect = fillRectFor(heroCandidate!.id);
    return {
      ...heroDestination(),
      width: destRect?.width ?? naturalSize.width,
      height: LANDED_STRIP_HEIGHT_PX,
    };
  }

  function createHeroClone(): {
    chip: HTMLElement;
    naturalSize: { width: number; height: number };
  } {
    const clone = hero!.cloneNode(true) as HTMLElement;
    clone.removeAttribute("data-hero-ballot");
    clone.dataset.heroBallotChip = "";
    clone.setAttribute("aria-hidden", "true");
    clone.style.position = "absolute";
    clone.style.top = "0";
    clone.style.left = "0";
    clone.style.margin = "0";
    clone.style.overflow = "hidden";
    clone.style.pointerEvents = "none";
    container!.appendChild(clone);

    // Measure before switching box-sizing: the real hero renders under the
    // default content-box, so this natural size must match it exactly, or
    // the reverse flight grows back to the wrong (short) width.
    const naturalRect = clone.getBoundingClientRect();
    clone.style.boxSizing = "border-box";

    return {
      chip: clone,
      naturalSize: { width: naturalRect.width, height: naturalRect.height },
    };
  }

  // Runs (or redirects) one leg of the hero's flight. `fadeOutAtEnd` folds an
  // opacity ramp into the same keyframe list/inline-style application as the
  // shape/colour change, rather than a separate animation: that way a
  // mid-flight redirect only ever has one Animation to cancel, and
  // cancelling it always reverts opacity along with everything else.
  function runHeroFlight(
    chip: HTMLElement,
    from: BoxState,
    to: BoxState,
    fromStyle: EdgeStyle,
    toStyle: EdgeStyle,
    fadeOutAtEnd: boolean,
  ): { animation: Animation | null; finished: Promise<void> } {
    if (reducedMotion || typeof chip.animate !== "function") {
      chip.style.transform = `translate(${to.x}px, ${to.y}px)`;
      chip.style.width = `${to.width}px`;
      chip.style.height = `${to.height}px`;
      applyEdgeStyle(chip, toStyle);
      chip.style.opacity = fadeOutAtEnd ? "0" : "1";
      return { animation: null, finished: Promise.resolve() };
    }

    const frames = springBoxKeyframes(from, to, { stiffness: 170, damping: 20 });
    frames[0] = { ...frames[0], ...fromStyle, opacity: 1 };
    frames[frames.length - 1] = {
      ...frames[frames.length - 1],
      ...toStyle,
      opacity: fadeOutAtEnd ? 0 : 1,
    };
    if (fadeOutAtEnd) {
      // Hold fully opaque through most of the flight, then fade quickly at
      // the very end — a "lands, then vanishes" beat, not a gradual fade
      // while it's still visibly morphing shape and colour.
      const holdIndex = Math.max(1, Math.floor((frames.length - 1) * 0.85));
      frames[holdIndex] = { ...frames[holdIndex], opacity: 1 };
    }

    const animation = chip.animate(frames, {
      duration: FLIGHT_DURATION_MS,
      fill: "forwards",
    });
    return { animation, finished: animation.finished.then(() => {}) };
  }

  async function flyForward(): Promise<void> {
    if (heroAway) return;
    heroAway = true;
    fadeHero(hero!, 0);

    let chip: HTMLElement;
    let naturalSize: { width: number; height: number };
    let from: BoxState;

    if (heroFlight) {
      // A backward flight was interrupted before it finished (or before its
      // own cleanup ran) — reuse its clone and continue from wherever it
      // actually currently is, not a stale precomputed value.
      chip = heroFlight.chip;
      naturalSize = heroFlight.naturalSize;
      from = currentHeroBox(chip);
      heroFlight.animation?.cancel?.();
    } else {
      const created = createHeroClone();
      chip = created.chip;
      naturalSize = created.naturalSize;
      from = { ...heroOrigin(), ...naturalSize };
    }

    const to = landedBoxFor(naturalSize);
    const { animation, finished } = runHeroFlight(
      chip,
      from,
      to,
      heroHomeStyle(),
      heroLandedStyle(heroCandidate!.colour),
      true,
    );
    heroFlight = { chip, naturalSize, animation };

    await finished;
    if (heroFlight?.animation === animation) {
      chip.remove();
      heroFlight = null;
    }
  }

  async function flyBackward(): Promise<void> {
    if (!heroAway) return;
    heroAway = false;
    fadeHero(hero!, 1);

    let chip: HTMLElement;
    let naturalSize: { width: number; height: number };
    let from: BoxState;

    if (heroFlight) {
      chip = heroFlight.chip;
      naturalSize = heroFlight.naturalSize;
      from = heroFlight.animation
        ? currentHeroBox(chip)
        : landedBoxFor(naturalSize);
      heroFlight.animation?.cancel?.();
    } else {
      // The previous forward flight already finished and cleaned itself up
      // — nothing to reuse, so spawn a fresh clone and snap it straight to
      // the already-landed look before growing it back.
      const created = createHeroClone();
      chip = created.chip;
      naturalSize = created.naturalSize;
      from = landedBoxFor(naturalSize);
      applyEdgeStyle(chip, heroLandedStyle(heroCandidate!.colour));
      chip.style.transform = `translate(${from.x}px, ${from.y}px)`;
      chip.style.width = `${from.width}px`;
      chip.style.height = `${from.height}px`;
    }

    const to: BoxState = { ...heroOrigin(), ...naturalSize };
    const { animation, finished } = runHeroFlight(
      chip,
      from,
      to,
      heroLandedStyle(heroCandidate!.colour),
      heroHomeStyle(),
      false,
    );
    heroFlight = { chip, naturalSize, animation };

    await finished;
    if (heroFlight?.animation === animation) {
      chip.remove();
      heroFlight = null;
    }
  }

  if (typeof view.IntersectionObserver === "function") {
    let hasObservedHero = false;
    const heroObserver = new view.IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!hasObservedHero) {
            // The observer's very first report just reflects whatever the
            // hero's state happens to be at observe() time (e.g. already
            // below the fold at page load) — not a real scroll transition.
            hasObservedHero = true;
            continue;
          }
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
