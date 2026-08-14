import { sampleAllocation } from "../lib/sample-ballots";
import { springTranslateKeyframes } from "../lib/spring";
import type { Scenario } from "../lib/types";

const TOTAL_SAMPLE_DOTS = 24;
const DRIFT_DISTANCE_PX = 60;

// Animates a small representative sample of ballot dots drifting down into
// each candidate's stack, triggered once the section scrolls into view.
// Skips straight to the final position for prefers-reduced-motion, and
// degrades gracefully (immediate placement, no animation) wherever
// IntersectionObserver or Element.animate aren't available at all.
export function initBallotDrift(root: ParentNode, scenario: Scenario): void {
  const container = root.querySelector<HTMLElement>("[data-ballot-drift]");
  if (!container) return;

  const doc = container.ownerDocument;
  const view = doc.defaultView;
  if (!view) return;

  const allocation = sampleAllocation(scenario, TOTAL_SAMPLE_DOTS);
  const reducedMotion =
    typeof view.matchMedia === "function" &&
    view.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function placeDots(): void {
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
        const dot = doc.createElement("span");
        dot.className = "ballot-dot";
        dot.dataset.ballotDotFor = candidate.id;
        dot.style.setProperty("--dot-colour", candidate.colour);
        container!.appendChild(dot);

        if (reducedMotion || typeof dot.animate !== "function") {
          dot.style.transform = `translate(${to.x}px, ${to.y}px)`;
          continue;
        }

        dot.animate(springTranslateKeyframes(from, to, { stiffness: 170, damping: 20 }), {
          duration: 600,
          fill: "forwards",
        });
      }
    }
  }

  if (typeof view.IntersectionObserver === "function") {
    const observer = new view.IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            placeDots();
            observer.disconnect();
          }
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(container);
  } else {
    placeDots();
  }
}
