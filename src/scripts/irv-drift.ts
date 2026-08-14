import { createIrvController } from "../lib/irv-controller";
import type { BoxState } from "../lib/spring";
import { springBoxKeyframes } from "../lib/spring";
import type { Candidate, CandidateId, Scenario } from "../lib/types";

// Within PLAN.md's documented "roughly 15-30" representative-sample range —
// pushed toward the top of it so a receiving candidate's stream of arrivals
// reads as substantial rather than a token few.
const TOTAL_TRANSFER_CHIPS = 28;
const FLIGHT_DURATION_MS = 600;
// Chips for the same receiver stagger their departure across this window
// instead of all launching at once, so the transfer reads as a gradual
// stream rather than a single simultaneous jump. Each chip's own flight
// duration is shortened by however much its departure was delayed, so the
// whole batch still finishes at FLIGHT_DURATION_MS — the same moment the
// receiving stack's own --fill-pct CSS transition finishes growing.
const STAGGER_WINDOW_MS = 350;
// Mirrors ballot-drift.ts's landed shape: the coloured stack bar is a stack
// of ballot papers seen edge-on, so a landed chip flattens into a thin
// colour-matched line rather than staying a small white rectangle.
const LANDED_STRIP_HEIGHT_PX = 3;

interface EdgeStyle {
  backgroundColor: string;
  borderWidth: string;
  borderRadius: string;
}

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

  // A real, nonzero transfer can still round down to 0 chips for a
  // small-share receiver — that reads as "this stack grew for no visible
  // reason." Borrow one chip from whichever id currently holds the most
  // (as long as it can spare one), so every receiver gets at least a single
  // visible arrival.
  for (const id of ids) {
    if (transfers[id] <= 0 || allocation[id] > 0) continue;
    const donor = ids
      .filter((other) => allocation[other] > 1)
      .sort((a, b) => allocation[b] - allocation[a])[0];
    if (!donor) continue;
    allocation[donor]--;
    allocation[id]++;
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

  function applyEdgeStyle(el: HTMLElement, style: EdgeStyle): void {
    el.style.backgroundColor = style.backgroundColor;
    el.style.borderWidth = style.borderWidth;
    el.style.borderRadius = style.borderRadius;
  }

  function flyTo(
    el: HTMLElement,
    from: BoxState,
    to: BoxState,
    fromStyle: EdgeStyle,
    toStyle: EdgeStyle,
    delayMs: number,
  ): void {
    if (reducedMotion || typeof el.animate !== "function") {
      el.style.transform = `translate(${to.x}px, ${to.y}px)`;
      el.style.width = `${to.width}px`;
      el.style.height = `${to.height}px`;
      applyEdgeStyle(el, toStyle);
      return;
    }
    const frames = springBoxKeyframes(from, to, { stiffness: 170, damping: 20 });
    frames[0] = { ...frames[0], ...fromStyle };
    frames[frames.length - 1] = { ...frames[frames.length - 1], ...toStyle };
    el.animate(frames, {
      duration: FLIGHT_DURATION_MS - delayMs,
      delay: delayMs,
      fill: "forwards",
    });
  }

  function fadeOutMark(mark: HTMLElement, delayMs: number): void {
    if (reducedMotion || typeof mark.animate !== "function") {
      mark.style.opacity = "0";
      return;
    }
    mark.animate(
      [
        { opacity: 1, offset: 0 },
        { opacity: 0, offset: 0.5 },
        { opacity: 0, offset: 1 },
      ],
      { duration: FLIGHT_DURATION_MS - delayMs, delay: delayMs, fill: "forwards" },
    );
  }

  function spawnTransferChips(
    transfers: Record<CandidateId, number>,
    fromRect: DOMRect | undefined,
  ): void {
    const containerRect = container!.getBoundingClientRect();
    const from = {
      x: (fromRect?.left ?? containerRect.left) - containerRect.left,
      y: (fromRect?.top ?? containerRect.top) - containerRect.top,
    };

    const allocation = allocateTransferChips(transfers, TOTAL_TRANSFER_CHIPS);

    for (const [id, count] of Object.entries(allocation)) {
      const candidate = candidatesById.get(id);
      if (!candidate) continue;

      const target = root.querySelector<HTMLElement>(
        `[data-fill-for="${id}"]`,
      );
      const targetRect = target?.getBoundingClientRect();
      const toX = (targetRect?.left ?? containerRect.left) - containerRect.left;
      const toY = (targetRect?.top ?? containerRect.top) - containerRect.top;
      const to: BoxState = {
        x: toX,
        y: toY,
        width: targetRect?.width ?? containerRect.width,
        height: LANDED_STRIP_HEIGHT_PX,
      };

      for (let i = 0; i < count; i++) {
        const chip = createMiniBallot(candidate);
        container!.appendChild(chip);
        const naturalRect = chip.getBoundingClientRect();
        const fromBox: BoxState = {
          x: from.x,
          y: from.y,
          width: naturalRect.width,
          height: naturalRect.height,
        };

        const delayMs =
          count > 1 ? Math.round((i / count) * STAGGER_WINDOW_MS) : 0;

        const mark = chip.querySelector<HTMLElement>(
          ".ballot-paper-mini-mark",
        );
        if (mark) fadeOutMark(mark, delayMs);

        flyTo(
          chip,
          fromBox,
          to,
          { backgroundColor: "#fff", borderWidth: "1px", borderRadius: "0.15rem" },
          { backgroundColor: candidate.colour, borderWidth: "0px", borderRadius: "0px" },
          delayMs,
        );
      }
    }
  }

  // irv-app.ts wires its own click listener on this same button, and (if
  // registered first) its render() zeroes the eliminated candidate's
  // --fill-pct — collapsing .candidate-stack-fill's absolutely-positioned
  // box to a zero-height sliver — before a bubble-phase listener here would
  // otherwise get to read it. A capturing listener runs before every
  // bubble-phase listener on this element regardless of registration order,
  // so snapshot every candidate's pre-click fill geometry here, and hand the
  // eliminated one's snapshot (not a live re-query) to spawnTransferChips.
  let preClickFillRects = new Map<CandidateId, DOMRect>();
  nextButton.addEventListener(
    "click",
    () => {
      preClickFillRects = new Map(
        Array.from(
          root.querySelectorAll<HTMLElement>("[data-fill-for]"),
          (el) =>
            [el.getAttribute("data-fill-for")!, el.getBoundingClientRect()] as [
              CandidateId,
              DOMRect,
            ],
        ),
      );
    },
    { capture: true },
  );

  nextButton.addEventListener("click", () => {
    if (!controller.next()) return;

    const eliminated = controller.justEliminated;
    const transfers = controller.justTransfers;
    if (!eliminated || !transfers) return;

    spawnTransferChips(transfers, preClickFillRects.get(eliminated));
  });
}
