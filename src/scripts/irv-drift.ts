import { createIrvController } from "../lib/irv-controller";
import { springTranslateKeyframes } from "../lib/spring";
import type { Candidate, CandidateId, Scenario } from "../lib/types";

const TOTAL_TRANSFER_CHIPS = 12;

// Largest-remainder allocation of a fixed number of visual chips across an
// eliminated candidate's transfer counts, proportional to how many ballots
// actually moved to each receiving candidate. Mirrors sampleAllocation's
// logic in ../lib/sample-ballots, but works from a plain transfers record
// rather than a whole Scenario, since that's all a round's transfer data is.
function allocateTransferChips(
  transfers: Record<CandidateId, number>,
  totalSamples: number,
): Record<CandidateId, number> {
  const ids = Object.keys(transfers);
  const total = ids.reduce((sum, id) => sum + transfers[id], 0);

  const allocation: Record<CandidateId, number> = {};
  if (total === 0) {
    for (const id of ids) allocation[id] = 0;
    return allocation;
  }

  const raw = ids.map((id) => (transfers[id] / total) * totalSamples);
  const floors = raw.map(Math.floor);
  let remainder = totalSamples - floors.reduce((sum, n) => sum + n, 0);

  ids.forEach((id, i) => {
    allocation[id] = floors[i];
  });

  const byRemainingFraction = ids
    .map((id, i) => ({ id, frac: raw[i] - floors[i] }))
    .sort((a, b) => b.frac - a.frac);

  for (const { id } of byRemainingFraction) {
    if (remainder <= 0) break;
    allocation[id]++;
    remainder--;
  }

  return allocation;
}

// Wires the IRV recount section's own drift animation: on a next() that just
// eliminated someone, spawns a small sample of mini ballot-paper chips flying
// from the eliminated candidate's stack to each receiving candidate's stack,
// proportioned to tally-irv's recorded transfer counts. Owns its own
// IrvController instance, independent of irv-app.ts's — the two are wired as
// siblings against the same root+scenario, the same pattern initApp and
// initBallotDrift already use.
export function initIrvDrift(root: ParentNode, scenario: Scenario): void {
  const container = root.querySelector<HTMLElement>("[data-ballot-drift]");
  const nextButton = root.querySelector<HTMLButtonElement>(
    'button[data-action="next-round"]',
  );
  if (!container || !nextButton) return;

  const doc = container.ownerDocument;
  const view = doc.defaultView;
  if (!view) return;

  const candidatesById = new Map<CandidateId, Candidate>(
    scenario.candidates.map((candidate) => [candidate.id, candidate]),
  );
  const controller = createIrvController(scenario);
  const reducedMotion =
    typeof view.matchMedia === "function" &&
    view.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function createMiniBallot(candidate: Candidate): HTMLElement {
    const chip = doc.createElement("span");
    chip.className = "ballot-paper ballot-paper-mini";
    chip.dataset.transferChipFor = candidate.id;
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
    if (typeof el.animate !== "function") {
      el.style.transform = `translate(${to.x}px, ${to.y}px)`;
      return;
    }
    el.animate(
      springTranslateKeyframes(from, to, { stiffness: 170, damping: 20 }),
      { duration: 600, fill: "forwards" },
    );
  }

  function spawnTransferChips(
    eliminatedId: CandidateId,
    transfers: Record<CandidateId, number>,
  ): void {
    const containerRect = container!.getBoundingClientRect();
    const fromTarget = root.querySelector<HTMLElement>(
      `[data-candidate="${eliminatedId}"]`,
    );
    const fromRect = fromTarget?.getBoundingClientRect();
    const from = {
      x: (fromRect?.left ?? containerRect.left) - containerRect.left,
      y: (fromRect?.top ?? containerRect.top) - containerRect.top,
    };

    const allocation = allocateTransferChips(transfers, TOTAL_TRANSFER_CHIPS);

    for (const [id, count] of Object.entries(allocation)) {
      const candidate = candidatesById.get(id);
      if (!candidate) continue;

      const target = root.querySelector<HTMLElement>(
        `[data-candidate="${id}"]`,
      );
      const targetRect = target?.getBoundingClientRect();
      const to = {
        x: (targetRect?.left ?? containerRect.left) - containerRect.left,
        y: (targetRect?.top ?? containerRect.top) - containerRect.top,
      };

      for (let i = 0; i < count; i++) {
        const chip = createMiniBallot(candidate);
        container!.appendChild(chip);
        flyTo(chip, from, to);
      }
    }
  }

  nextButton.addEventListener("click", () => {
    if (!controller.next()) return;
    if (reducedMotion) return;

    const eliminated = controller.justEliminated;
    const transfers = controller.justTransfers;
    if (!eliminated || !transfers) return;

    spawnTransferChips(eliminated, transfers);
  });
}
