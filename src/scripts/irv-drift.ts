import { createIrvController } from "../lib/irv-controller";
import type { BoxState } from "../lib/spring";
import { springBoxKeyframes } from "../lib/spring";
import type { Candidate, CandidateId, Scenario } from "../lib/types";

// Within PLAN.md's documented "roughly 15-30" representative-sample range —
// pushed toward the top of it so a receiving candidate's stream of arrivals
// reads as substantial rather than a token few.
const TOTAL_TRANSFER_CHIPS = 28;
// The whole batch of chips for a receiving candidate lands within this
// window, each at its own moment rather than all at once.
const FLIGHT_DURATION_MS = 600;
// Each individual chip's own flight lasts up to this long -- shorter only
// for the very first chips in a batch, which don't have this much runway
// left before FLIGHT_DURATION_MS.
const CHIP_FLIGHT_MS = 350;
// Mirrors ballot-drift.ts's landed shape: the coloured stack bar is a stack
// of ballot papers seen edge-on, so a landed chip flattens into a thin
// colour-matched line rather than staying a small white rectangle.
const LANDED_STRIP_HEIGHT_PX = 3;

interface EdgeStyle {
  backgroundColor: string;
  borderWidth: string;
  borderRadius: string;
}

// A chip currently landed at a receiving candidate's stack, tracked so a
// later "Previous round" click can fly it back to where it came from instead
// of leaving it stranded, and so a later "Next round" click knows the slate
// is clear before spawning a fresh batch.
interface LiveChip {
  el: HTMLElement;
  receivedBy: CandidateId;
  naturalWidth: number;
  naturalHeight: number;
  landFraction: number;
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

// A receiving candidate's [data-fill-for] element sits inside a fixed-height
// bar (position: relative, no transition of its own) as an absolutely
// positioned child anchored to the bar's bottom edge (bottom: 0; height:
// var(--fill-pct)). irv-app.ts puts a CSS transition on that height, so the
// fill's own getBoundingClientRect() lags behind its just-set --fill-pct
// value for the length of the transition -- reading it synchronously right
// after the value changes still reports the *old* box. The bar itself never
// moves, so its rect plus the freshly-set (and, unlike the box, immediately
// current) --fill-pct percentage gives the true final top independent of how
// far the visual transition has progressed. Returns undefined if the fill has
// no parent or an unparseable --fill-pct, so the caller can fall back.
function computeFinalFillTop(
  fill: HTMLElement | null,
  containerRect: DOMRect,
): number | undefined {
  const bar = fill?.parentElement;
  if (!bar) return undefined;
  const pct = Number.parseFloat(fill.style.getPropertyValue("--fill-pct"));
  if (Number.isNaN(pct)) return undefined;
  const barRect = bar.getBoundingClientRect();
  return barRect.bottom - barRect.height * (pct / 100) - containerRect.top;
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
  const prevButton = root.querySelector<HTMLButtonElement>(
    'button[data-action="prev-round"]',
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

  // One entry per successful controller.next(), in order, so a "Previous
  // round" click can always find and reverse-animate the batch that
  // belongs to the step it's undoing -- not just the single most recent
  // one. A "Previous round" click pops the last entry; a "Next round"
  // click pushes a new one. Entries stay in the array (and their chips in
  // the DOM) until popped, so repeated consecutive "Previous round"
  // clicks each have their own real chips to reverse instead of finding
  // an already-cleared slot -- except a batch's individual chips can be
  // removed early, out of turn, by purgeStrandedChips if the candidate
  // they landed on is later eliminated themselves; reverseTransferChips
  // skips those via el.isConnected rather than assuming every chip it was
  // given is still live. null marks a next() step that had nothing to
  // animate (no elimination/transfer to show), so the stack still stays
  // index-aligned with controller.roundIndex.
  const transferBatches: Array<{
    eliminated: CandidateId;
    chips: LiveChip[];
  } | null> = [];

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
    durationMs: number,
  ): Animation | undefined {
    if (reducedMotion || typeof el.animate !== "function") {
      el.style.transform = `translate(${to.x}px, ${to.y}px)`;
      el.style.width = `${to.width}px`;
      el.style.height = `${to.height}px`;
      applyEdgeStyle(el, toStyle);
      return undefined;
    }
    const frames = springBoxKeyframes(from, to, { stiffness: 170, damping: 20 });
    frames[0] = { ...frames[0], ...fromStyle };
    frames[frames.length - 1] = { ...frames[frames.length - 1], ...toStyle };
    // "both", not "forwards": a staggered chip's animate() call can carry a
    // real delay before its own flight starts (later chips in a batch land
    // later), and fill:"forwards" only ever backfills the *last* frame once
    // an animation ends -- during the delay itself it applies nothing, so
    // the freshly-appended chip would render at its raw stylesheet position
    // (.ballot-paper-mini's position: absolute; top: 0; left: 0, i.e.
    // container's top-left corner) until its delay elapses. "both" also
    // holds the first frame's styles for the entire delay window, so a
    // delayed chip sits at its real fromBox from the instant it's appended.
    return el.animate(frames, {
      duration: durationMs,
      delay: delayMs,
      fill: "both",
    });
  }

  function fadeOutMark(mark: HTMLElement, delayMs: number, durationMs: number): void {
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
      { duration: durationMs, delay: delayMs, fill: "forwards" },
    );
  }

