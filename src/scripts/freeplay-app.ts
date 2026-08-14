import { ariaValueText } from "../lib/format";
import { addCandidate, removeCandidate } from "../lib/freeplay-candidates";
import type { FreeplayState } from "../lib/freeplay-candidates";
import { FREEPLAY_MAX_CANDIDATES, FREEPLAY_MIN_CANDIDATES } from "../lib/freeplay-palette";
import { redistribute } from "../lib/redistribute";
import { tallyFptp } from "../lib/tally-fptp";
import type { CandidateId, Scenario } from "../lib/types";

interface CandidateEls {
  stack: HTMLElement;
  fill: HTMLElement;
  slider: HTMLInputElement;
  countEl: HTMLElement;
}

// Free play is the only section where candidates themselves come and go, so
// unlike initApp/initIrvApp (which wire up markup Astro already rendered),
// this owns the DOM structure too. buildColumns() rebuilds the stacks from
// scratch, but only add/remove-candidate call it -- a slider drag must never
// have its own <input> node replaced mid-gesture (that silently drops the
// browser's native drag capture, turning a continuous drag into a single
// click), so every ordinary vote-count change goes through applyState()
// instead, which only patches the existing elements buildColumns() made.
export function initFreeplayApp(root: ParentNode, scenario: Scenario): void {
  const total = scenario.groups.reduce((sum, group) => sum + group.count, 0);

  let state: FreeplayState = {
    candidates: scenario.candidates,
    counts: tallyFptp(scenario).counts,
  };

  const columnsEl = root.querySelector("[data-freeplay-columns]");
  const winnerEl = root.querySelector('[data-testid="winner"]');
  const addButton = root.querySelector<HTMLButtonElement>(
    'button[data-action="add-candidate"]',
  );

  const ownerDoc = (columnsEl ?? addButton)?.ownerDocument;
  if (!ownerDoc) return;
  const doc: Document = ownerDoc;

  let elements = new Map<CandidateId, CandidateEls>();

  // Same trick initApp's currentWinner() uses: only the first preference in
  // each synthetic ranking is ever read by tallyFptp, so this just reuses its
  // one tested tie-break rule instead of duplicating it here.
  function currentWinner(): CandidateId {
    const ids = state.candidates.map((c) => c.id);
    const synthetic: Scenario = {
      candidates: state.candidates,
      groups: ids.map((id) => ({
        ranking: [id, ...ids.filter((other) => other !== id)],
        count: state.counts[id]!,
      })),
    };
    return tallyFptp(synthetic).winner;
  }

  function buildColumns(): void {
    if (!columnsEl) return;
    const nextElements = new Map<CandidateId, CandidateEls>();

    columnsEl.replaceChildren(
      ...state.candidates.map((candidate) => {
        const column = doc.createElement("div");
        column.className = "candidate-column";

        const stack = doc.createElement("div");
        stack.className = "candidate-stack";
        stack.dataset.candidate = candidate.id;

        const swatch = doc.createElement("span");
        swatch.className = `candidate-stack-swatch candidate-stack-swatch-${candidate.shape}`;
        swatch.style.setProperty("--swatch-colour", candidate.colour);
        swatch.setAttribute("aria-hidden", "true");

        const label = doc.createElement("span");
        label.className = "candidate-stack-label";
        label.textContent = candidate.label;

        const leaderBadge = doc.createElement("span");
        leaderBadge.className = "candidate-stack-leader-badge";
        leaderBadge.setAttribute("aria-hidden", "true");
        leaderBadge.textContent = "Leading";

        const bar = doc.createElement("div");
        bar.className = "candidate-stack-bar";

        const fill = doc.createElement("div");
        fill.className = "candidate-stack-fill";
        fill.dataset.fillFor = candidate.id;
        fill.style.setProperty("--swatch-colour", candidate.colour);

        const slider = doc.createElement("input");
        slider.type = "range";
        slider.className = "candidate-stack-slider";
        slider.dataset.sliderFor = candidate.id;
        slider.setAttribute("aria-label", candidate.label);
        slider.min = "0";
        slider.max = String(total);
        slider.addEventListener("input", () => {
          state = {
            ...state,
            counts: redistribute(
              state.counts,
              candidate.id,
              Number(slider.value),
              total,
            ),
          };
          applyState();
        });

        bar.append(fill, slider);

        const countEl = doc.createElement("span");
        countEl.className = "candidate-stack-count";
        countEl.dataset.countFor = candidate.id;

        const removeButton = doc.createElement("button");
        removeButton.type = "button";
        removeButton.dataset.action = "remove-candidate";
        removeButton.dataset.candidateId = candidate.id;
        removeButton.textContent = `Remove ${candidate.label}`;
        removeButton.disabled =
          state.candidates.length <= FREEPLAY_MIN_CANDIDATES;
        removeButton.addEventListener("click", () => {
          state = removeCandidate(state, candidate.id, total);
          buildColumns();
          applyState();
        });

        stack.append(swatch, label, leaderBadge, bar, countEl, removeButton);
        column.append(stack);

        nextElements.set(candidate.id, { stack, fill, slider, countEl });
        return column;
      }),
    );

    elements = nextElements;
  }

  // Patches every candidate's existing elements to match the current state,
  // without touching DOM node identity -- safe to call on every vote-count
  // change, including mid-drag.
  function applyState(): void {
    const winner = currentWinner();

    for (const candidate of state.candidates) {
      const count = state.counts[candidate.id]!;
      const els = elements.get(candidate.id);
      if (!els) continue;

      els.stack.classList.toggle("is-leading", candidate.id === winner);
      els.fill.style.setProperty(
        "--fill-pct",
        `${Math.round((count / total) * 100)}%`,
      );
      els.slider.value = String(count);
      els.slider.setAttribute(
        "aria-valuetext",
        ariaValueText(candidate, count, total),
      );
      els.countEl.textContent = String(count);
    }

    if (addButton) {
      addButton.disabled = state.candidates.length >= FREEPLAY_MAX_CANDIDATES;
    }

    const winnerCandidate = state.candidates.find((c) => c.id === winner);
    if (winnerEl && winnerCandidate) {
      winnerEl.textContent = `${winnerCandidate.label} is currently ahead.`;
    }
  }

  addButton?.addEventListener("click", () => {
    state = addCandidate(state, total);
    buildColumns();
    applyState();
  });

  buildColumns();
  applyState();
}
