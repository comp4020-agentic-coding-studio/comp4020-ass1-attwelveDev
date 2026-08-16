// Fades a plain, single-paragraph chapter's prose between muted and ink
// colour as it scrolls through the centred band of the viewport, reusing
// .scroll-step/.is-revealed as-is -- the same treatment the spoiler and
// strategic-voting sections already give their multi-beat prose. Simpler
// than spoiler-story.ts/strategic-story.ts: there's only ever one step here
// and no viz spotlight to drive, so no first-callback guard, slider-locking,
// or spotlight bookkeeping is needed.
export function initChapterFade(root: ParentNode): void {
  const steps = [...root.querySelectorAll<HTMLElement>(".scroll-step")];
  if (steps.length === 0) return;

  const view = steps[0].ownerDocument.defaultView;

  if (!view || typeof view.IntersectionObserver !== "function") {
    for (const step of steps) step.classList.add("is-revealed");
    return;
  }

  const observer = new view.IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        entry.target.classList.toggle("is-revealed", entry.isIntersecting);
      }
    },
    // Same centred band as spoiler-story.ts/strategic-story.ts, so a quick
    // scroll up-then-down doesn't flicker the reveal.
    { threshold: 0, rootMargin: "-35% 0px -35% 0px" },
  );
  for (const step of steps) observer.observe(step);
}
