import { tieNote, tiedCandidateIds, winnerAnnouncement } from "../lib/format";
import { createIrvController } from "../lib/irv-controller";
import { tallyFptp } from "../lib/tally-fptp";
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

  const stackEls = new Map<CandidateId, HTMLElement>();
  for (const el of root.querySelectorAll<HTMLElement>("[data-candidate]")) {
    const id = el.getAttribute("data-candidate");
    if (id) stackEls.set(id, el);
  }

  // Each stack still renders the same draggable-slider markup as
  // explore/spoiler (CandidateStack.astro), but a recount isn't something
  // the reader adjusts -- disable it here rather than leaving a focusable
  // control that silently does nothing when dragged.
  for (const slider of root.querySelectorAll<HTMLInputElement>(
    ".candidate-stack-slider",
  )) {
    slider.disabled = true;
  }

  // Round 1's leader (highest count so far, before any elimination) isn't
  // necessarily who the recount ends up crowning -- that gap is the whole
  // point of this section -- so it's computed the same way the FPTP
  // explore/spoiler sections compute theirs (app.ts's currentWinner()): a
  // synthetic single-preference tally over whichever candidates are still
  // active this round, reusing tallyFptp's tie-break rather than
  // duplicating it.
  function currentLeader(counts: Record<CandidateId, number>): CandidateId {
    const ids = Object.keys(counts);
    const synthetic: Scenario = {
      candidates: ids.map((id) => candidatesById.get(id)!),
      groups: ids.map((id) => ({
        ranking: [id, ...ids.filter((other) => other !== id)],
        count: counts[id],
      })),
    };
    return tallyFptp(synthetic).winner;
  }

  const view = fillEls.values().next().value?.ownerDocument.defaultView;
  const reducedMotion =
    typeof view?.matchMedia === "function" &&
    view.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Scoped to these recount fills specifically (an inline style, not a
  // change to .candidate-stack-fill's own CSS rule): explore/spoiler use the
  // same class for continuously-dragged sliders, where an animated height
  // would feel laggy rather than instant.
  if (!reducedMotion) {
    for (const fillEl of fillEls.values()) {
      fillEl.style.transition = "height 600ms ease";
    }
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

    const winner = controller.winner;
    const leader = winner ? null : currentLeader(round.counts);

    if (statusEl) {
      const roundNumber = controller.roundIndex + 1;
      const eliminatedCandidate = controller.justEliminated
        ? candidatesById.get(controller.justEliminated)
        : null;
      const leaderCandidate = leader ? candidatesById.get(leader) : null;
      const eliminatedTie = tieNote(
        controller.justEliminatedTiedWith.map(
          (id) => candidatesById.get(id)!.label,
        ),
        "fewest votes",
      );
      const leaderTie = leader
        ? tieNote(
            tiedCandidateIds(round.counts, leader).map(
              (id) => candidatesById.get(id)!.label,
            ),
            "votes",
          )
        : "";
      statusEl.textContent = eliminatedCandidate
        ? `Round ${roundNumber}: ${eliminatedCandidate.label} is eliminated.${eliminatedTie}`
        : leaderCandidate
          ? `Round ${roundNumber}: ${leaderCandidate.label} is leading.${leaderTie}`
          : `Round ${roundNumber}.`;
    }

    if (winnerEl) {
      const winnerCandidate = winner ? candidatesById.get(winner) : null;
      winnerEl.textContent =
        winner && winnerCandidate
          ? winnerAnnouncement(winnerCandidate.label, round.counts[winner], total)
          : "";
    }

    if (nextButton) nextButton.disabled = controller.isFinal;
    if (prevButton) prevButton.disabled = controller.roundIndex === 0;

    for (const [id, stackEl] of stackEls) {
      const isWinner = id === winner;
      const isLeading = id === leader;
      stackEl.classList.toggle("is-winner", isWinner);
      stackEl.classList.toggle("is-leading", isLeading);
      const badge = stackEl.querySelector<HTMLElement>(
        ".candidate-stack-leader-badge",
      );
      if (badge && (isWinner || isLeading)) {
        badge.textContent = isWinner ? "Winner" : "Leading";
      }
    }
  }

  nextButton?.addEventListener("click", () => {
    if (controller.next()) render();
  });
  prevButton?.addEventListener("click", () => {
    if (controller.prev()) render();
  });

  render();
}
