import { createIrvController } from "../lib/irv-controller";
import type { Candidate, CandidateId, Scenario } from "../lib/types";

// DOM wiring for the IRV recount section. Reuses the explore/spoiler
// sections' [data-count-for] contract for the per-candidate counts, and adds
// a winner banner, a round-status line, and next/prev buttons that step
// through the irv-controller's round history one click at a time.
export function initIrvApp(root: ParentNode, scenario: Scenario): void {
  const controller = createIrvController(scenario);
  const candidatesById = new Map<CandidateId, Candidate>(
    scenario.candidates.map((candidate) => [candidate.id, candidate]),
  );

  const countEls = new Map<CandidateId, Element>();
  for (const el of root.querySelectorAll("[data-count-for]")) {
    const id = el.getAttribute("data-count-for");
    if (id) countEls.set(id, el);
  }

  const fillEls = new Map<CandidateId, HTMLElement>();
  for (const el of root.querySelectorAll<HTMLElement>("[data-fill-for]")) {
    const id = el.getAttribute("data-fill-for");
    if (id) fillEls.set(id, el);
  }
  // Scoped to these recount fills specifically (an inline style, not a
  // change to .candidate-stack-fill's own CSS rule): explore/spoiler use the
  // same class for continuously-dragged sliders, where an animated height
  // would feel laggy rather than instant.
  for (const fillEl of fillEls.values()) {
    fillEl.style.transition = "height 600ms ease";
  }

  const total = scenario.groups.reduce((sum, group) => sum + group.count, 0);

  const winnerEl = root.querySelector('[data-testid="winner"]');
  const statusEl = root.querySelector('[data-testid="round-status"]');
  const nextButton = root.querySelector<HTMLButtonElement>(
    'button[data-action="next-round"]',
  );
  const prevButton = root.querySelector<HTMLButtonElement>(
    'button[data-action="prev-round"]',
  );

  function render(): void {
    const round = controller.currentRound;

    for (const [id, el] of countEls) {
      const count = round.counts[id];
      el.textContent = count === undefined ? "eliminated" : String(count);
    }

    for (const [id, fillEl] of fillEls) {
      const count = round.counts[id] ?? 0;
      fillEl.style.setProperty(
        "--fill-pct",
        `${Math.round((count / total) * 100)}%`,
      );
    }

    if (statusEl) {
      const roundNumber = controller.roundIndex + 1;
      const eliminatedCandidate = controller.justEliminated
        ? candidatesById.get(controller.justEliminated)
        : null;
      statusEl.textContent = eliminatedCandidate
        ? `Round ${roundNumber}: ${eliminatedCandidate.label} is eliminated.`
        : `Round ${roundNumber}.`;
    }

    if (winnerEl) {
      const winnerCandidate = controller.winner
        ? candidatesById.get(controller.winner)
        : null;
      winnerEl.textContent = winnerCandidate
        ? `${winnerCandidate.label} wins after the recount.`
        : "";
    }

    if (nextButton) nextButton.disabled = controller.isFinal;
    if (prevButton) prevButton.disabled = controller.roundIndex === 0;
  }

  nextButton?.addEventListener("click", () => {
    if (controller.next()) render();
  });
  prevButton?.addEventListener("click", () => {
    if (controller.prev()) render();
  });

  render();
}
