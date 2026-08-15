const DRAW_DURATION_MS = 350;
// A real voter fills a preferential ballot down their own ranking (1, then
// 2, then 3), not top-to-bottom in printed order, so each numeral's draw is
// staggered by its data-pref-rank rather than by DOM position.
const NUMERAL_STAGGER_MS = 280;
const DRAW_EASING = "ease-in-out";

// Strokes a hand-authored SVG path in from nothing, the standard
// getTotalLength()/dasharray/dashoffset technique. CSS defaults every
// .ballot-paper-mark path to stroke-dashoffset: 0 (fully drawn), so this
// only sets the hidden starting state once it has a real length to animate
// from and is about to actually play the reveal -- a slow script or a
// missing Element.animate/getTotalLength never leaves a mark invisible.
function drawPath(path: SVGPathElement, delay: number): void {
  if (typeof path.animate !== "function") return;
  const length = path.getTotalLength();
  path.style.strokeDasharray = `${length}`;
  path.style.strokeDashoffset = `${length}`;
  path.animate([{ strokeDashoffset: length }, { strokeDashoffset: 0 }], {
    duration: DRAW_DURATION_MS,
    delay,
    easing: DRAW_EASING,
    fill: "forwards",
  });
}

function drawBallot(ballot: HTMLElement): void {
  const checkPath = ballot.querySelector<SVGPathElement>(
    ".ballot-paper-check-mark path",
  );
  if (checkPath) drawPath(checkPath, 0);

  const numberBoxes = [
    ...ballot.querySelectorAll<HTMLElement>(".ballot-paper-number-box"),
  ].sort((a, b) => Number(a.dataset.prefRank) - Number(b.dataset.prefRank));
  numberBoxes.forEach((box, index) => {
    const path = box.querySelector<SVGPathElement>(
      ".ballot-paper-number-mark path",
    );
    if (path) drawPath(path, index * NUMERAL_STAGGER_MS);
  });
}

// Animates each full ballot paper's tick/preference-number marks in with a
// hand-drawn stroke the first time it scrolls into a centred view --
// mirrors ballot-drift.ts's swarm observer (fire once on the first
// intersecting report, disconnect), not its hero observer's bidirectional
// transition guard, since a ballot's marks only ever need to draw once,
// never reverse. Skips animating entirely under prefers-reduced-motion or
// without IntersectionObserver support, leaving CSS's fully-drawn default in
// place rather than animating on load.
export function initBallotMarks(root: ParentNode): void {
  const doc = root.ownerDocument ?? (root as Document);
  const view = doc.defaultView;
  if (!view) return;

  const reducedMotion =
    typeof view.matchMedia === "function" &&
    view.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) return;

  const ballots = root.querySelectorAll<HTMLElement>(".ballot-paper-full");
  if (typeof view.IntersectionObserver !== "function") {
    for (const ballot of ballots) drawBallot(ballot);
    return;
  }

  for (const ballot of ballots) {
    const observer = new view.IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            drawBallot(ballot);
            observer.disconnect();
          }
        }
      },
      { threshold: 0, rootMargin: "-35% 0px -35% 0px" },
    );
    observer.observe(ballot);
  }
}
