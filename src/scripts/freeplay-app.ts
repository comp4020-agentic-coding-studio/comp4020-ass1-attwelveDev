import { ariaValueText } from "../lib/format";
import {
  addCandidate,
  moveRankingEntry,
  removeCandidate,
} from "../lib/freeplay-candidates";
import type { FreeplayState } from "../lib/freeplay-candidates";
import {
  FREEPLAY_MAX_CANDIDATES,
  FREEPLAY_MIN_CANDIDATES,
} from "../lib/freeplay-palette";
import { initialRankings, toScenario } from "../lib/freeplay-scenario";
import { redistribute } from "../lib/redistribute";
import { tallyFptp } from "../lib/tally-fptp";
import type { Candidate, CandidateId, Scenario } from "../lib/types";
import { initIrvApp } from "./irv-app";
import { initIrvDrift } from "./irv-drift";

interface CandidateEls {
  stack: HTMLElement;
  fill: HTMLElement;
  slider: HTMLInputElement;
  countEl: HTMLElement;
  rankingGroup: HTMLElement;
}

type Mode = "fptp" | "irv";

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
    rankings: initialRankings(scenario),
  };
  let mode: Mode = "fptp";

  const columnsEl = root.querySelector("[data-freeplay-columns]");
  const winnerEl = root.querySelector<HTMLElement>('[data-testid="winner"]');
  const addButton = root.querySelector<HTMLButtonElement>(
    'button[data-action="add-candidate"]',
  );
  const switchButton = root.querySelector<HTMLButtonElement>(
    'button[data-action="switch-system"]',
  );
  const recountEl = root.querySelector<HTMLElement>("[data-freeplay-recount]");

  const ownerDoc = (columnsEl ?? addButton)?.ownerDocument;
  if (!ownerDoc) return;
  const doc: Document = ownerDoc;

  let elements = new Map<CandidateId, CandidateEls>();

  // toScenario turns the current rankings/counts into a real Scenario, so
  // this can just reuse tallyFptp's own tested tie-break instead of building
  // a throwaway placeholder ranking the way app.ts/irv-app.ts still do (they
  // have no real ranking data of their own to draw on).
  function currentWinner(): CandidateId {
    return tallyFptp(toScenario(state)).winner;
  }

  function buildRankingList(list: HTMLElement, ownerId: CandidateId): void {
    const ranking = state.rankings[ownerId] ?? [];
    const candidatesById = new Map(state.candidates.map((c) => [c.id, c]));
    const owner = candidatesById.get(ownerId);

    list.replaceChildren(
      ...ranking.map((candidateId, index) => {
        const other = candidatesById.get(candidateId);
        const otherLabel = other?.label ?? candidateId;
        const ownerLabel = owner?.label ?? ownerId;
        const item = doc.createElement("li");

        const labelEl = doc.createElement("span");
        labelEl.textContent = otherLabel;

        const upButton = doc.createElement("button");
        upButton.type = "button";
        upButton.dataset.action = "move-ranking-up";
        upButton.dataset.candidateId = candidateId;
        upButton.setAttribute(
          "aria-label",
          `Move ${otherLabel} up in ${ownerLabel}'s ranking`,
        );
        upButton.textContent = "↑";
        upButton.disabled = index === 0;
        upButton.addEventListener("click", () => {
          state = moveRankingEntry(state, ownerId, candidateId, "up");
          buildRankingList(list, ownerId);
          if (mode === "irv") rebuildRecount();
        });

        const downButton = doc.createElement("button");
        downButton.type = "button";
        downButton.dataset.action = "move-ranking-down";
        downButton.dataset.candidateId = candidateId;
        downButton.setAttribute(
          "aria-label",
          `Move ${otherLabel} down in ${ownerLabel}'s ranking`,
        );
        downButton.textContent = "↓";
        downButton.disabled = index === ranking.length - 1;
        downButton.addEventListener("click", () => {
          state = moveRankingEntry(state, ownerId, candidateId, "down");
          buildRankingList(list, ownerId);
          if (mode === "irv") rebuildRecount();
        });

        item.append(labelEl, upButton, downButton);
        return item;
      }),
    );
  }

  function buildRankingGroup(candidate: Candidate): HTMLElement {
    const group = doc.createElement("div");
    group.className = "freeplay-ranking-group";
    group.hidden = mode === "fptp";

    const caption = doc.createElement("p");
    caption.className = "freeplay-ranking-caption";
    caption.textContent = `If ${candidate.label} is eliminated, next preference order:`;

    const list = doc.createElement("ol");
    list.className = "freeplay-ranking";
    list.dataset.rankingFor = candidate.id;
    buildRankingList(list, candidate.id);

    group.append(caption, list);
    return group;
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
          if (mode === "irv") rebuildRecount();
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
          if (mode === "irv") rebuildRecount();
        });

        const rankingGroup = buildRankingGroup(candidate);

        stack.append(
          swatch,
          label,
          leaderBadge,
          bar,
          countEl,
          removeButton,
          rankingGroup,
        );
        column.append(stack);

        nextElements.set(candidate.id, {
          stack,
          fill,
          slider,
          countEl,
          rankingGroup,
        });
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
      els.rankingGroup.hidden = mode === "fptp";
    }

    if (addButton) {
      addButton.disabled = state.candidates.length >= FREEPLAY_MAX_CANDIDATES;
    }

    if (winnerEl) {
      winnerEl.hidden = mode === "irv";
      const winnerCandidate = state.candidates.find((c) => c.id === winner);
      if (winnerCandidate) {
        winnerEl.textContent = `${winnerCandidate.label} is currently ahead.`;
      }
    }
  }

  function buildRecountStack(candidate: Candidate): HTMLElement {
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
    bar.append(fill);

    const countEl = doc.createElement("span");
    countEl.className = "candidate-stack-count";
    countEl.dataset.countFor = candidate.id;

    stack.append(swatch, label, leaderBadge, bar, countEl);
    column.append(stack);
    return column;
  }

  // The recount panel is wholly separate DOM from the editable stacks above,
  // matching the scripted #recount-app section's exact data-attribute
  // contract (candidate-columns[data-ballot-drift] of plain [data-candidate]
  // stacks, plus recount-status/recount-controls) so initIrvApp/initIrvDrift
  // run against it completely unchanged -- including the chip-flight
  // transfer animation, which depends on that data-ballot-drift attribute to
  // do anything at all. Rebuilt from scratch (never patched in place) on
  // every mode switch to "irv" and on every state-changing action taken
  // while already in "irv" mode, so it always restarts the walkthrough at
  // round 0 -- a changed vote is a new election.
  function rebuildRecount(): void {
    if (!recountEl) return;
    recountEl.hidden = mode === "fptp";
    if (mode === "fptp") return;

    const recountScenario = toScenario(state);

    const columns = doc.createElement("div");
    columns.className = "candidate-columns";
    columns.dataset.ballotDrift = "";
    columns.append(
      ...state.candidates.map((candidate) => buildRecountStack(candidate)),
    );

    const status = doc.createElement("div");
    status.className = "recount-status";
    const roundStatus = doc.createElement("p");
    roundStatus.dataset.testid = "round-status";
    roundStatus.setAttribute("aria-live", "polite");
    const winnerStatus = doc.createElement("p");
    winnerStatus.dataset.testid = "winner";
    winnerStatus.setAttribute("aria-live", "polite");
    status.append(roundStatus, winnerStatus);

    const controls = doc.createElement("div");
    controls.className = "recount-controls";
    const prevButton = doc.createElement("button");
    prevButton.type = "button";
    prevButton.dataset.action = "prev-round";
    prevButton.textContent = "Previous round";
    const nextButton = doc.createElement("button");
    nextButton.type = "button";
    nextButton.dataset.action = "next-round";
    nextButton.textContent = "Next round";
    controls.append(prevButton, nextButton);

    recountEl.replaceChildren(columns, status, controls);

    initIrvApp(recountEl, recountScenario);
    initIrvDrift(recountEl, recountScenario);
  }

  addButton?.addEventListener("click", () => {
    state = addCandidate(state, total);
    buildColumns();
    applyState();
    if (mode === "irv") rebuildRecount();
  });

  switchButton?.addEventListener("click", () => {
    mode = mode === "fptp" ? "irv" : "fptp";
    switchButton.textContent =
      mode === "fptp"
        ? "Switch to preferential voting"
        : "Switch to first-past-the-post";
    applyState();
    rebuildRecount();
  });

  buildColumns();
  applyState();
}
