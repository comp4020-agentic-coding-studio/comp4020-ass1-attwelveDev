import { drawBallot, hideBallotMarks } from "./ballot-marks";

// Drives the "why voters vote tactically" section's scrollytelling: the
// same reversible centred-band pattern as spoiler-story.ts (a .scroll-step's
// data-spotlight names which side of the sincere/tactical pair stays at full
// opacity, dimming the other), plus a one-shot extra layered on top: the
// first time a given ballot is spotlighted, its tick mark draws in by hand
// rather than sitting there already ticked -- mirroring ballot-marks.ts's
// fire-once-then-never-reverse contract, even though the dimming itself
// stays fully reversible on scrolling back up.
export function initStrategicStory(
  proseRoot: ParentNode,
  vizRoot: ParentNode,
): void {
  const steps = [...proseRoot.querySelectorAll<HTMLElement>(".scroll-step")];
  if (steps.length === 0) return;

  const view = steps[0].ownerDocument.defaultView;

  const ballots = new Map<string, HTMLElement>();
  for (const el of vizRoot.querySelectorAll<HTMLElement>("[data-ballot]")) {
    const id = el.getAttribute("data-ballot");
    if (id) ballots.set(id, el);
  }

  // Same "skip the animation entirely, leave CSS's fully-drawn default in
  // place" contract as ballot-marks.ts under reduced motion: never hide a
  // mark that would otherwise need an animated reveal to come back.
  const reducedMotion =
    !!view &&
    typeof view.matchMedia === "function" &&
    view.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!reducedMotion) {
    for (const ballot of ballots.values()) hideBallotMarks(ballot);
  }

  const drawn = new Set<string>();
  function revealMarks(id: string): void {
    if (reducedMotion || drawn.has(id)) return;
    const ballot = ballots.get(id);
    if (!ballot) return;
    drawn.add(id);
    drawBallot(ballot);
  }

  function applySpotlight(step: HTMLElement): void {
    const raw = step.dataset.spotlight ?? "";
    const spotlighted = raw.length > 0 ? raw.split(",") : [];
    for (const [id, ballot] of ballots) {
      const isSpotlighted = spotlighted.includes(id);
      ballot.classList.toggle(
        "is-dimmed",
        spotlighted.length > 0 && !isSpotlighted,
      );
      if (isSpotlighted) revealMarks(id);
    }
  }

  function clearSpotlight(): void {
    for (const ballot of ballots.values()) {
      ballot.classList.remove("is-dimmed");
    }
  }

  if (!view || typeof view.IntersectionObserver !== "function") {
    for (const step of steps) step.classList.add("is-revealed");
    clearSpotlight();
    for (const id of ballots.keys()) revealMarks(id);
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
      }
    },
    // Same centred band as spoiler-story.ts/ballot-drift.ts's hero reveal.
    { threshold: 0, rootMargin: "-35% 0px -35% 0px" },
  );
  for (const step of steps) observer.observe(step);
}