  function spawnTransferChips(
    transfers: Record<CandidateId, number>,
    fromRect: DOMRect | undefined,
  ): LiveChip[] {
    const chips: LiveChip[] = [];

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

      // By the time this runs, irv-app.ts's own render() (an earlier
      // bubble-phase listener on the same click) has already set this
      // receiving stack's --fill-pct to its final value — but irv-app.ts
      // also puts a 600ms CSS transition on .candidate-stack-fill's height,
      // so target.getBoundingClientRect() still reports the *pre-transition*
      // box at this synchronous read (the used value hasn't caught up to
      // the new specified value yet). Reading finalToY from that live rect
      // would make every chip converge on the stack's *old* height, not its
      // new one. Its parent bar (fixed height, untouched by the transition)
      // plus the freshly-set --fill-pct percentage gives the true final top
      // instead, independent of how far the visual transition has progressed.
      const fallbackToY =
        (targetRect?.top ?? containerRect.top) - containerRect.top;
      const finalToY =
        computeFinalFillTop(target, containerRect) ?? fallbackToY;

      // Landing each successive chip progressively higher — interpolated
      // between where the fill's top edge sat *before* this transfer and
      // where it ends up — makes each arrival read as adding to the top of
      // a still-growing stack, rather than feeding into the middle of an
      // already-tall one.
      const startToY = preClickFillRects.get(id)?.top;
      const fromToY = startToY !== undefined
        ? startToY - containerRect.top
        : finalToY;

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

        const landFraction = (i + 1) / count;
        const toY = fromToY + (finalToY - fromToY) * landFraction;
        const to: BoxState = {
          x: toX,
          y: toY,
          width: targetRect?.width ?? containerRect.width,
          height: LANDED_STRIP_HEIGHT_PX,
        };

        const landAtMs = landFraction * FLIGHT_DURATION_MS;
        const durationMs = Math.min(CHIP_FLIGHT_MS, landAtMs);
        const delayMs = Math.round(landAtMs - durationMs);

        const mark = chip.querySelector<HTMLElement>(
          ".ballot-paper-mini-mark",
        );
        if (mark) fadeOutMark(mark, delayMs, durationMs);

        flyTo(
          chip,
          fromBox,
          to,
          { backgroundColor: "#fff", borderWidth: "1px", borderRadius: "0.15rem" },
          { backgroundColor: candidate.colour, borderWidth: "0px", borderRadius: "0px" },
          delayMs,
          durationMs,
        );

        chips.push({
          el: chip,
          receivedBy: id,
          naturalWidth: naturalRect.width,
          naturalHeight: naturalRect.height,
          landFraction,
        });
      }
    }

    return chips;
  }

  // A candidate's landed chips are frozen at the absolute pixel position
  // their receiving stack's fill top sat at when they arrived
  // (computeFinalFillTop, read once in spawnTransferChips and never
  // revisited). That's invisible while the stack only ever grows further --
  // the old chip just ends up submerged inside the taller, same-coloured
  // fill above it. But once *that* candidate is themselves eliminated and
  // their own fill collapses toward zero, any chip that landed earlier is
  // left stranded above the now-short fill -- a stray colour-matched sliver
  // floating in what looks like empty space. Called right when a candidate
  // becomes the newly eliminated one, this removes every previously-landed
  // chip that had arrived in *their* stack, from any earlier batch, since
  // there's no longer a matching fill underneath for it to sit in.
  function purgeStrandedChips(candidateId: CandidateId): void {
    for (const batch of transferBatches) {
      if (!batch) continue;
      for (const chip of batch.chips) {
        if (chip.receivedBy === candidateId) chip.el.remove();
      }
    }
  }

  // The reverse of spawnTransferChips: flies every chip in the given batch
  // back to the eliminated candidate's stack (growing back into a natural
  // mini-ballot shape as it goes, mirroring the forward flight's box/style
  // interpolation exactly in reverse) and removes each chip once its return
  // flight lands.
  function reverseTransferChips(eliminated: CandidateId, chips: LiveChip[]): void {
    if (chips.length === 0) return;

    const containerRect = container!.getBoundingClientRect();
    const target = root.querySelector<HTMLElement>(
      `[data-fill-for="${eliminated}"]`,
    );
    const targetRect = target?.getBoundingClientRect();
    const toX = (targetRect?.left ?? containerRect.left) - containerRect.left;
    const fallbackToY =
      (targetRect?.top ?? containerRect.top) - containerRect.top;
    const finalToY = computeFinalFillTop(target, containerRect) ?? fallbackToY;

    for (const { el, receivedBy, naturalWidth, naturalHeight, landFraction } of chips) {
      // purgeStrandedChips may have already removed this exact element, if
      // its receiving candidate was later eliminated and this batch is only
      // now being reversed past that point -- nothing left to fly back.
      if (!el.isConnected) continue;
      const candidate = candidatesById.get(receivedBy);
      const chipRect = el.getBoundingClientRect();
      const fromBox: BoxState = {
        x: chipRect.left - containerRect.left,
        y: chipRect.top - containerRect.top,
        width: chipRect.width,
        height: chipRect.height,
      };
      const toBox: BoxState = {
        x: toX,
        y: finalToY,
        width: naturalWidth,
        height: naturalHeight,
      };

      // Mirrors the forward flight's stagger in reverse: the chip that
      // landed last (highest landFraction) departs first, the one that
      // landed first departs last, and every departure still leaves enough
      // runway to land within the same window forward flights use.
      const departAtMs = (1 - landFraction) * FLIGHT_DURATION_MS;
      const durationMs = Math.min(CHIP_FLIGHT_MS, FLIGHT_DURATION_MS - departAtMs);
      const delayMs = departAtMs;

      const animation = flyTo(
        el,
        fromBox,
        toBox,
        {
          backgroundColor: candidate?.colour ?? "#000",
          borderWidth: "0px",
          borderRadius: "0px",
        },
        { backgroundColor: "#fff", borderWidth: "1px", borderRadius: "0.15rem" },
        delayMs,
        durationMs,
      );

      if (animation) {
        animation.finished.then(() => el.remove()).catch(() => el.remove());
      } else {
        el.remove();
      }
    }
  }

  // irv-app.ts wires its own click listener on this same button, and (if
  // registered first) its render() updates every --fill-pct in one go —
  // collapsing the eliminated candidate's fill and growing every receiver's
  // — before a bubble-phase listener here would otherwise get to read any of
  // them pre-transfer. A capturing listener runs before every bubble-phase
  // listener on this element regardless of registration order, so snapshot
  // every candidate's pre-click fill geometry here: spawnTransferChips uses
  // the eliminated one's snapshot as the flight's origin, and each
  // receiver's snapshot as the "before" height its chips interpolate up
  // from.
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
    if (!eliminated || !transfers) {
      transferBatches.push(null);
      return;
    }

    purgeStrandedChips(eliminated);
    const chips = spawnTransferChips(transfers, preClickFillRects.get(eliminated));
    transferBatches.push({ eliminated, chips });
  });

  // Kept in lockstep with irv-app.ts's own controller the same way next()
  // already is: both listen on the same two buttons and perform the same
  // bounds-checked step, so this controller's roundIndex always matches
  // irv-app.ts's regardless of how many times the reader goes back and
  // forth. Without this, only next() ever moved this controller's index, so
  // a Previous click silently desynced the two and the following Next click
  // would find controller.next() already exhausted -- spawning nothing.
  //
  // transferBatches.pop() mirrors that same lockstep discipline for the
  // animation state: it always undoes exactly the batch that this prev()
  // step corresponds to, so any number of consecutive "Previous round"
  // clicks each animate correctly, not just the first.
  prevButton?.addEventListener("click", () => {
    if (!controller.prev()) return;
    const batch = transferBatches.pop();
    if (batch) reverseTransferChips(batch.eliminated, batch.chips);
  });
}
