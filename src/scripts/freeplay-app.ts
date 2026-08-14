import { ariaValueText } from "../lib/format";
import { addCandidate, removeCandidate } from "../lib/freeplay-candidates";
import type { FreeplayState } from "../lib/freeplay-candidates";
import { FREEPLAY_MAX_CANDIDATES, FREEPLAY_MIN_CANDIDATES } from "../lib/freeplay-palette";
import { redistribute } from "../lib/redistribute";
import { tallyFptp } from "../lib/tally-fptp";
import type { CandidateId, Scenario } from "../lib/types";

// Free play is the only section where candidates themselves come and go, so
// unlike initApp/initIrvApp (which wire up markup Astro already rendered),
// this owns the DOM structure too: every render rebuilds the stacks and
// sliders containers from scratch rather than patching existing elements.
export function initFreeplayApp(root: ParentNode, scenario: Scenario): void {
  const total = scenario.groups.reduce((sum, group) => sum + group.count, 0);

  let state: FreeplayState = {
    candidates: scenario.candidates,
    counts: tallyFptp(scenario).counts,
  };

  const stacksEl = root.querySelector("[data-freeplay-stacks]");
  const slidersEl = root.querySelector("[data-freeplay-sliders]");
  const winnerEl = root.querySelector('[data-testid="winner"]');
  const addButton = root.querySelector<HTMLButtonElement>(
    'button[data-action="add-candidate"]',
  );

  const ownerDoc = (stacksEl ?? slidersEl ?? addButton)?.ownerDocument;
  if (!ownerDoc) return;
  const doc: Document = ownerDoc;

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

  function render(): void {
    if (stacksEl) {
      stacksEl.replaceChildren(
        ...state.candidates.map((candidate) => {
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

          const bar = doc.createElement("div");
          bar.className = "candidate-stack-bar";

          const fill = doc.createElement("div");
          fill.className = "candidate-stack-fill";
          fill.dataset.fillFor = candidate.id;
          fill.style.setProperty("--swatch-colour", candidate.colour);
          fill.style.setProperty(
            "--fill-pct",
            `${Math.round((state.counts[candidate.id]! / total) * 100)}%`,
          );
          bar.append(fill);

          const count = doc.createElement("span");
          count.className = "candidate-stack-count";
          count.dataset.countFor = candidate.id;
          count.textContent = String(state.counts[candidate.id]);

          const removeButton = doc.createElement("button");
          removeButton.type = "button";
          removeButton.dataset.action = "remove-candidate";
          removeButton.dataset.candidateId = candidate.id;
          removeButton.textContent = `Remove ${candidate.label}`;
          removeButton.disabled =
            state.candidates.length <= FREEPLAY_MIN_CANDIDATES;
          removeButton.addEventListener("click", () => {
            state = removeCandidate(state, candidate.id, total);
            render();
          });

          stack.append(swatch, label, bar, count, removeButton);
          return stack;
        }),
      );
    }

    if (slidersEl) {
      slidersEl.replaceChildren(
        ...state.candidates.map((candidate) => {
          const count = state.counts[candidate.id]!;

          const wrapper = doc.createElement("label");
          wrapper.className = "vote-slider";

          const label = doc.createElement("span");
          label.className = "vote-slider-label";
          label.textContent = candidate.label;

          const slider = doc.createElement("input");
          slider.type = "range";
          slider.dataset.sliderFor = candidate.id;
          slider.min = "0";
          slider.max = String(total);
          slider.value = String(count);
          slider.setAttribute(
            "aria-valuetext",
            ariaValueText(candidate, count, total),
          );
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
            render();
          });

          wrapper.append(label, slider);
          return wrapper;
        }),
      );
    }

    if (addButton) {
      addButton.disabled = state.candidates.length >= FREEPLAY_MAX_CANDIDATES;
    }

    const winnerCandidate = state.candidates.find(
      (c) => c.id === currentWinner(),
    );
    if (winnerEl && winnerCandidate) {
      winnerEl.textContent = `${winnerCandidate.label} is currently ahead.`;
    }
  }

  addButton?.addEventListener("click", () => {
    state = addCandidate(state, total);
    render();
  });

  render();
}
