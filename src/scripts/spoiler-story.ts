import type { CandidateId } from "../lib/types";

// Drives the spoiler section's scrollytelling: as each .scroll-step scrolls
// into the centred band of the viewport, it goes from muted to ink colour
// and the sticky viz dims every candidate not named in its data-spotlight.
// Reversible by design -- state is a pure function of which step currently
// intersects the band, so scrolling back up fades a step (and its spotlight)
// out exactly as scrolling past it forward would. Mirrors the centred-band
// IntersectionObserver pattern in ballot-drift.ts's hero reveal, but needs no
// first-callback guard: unlike that one-shot flight animation, the very
// first callback here already reflects the correct initial CSS state.
export function initSpoilerStory(
  proseRoot: ParentNode,
  vizRoot: ParentNode,
): void {
  const steps = [...proseRoot.querySelectorAll<HTMLElement>(".scroll-step")];
  if (steps.length === 0) return;

  const view = steps[0].ownerDocument.defaultView;

  const stacks = new Map<CandidateId, Element>();
  for (const el of vizRoot.querySelectorAll("[data-candidate]")) {
    const id = el.getAttribute("data-candidate");
    if (id) stacks.set(id, el);
  }

  const sliders = [
    ...vizRoot.querySelectorAll<HTMLInputElement>(".candidate-stack-slider"),
  ];

  // Locked until the reader reaches the closing step (empty data-spotlight,
  // "try dragging the stacks yourself") -- so the stacks read as an
  // illustration of the prose while it's still making its point, not a
  // control the reader can wander off and fiddle with mid-explanation.
  function setSlidersLocked(locked: boolean): void {
    for (const slider of sliders) slider.disabled = locked;
  }

  function applySpotlight(step: HTMLElement): void {
    const raw = step.dataset.spotlight ?? "";
    const spotlighted = raw.length > 0 ? raw.split(",") : [];
    for (const [id, stack] of stacks) {
      stack.classList.toggle(
        "is-dimmed",
        spotlighted.length > 0 && !spotlighted.includes(id),
      );
    }
    setSlidersLocked(spotlighted.length > 0);
  }

  function clearSpotlight(): void {
    for (const stack of stacks.values()) stack.classList.remove("is-dimmed");
  }

  setSlidersLocked(true);

  if (!view || typeof view.IntersectionObserver !== "function") {
    for (const step of steps) step.classList.add("is-revealed");
    clearSpotlight();
    setSlidersLocked(false);
    return;
  }

  const observer = new view.IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const step = entry.target as HTMLElement;
        step.classList.toggle("is-revealed", entry.isIntersecting);
        if (entry.isIntersecting) applySpotlight(step);
      }
      if (!steps.some((step) => step.classList.contains("is-revealed"))) {
        clearSpotlight();
        setSlidersLocked(true);
      }
    },
    // Same centred band as the hero reveal in ballot-drift.ts -- a bare
    // threshold: 0 would fire the instant a step merely peeks into the
    // viewport, so a quick scroll up-then-down would flicker the reveal
    // and spotlight well before the reader has actually settled on it.
    { threshold: 0, rootMargin: "-35% 0px -35% 0px" },
  );
  for (const step of steps) observer.observe(step);
}
