import { ariaValueText } from "../lib/format";
import { redistribute } from "../lib/redistribute";
import { tallyFptp } from "../lib/tally-fptp";
import type { Candidate, CandidateId, Scenario } from "../lib/types";

// Owns the one mutable piece of state (the current per-candidate counts) and
// keeps every slider, count readout, and winner banner in sync with it. This
// is the explore section's FPTP-only wiring; the IRV recount section (step 6)
// extends this with its own controller rather than branching this one.
export function initApp(root: ParentNode, scenario: Scenario): void {
  const total = scenario.groups.reduce((sum, group) => sum + group.count, 0);
  const candidatesById = new Map<CandidateId, Candidate>(
    scenario.candidates.map((candidate) => [candidate.id, candidate]),
  );

  let counts = tallyFptp(scenario).counts;

  const sliders = new Map<CandidateId, HTMLInputElement>();
  for (const slider of root.querySelectorAll<HTMLInputElement>(
    'input[type="range"][data-slider-for]',
  )) {
    const id = slider.dataset.sliderFor;
    if (id) sliders.set(id, slider);
  }

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

  const stackEls = new Map<CandidateId, Element>();
  for (const el of root.querySelectorAll("[data-candidate]")) {
    const id = el.getAttribute("data-candidate");
    if (id) stackEls.set(id, el);
  }

  const winnerEl = root.querySelector('[data-testid="winner"]');

  // Only the first preference in each synthetic ranking is ever read by
  // tallyFptp, so the placeholder order of the remaining candidates doesn't
  // matter — this just turns the current counts back into a Scenario so the
  // one tested tie-break rule in tallyFptp stays the single source of truth.
  function currentWinner(): CandidateId {
    const ids = scenario.candidates.map((c) => c.id);
    const synthetic: Scenario = {
      candidates: scenario.candidates,
      groups: ids.map((id) => ({
        ranking: [id, ...ids.filter((other) => other !== id)],
        count: counts[id],
      })),
    };
    return tallyFptp(synthetic).winner;
  }

  function render(): void {
    for (const candidate of scenario.candidates) {
      const count = counts[candidate.id];

      const slider = sliders.get(candidate.id);
      if (slider) {
        slider.min = "0";
        slider.max = String(total);
        slider.value = String(count);
        slider.setAttribute(
          "aria-valuetext",
          ariaValueText(candidate, count, total),
        );
      }

      const countEl = countEls.get(candidate.id);
      if (countEl) countEl.textContent = String(count);

      const fillEl = fillEls.get(candidate.id);
      if (fillEl) {
        fillEl.style.setProperty(
          "--fill-pct",
          `${Math.round((count / total) * 100)}%`,
        );
      }
    }

    const winner = currentWinner();
    for (const [id, stackEl] of stackEls) {
      stackEl.classList.toggle("is-leading", id === winner);
    }

    const winnerCandidate = candidatesById.get(winner);
    if (winnerEl && winnerCandidate) {
      winnerEl.textContent = `${winnerCandidate.label} is currently ahead.`;
    }
  }

  for (const [id, slider] of sliders) {
    slider.addEventListener("input", () => {
      counts = redistribute(counts, id, Number(slider.value), total);
      render();
    });
  }

  render();
}
