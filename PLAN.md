# Who Really Won?

An interactive explainer comparing first-past-the-post (FPTP) voting with
single-seat preferential voting (IRV), built as one scrollytelling story around
a single shared election scenario.

## Premise

One hypothetical election, three candidates, carried through the whole piece.
The reader first explores it under FPTP rules, sees where FPTP goes wrong
(the spoiler effect), then watches the *same* election recounted under IRV and
sees the flaw resolve. The point of view — IRV mitigates flaws FPTP has — is
carried by the interaction, not by editorial prose.

Deliberately **not** using real named elections (e.g. US 2000) as illustrations
— everything stays hypothetical to keep the piece pointed rather than
partisan. Kept to one mechanic reused twice, not two separate explainers.

## Structure

1. **Introduction.** A short framing section ahead of any mechanic: states the
   stakes (the counting rule, not just the votes, can decide who wins) before
   asking the reader to learn anything, and assumes no background beyond
   knowing what a ballot paper is.
2. **How FPTP works.** Reader sees a simulated ballot paper (a full ranked
   preference order) and, on scroll, watches it drift and land on one of three
   stacks — the candidate it ranked first. Stacks double as the bar chart.
   Sliders (one per candidate, native `<input type="range">`, redistributing
   the remaining pool proportionally) let the reader freely explore outcomes.
3. **Transition to the flaw.** The story pivots from free exploration to one
   authored, hand-tuned scenario that reliably produces a spoiler-effect
   result — vote splitting between two similar candidates hands the win to a
   less-preferred third. This authored scenario (not whatever the reader left
   the sliders at) is what carries forward into the IRV recount.
4. **The flaws.**
   - *Spoiler effect* — primary, fully interactive, demonstrated on the
     authored scenario. Named as a term ("the spoiler effect"), not just
     narrated, so the reader leaves with the vocabulary as well as the idea.
   - *Strategic voting* — shown via one or two of the sampled ballot papers:
     the voter's sincere ranking vs. the vote they'd need to cast tactically
     under FPTP.
   - *Two-party convergence (Duverger's law)* — one text paragraph, no new
     visualisation. It's a claim about many elections over time, not this one
     scenario, so it doesn't get a second mechanic.
5. **Transition to IRV.** A hinge, not a scene break: names what just went
   wrong under FPTP, then names the fix — preferential voting, also called
   instant-runoff voting or IRV — before its ballot mechanic is shown, so the
   switch in system reads as the next beat of one story rather than a second,
   disconnected explainer starting cold.
6. **How IRV works, recounting the same election.** Same ballot-paper objects,
   same stacks. Last-place candidate is eliminated and those ballots drift to
   their next preference's stack. With 3 candidates this is at most one
   elimination round. Reader watches the spoiler resolve.
7. **Conclusion.** A closing section stating the takeaway plainly and tying it
   back to the introduction's framing and the page's own title question — same
   votes, different winner, because the counting rule changed — before free
   play opens up as an epilogue rather than doubling as the ending by default.
8. **Free play.** No scripted outcome: the reader can add or remove candidates
   and freely adjust votes.

## Feature: ballot-mechanics intro chapters

Before "How FPTP works" and before "Recounting the same election under IRV",
a standalone chapter shows how that system's ballot itself works — a voter
ticking one box for FPTP, a voter numbering every candidate for IRV — using
the same `BallotPaper` object as the hero. On scroll, that hero fades and a
chip flies forward onto the next chapter's stacks (reusing the drift
mechanic from `ballot-drift.ts`, now split into a `heroRoot` separate from
the `targetRoot` it animates into, since the hero and its target stacks now
live in genuinely different chapters).

Why: the piece was explaining *how the count works* without ever showing
*how the ballot itself works* — readers were asked to interpret a numbered
or ticked ballot paper before being told what marking it even means.
Restructuring also surfaced and fixed a real bug: the hero ballot lived as a
sibling of `#explore-app`/`#recount-app`, not a descendant, so
`root.querySelector` never found it and the fade+fly silently never fired in
production, even though the unit test's fixture (hero and container as
siblings under one root that *was* passed directly) didn't catch it.

Checks:
- `ballot-drift.test.ts` — cross-root case (hero in a separate `<section>`
  from the stacks) proves the fade+fly still fires; a `heroRoot: null` case
  proves the swarm still lands with no hero handling attempted.
- `pnpm astro check` / `pnpm build` — catches prop-typing/markup mistakes in
  the new `mode` prop and the `index.astro` restructure.
- Manual browser pass at both marking viewports (`pnpm preview`): tick-box
  ballot renders one checked box in fixed candidate order; numbered ballot
  unchanged; the hero-only `.chapter-viz` doesn't blow the mobile 40vh cap;
  the hero visibly fades and a chip flies into the next chapter's stack on
  scroll (confirms the bug fix); `prefers-reduced-motion` collapses all of
  it to an instant final state.

## Feature: chips land on the colour, and the hero handoff reverses on scroll-up

Two follow-up problems with the drift animation, found after the ballot-
mechanics intro chapters shipped: mini-ballot chips were landing at the top
of each candidate's whole stack column (near the swatch/label), not on the
coloured fill — the user's mental model is that the colour bar *is* a stack
of ballot papers, so chips should visibly join the pile, not hover above the
grey rectangle. Fixed by pointing every landing/origin rect lookup in
`ballot-drift.ts` and `irv-drift.ts` at `[data-fill-for="id"]` (the element
whose real rendered height already reflects `--fill-pct`) instead of
`[data-candidate="id"]` (the whole stack).

Separately, the intro chapters' hero ballot fade+fly only ever played
forward, once — consistent with the Visual design decision below that
scroll animation isn't scroll-scrubbed and doesn't reverse. That decision
still holds for the 24-chip swarm sample (no resting state to return to)
and for IRV's elimination-transfer chips (already undone by the existing
Previous/Next buttons). But the user wanted this *specific* handoff to
un-do: scrolling back up to "How the ballot works" now re-fades the hero in
and flies its chip back home. This is a scoped exception, not a reversal of
the whole animation model — implemented as a second, non-disconnecting
`IntersectionObserver` on the hero element itself (separate from the
swarm's one-shot, disconnecting observer on the container), with a
closure-scoped guard against duplicate triggers and `flyTo` now returning
`Promise<void>` (backed by WAAPI's `animation.finished`) so the reversed
chip can be removed only once its flight home actually completes.

Bundled in: `.ballot-paper-ranking li { display: flex; }` was suppressing
`<ol>`'s native `::marker` box, so the numbered IRV ballot showed no numbers
at all — fixed with a CSS counter (`counter-reset`/`counter-increment`) that
coexists with the flex row layout, instead of removing that layout.

Checks:
- `ballot-drift.test.ts` / `irv-drift.test.ts` — landing-target tests mock
  distinct rects for `data-candidate` vs `data-fill-for` and assert the
  chip lands on the fill rect.
- `ballot-drift.test.ts` — a fake `IntersectionObserver` harness drives:
  forward trigger (hero leaves view → fades out, chip flies forward),
  backward trigger (hero re-enters → fades back in, chip flies home and is
  removed once its flight promise resolves), an idempotency case (repeated
  identical intersection events don't spawn a second hero chip), and a
  reduced-motion case (both directions snap instantly, no WAAPI calls).
- `pnpm astro check` / `pnpm build` — typecheck and build stay clean.
- Manual browser pass at both marking viewports (`pnpm preview`): chips
  visibly land on the colour, not the grey bar; scrolling back up to either
  intro chapter un-fades the hero and flies its chip back; the IRV ballot
  shows visible numbers again; `prefers-reduced-motion` still snaps
  correctly in both directions with no layout breakage.

## Feature: chips morph shape and flatten into the colour as they land

Follow-up to the previous feature: landing on the fill rect fixed *where*
chips land, but they still landed looking like a small white ballot-paper
rectangle sitting on top of the colour, not joining it. The user's mental
model is that the coloured bar *is* a stack of ballot papers seen edge-on,
so a chip should morph its own shape continuously during flight and land as
a flat, colour-matched line indistinguishable from the stack itself — no
grey/white rectangle, no border, no separate swatch icon surviving to the
end state.

Added `springBoxKeyframes` to `spring.ts` alongside the existing
`springTranslateKeyframes` — same analytic spring sampling, extended to
`x`/`y`/`width`/`height` so a chip's position and size settle together.
Colour/border aren't sampled per-frame; callers merge `backgroundColor`/
`borderWidth`/`borderRadius` onto only the first and last keyframe and let
WAAPI's native sparse-keyframe interpolation carry them smoothly across the
timeline, keeping `spring.ts` a pure math module.

Swarm chips (`ballot-drift.ts`) and IRV transfer chips (`irv-drift.ts`) both
morph from their existing `.ballot-paper-mini` look (measured via
`getBoundingClientRect()` right after appending, so the "from" shape is
always the real rendered size, not a hardcoded rem→px guess) to a landed
shape sized to the destination fill's real width, 3px tall
(`LANDED_STRIP_HEIGHT_PX`), coloured to match the candidate, with no border
or radius. Each chip's swatch mark fades to opacity 0 by the flight's
midpoint, well before the box shrinks small enough for it to visibly clip.

The hero handoff is the one place a genuinely full-size `.ballot-paper-full`
illustration exists, so — per the user's explicit choice over a cheaper
pre-shrunk-mini-chip alternative — it clones the actual rendered hero node
(`hero.cloneNode(true)`, `overflow: hidden`) rather than swapping in a mini
chip: its real heading and ranking list visibly shrink and clip away as the
clone's height collapses toward the flattened line, and reappear as it
grows back on the reverse flight. The clone's natural size is captured via
`getBoundingClientRect()` immediately after appending (before any transform)
and stored so the reverse flight can grow it back to that exact size.

Checks:
- `spring.test.ts` — `springBoxKeyframes` starts at the `from` box and ends
  at the `to` box with the same frame count as an equivalent
  `springTranslateKeyframes` call; holds width/height constant when `from`
  and `to` sizes match.
- `ballot-drift.test.ts` / `irv-drift.test.ts` — the existing no-`animate`
  fallback landing test now also asserts the landed chip's inline
  `width`/`height`/`backgroundColor`/`borderWidth`/`borderRadius` match the
  fill's width, `LANDED_STRIP_HEIGHT_PX`, and the candidate's colour, and
  that the swatch mark's opacity is `"0"`.
- `ballot-drift.test.ts` — a hero-specific test asserts the forward flight's
  chip carries `ballot-paper-full`'s class and contains the original ranking
  list (a real clone, not a `.ballot-paper-mini`); a reverse test confirms
  the chip's inline size/colour snap back to the clone's captured natural
  width/height and white background once it scrolls back into view.
- `pnpm astro check` / `pnpm build` — typecheck and build stay clean.
- Manual browser pass at both marking viewports (`pnpm preview`): swarm and
  IRV transfer chips visibly shrink and flatten into the colour with no
  grey/white sliver left behind; the hero's real ballot content visibly
  shrinks and clips away as it flies, reappearing when scrolling back up;
  `prefers-reduced-motion` snaps straight to the flattened end state with no
  flash of the old rectangle look.

## Feature: bug fixes from the first manual pass over the morph/flatten feature

The morph/flatten feature shipped and passed a background browser-
verification pass, but a manual read-through of the live page turned up five
real problems (plus a content question), each traced to a specific root
cause rather than retuned by feel, per the animation-is-a-first-class-
feature rule above.

- **Hero clone left a visible remnant instead of fading out.** The flight
  animated `width`/`height` down to the flattened strip height but never
  touched `padding`, so under `box-sizing: border-box` the clone could only
  ever shrink to its padding sum (24px) — the original ballot text stayed
  legible on top of the candidate colour. Fixed by animating padding to `0`
  alongside the box morph, and by folding a post-landing opacity fade into
  the *same* `Animation` object as the flight (not a separate one) so an
  uninterrupted forward flight removes its clone once it lands — the
  stack's own fill is what represents the vote from then on.
- **Reverse flight undershot the real ballot's width.** `flyForward` set
  `clone.style.boxSizing = "border-box"` *before* measuring the clone's
  natural size, so the same `width: 12rem` measured 34px short of the real
  hero's true (content-box) rendered width. Fixed by measuring before
  switching box-sizing.
- **Fast scrolling didn't track the ballot.** `heroAway` flipped
  synchronously but the underlying 600ms `Animation` didn't, so scrolling
  past the hero's visibility threshold twice inside that window started a
  second, competing `Animation` on the same clone. Fixed by tracking one
  clone and its currently-playing `Animation` together; redirecting mid-
  flight now reads the clone's actual current box via
  `getBoundingClientRect()`, cancels the old `Animation`, and continues from
  there — a continuation, never a race.
- **Spurious flight on page load.** `IntersectionObserver`'s very first
  callback just reports whatever state the hero happens to be in at
  `observe()`-time (e.g. already below the fold), which the code was
  treating identically to a real scroll transition. Fixed by ignoring the
  observer's first callback outright.
- **The spoiler section had a hero ballot that didn't serve its point.**
  FPTP vote-splitting is a property of a whole electorate, not any one
  voter's ranking, so `#spoiler-chapter`'s `<BallotPaper hero>` was removed
  from `index.astro`; `bootstrap.ts` now calls
  `initBallotDrift(null, spoilerRoot, scenarioSpoiler)` — `heroRoot: null`
  is the same already-supported "swarm lands, no hero handling attempted"
  mode used elsewhere.
- **IRV elimination read as "hit or miss."** Two compounding causes: (1)
  `irv-drift.ts` returned early under `prefers-reduced-motion` *before*
  spawning any chips at all, unlike the swarm/hero which still degrade to
  an instant final placement; (2) `.candidate-stack-fill`'s height had no
  transition, so the actual stack bars snapped instantly on every round,
  leaving a decorative sample of up to 12 chips (which can be 0–2 for an
  uneven split) as the only visible signal that votes moved. Fixed by
  pushing the reduced-motion check down into `flyTo`/`fadeOutMark`'s own
  instant-placement fallback (spawn always happens, motion is what's
  conditional), and by giving each recount fill element an inline
  `transition: height 600ms ease` set once during `initIrvApp`'s setup —
  scoped to these fills, not a change to the shared CSS class, since
  explore/spoiler use the same class for continuously-dragged sliders
  where an animated height would feel laggy.
- **Follow-up caught during browser verification: the new fill-height
  transition ignored `prefers-reduced-motion`.** Every other drift/spring
  animation in this codebase already falls back to an instant snap under
  reduced motion; this one didn't. Fixed by computing `reducedMotion` in
  `initIrvApp` (via the first fill element's `ownerDocument.defaultView`,
  matching how `ballot-drift.ts`/`irv-drift.ts` derive it from an already-
  queried element rather than assuming a global `document`) and only
  setting the inline transition when motion isn't reduced.

Checks:
- `ballot-drift.test.ts` — the reduced-motion/no-`animate` landed-chip test
  now also asserts padding is zeroed; a new test drives a fake `Animation`
  whose `finished` promise never resolves, redirects mid-flight, and
  asserts the prior `Animation`'s `cancel()` was called and only one clone
  exists; a new test asserts the observer's first callback doesn't trigger
  a flight but a subsequent one does; a new test asserts an uninterrupted
  forward flight removes its clone from the DOM (via `vi.waitFor`).
- `irv-drift.test.ts` — the reduced-motion test now asserts chips *are*
  still created (snapped instantly, no `animate` call), replacing the old
  "suppressed entirely" assertion.
- `irv-app.test.ts` — asserts a fill element's inline `style.transition`
  contains `"height"` after `initIrvApp` runs, and that it does *not* under
  `prefers-reduced-motion`.
- `pnpm astro check` / `pnpm build` — typecheck and build stay clean; also
  confirms nothing else references the removed spoiler hero markup.
- Manual browser pass at both marking viewports (`pnpm preview`): the hero
  clone fully disappears with no remnant once it lands; scrolling back up
  grows it back to the real ballot's exact width; rapid up/down scrolling
  keeps the flight visually attached to the real ballot; the spoiler
  section shows no hero ballot; clicking through IRV rounds shows the
  actual stack bars smoothly draining/filling on every elimination,
  reduced-motion included.

## Feature: three follow-up bugs from a second manual pass

The prior bug-fix pass shipped and passed its own manual verification, but a
further manual pass surfaced three more problems — each traced to a specific
root cause (two confirmed via a background `agent-browser` session driving
the live `pnpm preview` site at both marking viewports; the third found by
re-reading `irv-drift.ts` against `irv-app.ts`'s click-handler ordering),
per the animation-is-a-first-class-feature rule above.

- **Fast scroll-up landed the hero clone in empty space.** `heroOrigin()`/
  `landedBoxFor()` were read once, synchronously, when a flight started, and
  baked into a fixed-keyframe 600ms WAAPI animation that never re-sampled.
  Each chapter's `.chapter-viz` panel pins/unpins independently
  (`position: sticky`), so a fast scroll could move the hero and its landing
  target's relative on-screen position well before that 600ms window
  finished — confirmed empirically at 1920×1080: the reverse-flight clone's
  destination was captured once at scrollY=973, then the page kept
  scrolling another ~700ms/~820px while the clone's target stayed frozen at
  that stale snapshot. Fixed by adding `retargetActiveFlight()` — a `scroll`
  listener that re-samples the true destination on every tick and, if a
  running flight has drifted from the destination it was actually built
  for, redirects it (reusing the same cancel-and-continue mechanism the
  existing mid-flight direction-reversal handling already used).
- **A spurious animation appeared in `#recount-app` while still reading "How
  preferential ballots work."** The swarm's `IntersectionObserver` used
  `{ threshold: 0.3 }` on its own container — satisfied as soon as ~30% of
  the container's area entered the viewport from any edge, including merely
  peeking up from the bottom. Confirmed empirically: at 1920×1080 the swarm
  fired at scrollY≈3850, *before* the IRV-intro chapter had even started
  entering the viewport; at 390×844 it fired at the exact instant the
  reader arrived at the intro heading. Fixed by adding
  `rootMargin: "-35% 0px -35% 0px"` (with `threshold: 0`), shrinking the
  effective intersection root to the central 30% band of the viewport, so
  the container must scroll into that band, not merely tag an edge.
- **IRV vote transfers read as "one goes to zero, the other magically gains
  votes."** Two compounding causes, both in `irv-drift.ts`: (1) both
  `irv-app.ts` and `irv-drift.ts` register a `click` listener on the same
  "Next round" button; `irv-app.ts`'s registers first in `bootstrap.ts`, and
  its `render()` zeroes the eliminated candidate's `--fill-pct` — since
  `.candidate-stack-fill` is `position: absolute; bottom: 0; height:
  var(--fill-pct)`, a 0% height collapses the box's top and bottom to the
  same point, so the chips' departure point read from a live
  `getBoundingClientRect()` was already collapsed by the time it was read;
  (2) `allocateTransferChips`'s largest-remainder split could round a real,
  nonzero transfer down to 0 chips for a small-share receiver, so that
  stack's growth had no visible chip arriving at all. Fixed by (1) a
  capture-phase click listener that snapshots every candidate's fill rect
  before any bubble-phase listener runs — capture always precedes bubble
  regardless of registration order, so this is correct independent of
  `bootstrap.ts`'s call order — and handing the eliminated candidate's
  snapshotted rect to `spawnTransferChips` instead of a live re-query; and
  (2) a fix-up pass after the largest-remainder split that borrows one chip
  from the largest receiver for any candidate with a real transfer and a
  zero allocation, plus bumping `TOTAL_TRANSFER_CHIPS` from 12 to 18 for
  headroom to do that borrowing without starving the largest receiver.

Checks:
- `ballot-drift.test.ts` — a test drives a fake `IntersectionObserver` and a
  mocked `animate` returning a `"running"` animation, triggers a forward
  flight, moves the mocked destination rect, dispatches a `scroll` event,
  and asserts the original animation was cancelled and a second flight
  started toward the new destination; a companion test asserts a `scroll`
  event with no active flight calls `animate` no further times; a third
  test asserts the swarm's `IntersectionObserver` is constructed with
  `rootMargin: "-35% 0px -35% 0px"`.
- `irv-drift.test.ts` — a test uses a scenario with a 99/1 transfer split
  and asserts the 1%-share receiver still gets at least one chip; a second
  test registers a plain bubble listener that collapses the mocked fill
  rect for the eliminated candidate *before* `initIrvDrift` is called
  (mirroring `irv-app.ts` running first in `bootstrap.ts`), then asserts the
  chip's actual flight still departs from the original, pre-collapse rect.
- `pnpm astro check` / `pnpm build` — typecheck and build stay clean.
- Manual browser pass at both marking viewports (`pnpm preview`): scrolling
  up fast past either intro chapter keeps the hero clone visually attached
  to the real ballot's actual position, never landing on stale empty space;
  scrolling down slowly to "How preferential ballots work" shows nothing
  animating in `#recount-app` until the reader has actually reached it;
  stepping through the IRV recount rounds shows chips visibly departing
  from the top of the eliminated stack and landing on every receiving stack
  that gained votes, however small the share.

## Feature: drag-on-stack sliders, a per-stack leader indicator, and a stale-swarm fix

A hands-on pass over explore/spoiler/free play surfaced three related
problems with how votes get adjusted, all scoped to the sections with
sliders (`app.ts` / `freeplay-app.ts`) — the IRV recount section has no
sliders and stayed out of scope.

- **A frozen, candidate-coloured line stayed at a stack's original height.**
  Root cause: the swarm's landed `.ballot-paper-mini` chips
  (`ballot-drift.ts`) are positioned once via `getBoundingClientRect()` when
  they land, then never touched again, while `.candidate-stack-fill`'s live
  top edge moves with `--fill-pct` on every count change — so the chips
  stayed frozen exactly where they first landed. Fixed with `clearSwarm()`:
  the first native `"input"` event bubbling from any slider on `targetRoot`
  now fades (or, under reduced motion, instantly removes) every landed chip
  — the swarm has done its job of showing where the initial ballots landed,
  and the live fill takes over from there.
- **Drag the stack itself, instead of a separate slider control.** Moved the
  existing native `<input type="range">` to sit directly on top of
  `.candidate-stack-bar` (`position: absolute; inset: 0`, fully transparent,
  `touch-action: none`), oriented vertically with the same
  `writing-mode: vertical-lr; direction: rtl` already used for the old
  separate widget. The stack is now the control — clicking or dragging
  anywhere on a candidate's coloured fill changes its count — with zero loss
  of the existing accessibility contract, since it's still the same native
  input underneath (keyboard operable, visible `:focus-visible` ring,
  `aria-valuetext` announcements); only its position/visibility changed, not
  its behaviour. `app.ts`, `redistribute.ts`, and `format.ts` needed no
  changes at all, since they already look sliders up by `data-slider-for`
  wherever they sit in the DOM. `VoteSlider.astro` (the old separate widget)
  is now dead and removed.
- **A much clearer way to see who's ahead than a sentence of text.** Kept
  the existing `aria-live="polite"` sentence (still the accessible channel),
  and added an `aria-hidden` visual layer: the leading candidate's stack
  gets an amber "Leading" badge (`.candidate-stack-leader-badge`, laid out
  but `visibility: hidden` when not leading, so a stack's height never jumps
  as the lead changes) and a glowing outline on its bar
  (`.candidate-stack.is-leading .candidate-stack-bar`), both driven by the
  same `currentWinner()` tie-break `tallyFptp` already provides — toggled
  via a `stackEls` lookup in `app.ts`, and directly at render time in
  `freeplay-app.ts` (which rebuilds its DOM from scratch each render anyway).

Checks:
- `ballot-drift.test.ts` — a test dispatches an `"input"` event and asserts
  (via `vi.waitFor`) the landed chips fade and are removed; a companion
  reduced-motion test asserts they're removed immediately with no animation;
  a regression test asserts nothing happens to the chips before any input.
- `freeplay-app.test.ts` — asserts each slider is nested inside its own
  stack's `.candidate-stack-bar` rather than a separate sibling widget, and
  carries an `aria-label` now that the visible label span is gone.
- `app.test.ts` / `freeplay-app.test.ts` — assert exactly the currently-ahead
  candidate's `[data-candidate]` carries `is-leading`, and that it moves to
  the new leader the instant a slider flips who's ahead.
- `pnpm astro check` / `pnpm build` — typecheck and build stay clean; also
  confirms nothing else references the removed `VoteSlider.astro`.
- Manual browser pass at both marking viewports (`pnpm preview`): the
  swarm's landed strips fade away the moment any stack is first
  dragged/adjusted, in explore, spoiler, and free play; dragging directly on
  a candidate's coloured stack changes its count and rebalances the others,
  and clicking/tapping elsewhere on the bar jumps to that value; Tab still
  reaches each stack's slider with a visible focus ring and arrow keys still
  adjust it; touch-dragging a stack at 390×844 adjusts the value without
  scrolling the page; the leading candidate is instantly identifiable at a
  glance at both viewports and the indicator moves immediately when a drag
  changes the lead.

## Feature: hero handoff, premature hero re-trigger, transfer stagger, and a stack layout-shift bug

A further hands-on pass surfaced four more problems, each traced to a
specific root cause rather than retuned by feel, per the animation-is-a-
first-class-feature rule above.

- **The original hero ballot stayed visible while its clone flew back,
  making it obvious there were two.** `flyBackward()` revealed the real hero
  (`fadeHero(hero, 1)`) immediately, before its clone's return flight had
  actually landed — so for the whole flight duration both the real hero and
  its still-in-flight clone were on screen at once. Fixed by moving the
  reveal into the same `completeHeroFlight()` helper that already handles
  landing a flight (used by `flyForward`, `flyBackward`, and
  `retargetActiveFlight`), so the real hero only reappears once its clone is
  confirmed home — with a redundant-but-harmless synchronous reveal kept in
  the reduced-motion branch, since there's no visible clone in flight to hide
  behind in that case.
- **Scrolling up then back down to "How preferential ballots work"
  re-triggered its premature animation, though a first scroll-down no longer
  did.** The earlier swarm fix (`rootMargin: "-35% 0px -35% 0px"`, see
  above) was only ever applied to the swarm's own `IntersectionObserver` —
  the hero's *separate* observer (governing this same chapter's fly-
  forward/fly-backward) still used bare `{ threshold: 0 }`, so any edge-peek
  counted as a real crossing; a quick scroll up then down crosses that edge
  twice in a hurry, retriggering the flight well before the reader had
  actually arrived back. Fixed by giving the hero observer the identical
  `rootMargin`, so a bare peek at the boundary never counts as a real visit,
  matching the swarm's existing behaviour.
- **IRV vote transfers read as a small sliver quickly zooming across, not
  the eliminated candidate's votes gradually splitting up and flowing
  over.** Every chip bound for a given receiving candidate departed and
  landed in lockstep — one un-staggered loop, all launched simultaneously —
  so a whole batch of chips read as one small clump rather than a stream.
  Fixed by staggering each chip's departure across the first `350ms` of the
  `600ms` flight window and correspondingly shortening its own duration, so
  the whole batch still lands together at the same moment the receiving
  stack's `--fill-pct` transition finishes growing (preserving the earlier
  transfer/height sync fix above); also nudged `TOTAL_TRANSFER_CHIPS` from
  18 to 28, still within this doc's documented 15–30 representative-sample
  range, for more visual density.
- **Two stray static lines appeared at the bottom of the last two stacks
  after clicking "Next round."** Root cause: `.candidate-stack-count` had no
  reserved width, so swapping its text from a number to the much wider
  string `"eliminated"` (`irv-app.ts`'s `render()`) changed that one stack's
  own intrinsic width — and since `.candidate-stack` is a flex column sized
  to its widest child inside a wrapping flex row, that shoved every stack
  after it rightward. The swarm's/IRV's landed chips, pixel-positioned once
  at landing time and never repositioned, stayed exactly where they'd
  landed before the shift — stranded, looking like stray lines poking out
  from the stack's new position. Fixed with `min-width: 6rem` (plus
  `text-align: center`) on `.candidate-stack-count`, reserving enough room
  for "eliminated" so the swap never changes the stack's width.

Checks:
- `ballot-drift.test.ts` — a test triggers a hero fly-backward via a fake
  `IntersectionObserver`, asserts the hero's fade-in doesn't fire until the
  clone's flight resolves, and that the clone is gone once it does; a second
  test asserts the hero observer is constructed with the same
  `rootMargin: "-35% 0px -35% 0px"` the swarm already uses.
- `irv-drift.test.ts` — a test asserts a receiving candidate's multiple
  chip flights get distinct, increasing `delay` values rather than one
  shared delay, and that every chip's `delay + duration` still lands within
  the original `600ms` window.
- The stack layout-shift fix has no unit-test equivalent — `jsdom` has no
  real layout engine, so it can't compute an element's actual rendered
  width. Per this file's own stated exception for this bug class, the check
  is a manual browser pass instead (below).
- `pnpm astro check` / `pnpm build` — typecheck and build stay clean.
- Manual browser pass at both marking viewports (`pnpm preview`): scrolling
  the hero ballot out and back never shows two ballots at once; scrolling up
  then quickly back down to "How preferential ballots work" doesn't
  retrigger its animation; stepping through an IRV round shows a receiving
  candidate's chips arriving as a visible, gradual stream rather than one
  simultaneous clump; clicking "Next round" repeatedly never leaves stray
  static lines poking out below any stack.

## Feature: instant hero reveal, a real target-visit gate, and chips that climb the stack

A further pass found the previous fixes above were each still one layer
short of the actual root cause.

- **The hero's reappearance was an animated fade-in, but the clone and the
  real hero occupy the exact same position/shape at the moment the clone
  lands — there is nothing to visually fade from.** The `completeHeroFlight`
  fix above (see the feature entry before this one) correctly delayed the
  reveal until landing, but still played it as a 400ms `fadeHero(hero, 1)`
  animation, which reads as a needless flicker since the two are visually
  coincident at that instant. Split `fadeHero` into `fadeHeroOut` (unchanged
  fade, still used at flight departure) and a new `revealHeroInstantly`,
  which cancels any held WAAPI animation (`fill: "forwards"` otherwise keeps
  the old fade-out's `opacity: 0` in effect over a later plain style write)
  and sets `opacity: "1"` directly with no animation — an instant cut, not a
  fade.
- **The hero still flew back prematurely.** The `rootMargin` fix above
  (previous feature entry) stopped a *quick edge-peek* from re-triggering
  the flight, but didn't address the actual case the brief describes: the
  hero's own chapter regaining visibility on scroll-up is not the same as
  the reader having actually reached the section the hero flew into — so
  scrolling from "How preferential ballots work" up past its own top edge
  (without ever having scrolled down as far as "Recounting the same election
  under IRV") still flew the hero back too soon. Added a `targetVisited`
  flag in `ballot-drift.ts`, set the first time the *target* section's own
  swarm `IntersectionObserver` fires (piggybacking on the existing one-shot
  observer rather than adding a second one); `flyBackward()` now also checks
  this flag, so the reverse flight can only fire after a genuine visit to
  the target section, not merely a revisit of the hero's own chapter.
- **IRV transfer chips all fed into the same one fixed point on the
  receiving stack.** The stagger fix above (previous feature entry)
  spread chip *departures* out, but every chip in a batch still landed at
  the one, already-final `--fill-pct` position — `.candidate-stack-fill`
  has no CSS transition, so by the time any chip's flight starts,
  `irv-app.ts`'s `render()` has already grown the receiver's fill to its
  full final height in one synchronous step. Converging on that single
  already-tall point reads as feeding the middle of the bar, not building it
  up. Fixed by interpolating each chip's landing Y between the receiver's
  pre-click fill top (from the existing `preClickFillRects` snapshot) and
  its already-final post-click top, scaled by the chip's position in the
  batch (`landFraction = (i + 1) / count`), and staggering landing *time*
  the same way (`landAtMs = landFraction * 600ms`) so later chips both land
  higher and arrive later — the last chip in a batch still lands exactly at
  the final top at the end of the 600ms window, but the batch now reads as
  a climb up the stack rather than one simultaneous convergence.

Checks:
- `ballot-drift.test.ts` — a rewritten hero test asserts the hero's
  reappearance is a direct `style.opacity` write with no second `.animate()`
  call on the hero once its clone lands; two new tests assert `flyBackward`
  does nothing when the hero's own chapter regains visibility without the
  target section ever having been visited, and does fire once it has.
- `irv-drift.test.ts` — a new test mocks a receiving candidate's
  `[data-fill-for]` rect to grow (shorter before the click, taller after,
  mirroring `irv-app.ts`'s real `render()`), then asserts each successive
  chip in that receiver's batch lands strictly higher than the last (down to
  the final post-growth top, within a couple of pixels for the spring's
  asymptotic approach) and that landing times spread out rather than all
  syncing to 600ms.
- `pnpm astro check` / `pnpm build` — typecheck and build stay clean.
- Manual browser pass at both marking viewports (`pnpm preview`): the hero's
  reappearance reads as an instant cut, not a fade; scrolling "How
  preferential ballots work" back into view without ever having reached
  "Recounting the same election under IRV" never flies the hero back;
  stepping through an IRV round shows a receiving candidate's chips visibly
  climbing to the top of its stack over the course of the transfer, rather
  than converging on one fixed spot partway up.

## Feature: chips were still converging on one spot — the fill's own rect lags a live CSS transition

The manual browser pass for the feature above caught a bug the progressive-
climb fix's own unit test couldn't see: in a real browser, every chip in a
batch still landed at the exact same point, not the climb the test asserted.

Root cause: `irv-app.ts` puts a 600ms CSS transition
(`fillEl.style.transition = "height 600ms ease"`) on `.candidate-stack-fill`
so a round change grows the bar smoothly rather than snapping. The
progressive-climb fix computed a receiving chip's final landing point
(`finalToY`) from that same fill element's own `getBoundingClientRect()`,
read synchronously right after `render()` sets the new `--fill-pct`. With a
live CSS transition in play, that read reports the box's *pre-transition*
geometry — the used value of `height` hasn't caught up to the freshly-set
specified value yet — so `finalToY` came out equal to `fromToY` (the
already-captured pre-click top), collapsing every chip's interpolated
landing point onto the same spot regardless of `landFraction`. The unit
test never caught this because its mocked `getBoundingClientRect()` jumps
straight to the post-growth box on click, with no transition lag to model.

Fixed by no longer trusting the fill element's own rect for the *final*
position at all: `computeFinalFillTop()` instead reads the stable, non-
transitioning parent bar's rect (`position: relative`, fixed height, never
animated) together with the fill's own `--fill-pct` value — a custom
property, whose *specified* value updates instantly regardless of the
transition on the derived `height` — and computes
`barRect.bottom - barRect.height * (pct / 100)` directly. This matches the
real box the fill will occupy once its transition finishes, independent of
how far along that transition happens to be at read time.

Checks:
- `irv-drift.test.ts` — a new test mocks the fill element's rect to stay
  permanently stuck at its pre-click box (modelling a transition that never
  visually catches up within the test), while still letting `--fill-pct` be
  set for real; asserts every chip lands using the bar-geometry calculation
  (a real climb ending near the value implied by the new `--fill-pct`), not
  frozen at the stuck rect's top.
- `pnpm check` (typecheck, build, lint, full test suite) stays green.
- Manual browser pass: captured the real `.animate()` calls for a "Next
  round" click's transfer batch and confirmed the landing Y values now
  spread across a real ~50px range (219.5 → 163.6 for one batch observed),
  spread across the full 0–600ms window, instead of collapsing to one
  identical value as they did before this fix.

## Feature: an introduction, a conclusion, and an explicit FPTP → IRV hinge

`CLAUDE.md` gained a standing convention ("The site is one story, not two
feature demos") requiring a real introduction with motivation for a reader
with no voting/politics background, a real conclusion with takeaways, and a
transition between the two systems that reads as one continuous story rather
than two separate demos. Auditing the actual copy in `index.astro` against
that bar found four gaps: no framing section before the FPTP mechanic starts,
no closing section after the IRV recount (free play was serving as the
ending by default), the spoiler effect was narrated but never named as a
term, and the FPTP → IRV switch happened as a bare section change with no
sentence explaining what was about to happen or why.

Fixed by adding two new plain (non-`.chapter`) sections — an introduction
right after the `<h1>` and a conclusion right after the IRV recount, before
free play — following the same heading+paragraph pattern already used by the
Duverger's-law and free-play sections. The spoiler section's prose and
heading now name "the spoiler effect" explicitly instead of only describing
the mechanic. The IRV ballot-intro section's opening sentence now names both
what just went wrong under FPTP and the fix ("preferential voting — also
called instant-runoff voting, or IRV") before describing the new ballot,
so naming and mechanic don't arrive in separate breaths.

Checks:
- `pnpm check` (typecheck, build, lint, full test suite) stays green — this
  is a content-only change, no markup structure or script behaviour changed
  in a way any existing test asserts against.
- Manual browser pass at both 1920×1080 and 390×844 confirmed the new
  sections render in the right place in the scroll order, read correctly
  cold (per `CLAUDE.md`'s "read it cold before calling a section done"
  check), and that the conclusion sits directly before free play rather than
  free play remaining the de facto ending.

## Feature: an editorial visual uplift — serif/sans type system, neutral chrome palette, consistent grid

The site's visual language was the Vite starter's defaults (`system-ui`,
`#1a1a1a` on white, a stray bright blue for links/focus, spacing that only
`.chapter` sections got and the narrative-pass plain sections didn't). Per the
user's request for a modern, professional, news-like design, `CLAUDE.md`
gained a new "Design system" section documenting the concrete decisions
before any implementation, then those decisions were applied to the site.

- **Typography**: headings (`h1`/`h2`/`h3`) now use **Fraunces** (variable,
  Google Fonts, `font-optical-sizing: auto`); everything else uses **IBM Plex
  Sans**. Both were chosen for editorial character over a generic system
  stack. Loaded via a Google Fonts `<link>` (preconnect + stylesheet,
  `display=swap`) in `index.astro`'s `<head>`. Base body size bumped to
  `1.125rem`/line-height 1.7.
- **Colour**: `:root` tokens in `global.css` (`--colour-paper`,
  `--colour-surface`, `--colour-ink`, `--colour-ink-muted`,
  `--colour-hairline`, `--colour-accent`/`--colour-accent-hover`). The accent
  is a deep, desaturated plum (~300° hue) chosen deliberately: candidate data
  (`src/data/scenario-*.ts`) already occupies blue/orange/vermillion/green
  (~20–200°, Okabe-Ito colour-blind-safe) and the leader badge already claims
  gold (~45°) — plum is the one hue none of that data uses, so chrome (links,
  focus rings, hover borders) can never be mistaken for a candidate's colour
  or the "currently leading" indicator. Candidate colours and the leader
  badge itself were deliberately left untouched — they're data-semantic, out
  of scope for a chrome pass.
- **Spacing & grid**: a `--space-*` scale, `--content-max-width` (72rem, up
  from 64rem), `--prose-max-width` (~34rem), and one `--section-gap`
  (`clamp(4rem, 10vw, 9rem)`) applied uniformly via `main > section` so every
  top-level section — `.chapter`s and the plain intro/Duverger/conclusion/
  free-play sections alike — gets the same generous whitespace, not just the
  sections that happened to set their own margin before. `.chapter-prose`
  changed from a symmetric `flex: 1 1 50%` to `flex: 0 1 var(--prose-max-
  width)` (with `.chapter-viz` at `flex: 1 1 auto`), and the plain sections'
  heading+paragraph are now capped to the same `--prose-max-width` — so the
  reading column is narrower than the sticky visualisation everywhere, giving
  the story a premium long-form feel next to its own evidence.
- **Chrome**: the header is now a masthead (Fraunces nav link, bottom
  hairline); buttons use the surface/hairline/ink tokens with an accent-
  coloured hover border; every focus-visible state (buttons, links, the
  candidate-stack sliders) uses the same accent outline instead of the old
  stray blue; `.ballot-paper-heading` is now a small letter-spaced/uppercase
  label rather than competing with real headings.

Checks:
- `src/styles/contrast.test.ts` (new) — computes real WCAG contrast ratios
  for ink/paper, muted-ink/paper, and accent/paper and asserts they clear the
  4.5:1 (normal text) / 3:1 (large text/UI) AA thresholds — turns "the
  palette looks accessible" into a re-runnable check.
- `pnpm check` (typecheck, build, lint, full test suite) stays green — the
  stylelint pass caught real selector-ordering issues
  (`no-descending-specificity`) in the rewritten `global.css`, fixed by
  reordering rules rather than suppressing the rule.
- Manual browser pass at both 1920×1080 and 390×844 (`pnpm preview`, via
  `agent-browser`): fonts report `loaded` (not a stuck fallback) for every
  weight in use; the prose column is visibly narrower than the sticky viz
  column at desktop; section-to-section whitespace reads as generous and
  consistent scrolling the whole page; the plum focus ring and leader-badge
  gold are never confused with any candidate's colour at a glance (confirmed
  against the blue/sky-blue/orange stacks in the spoiler and recount
  sections); buttons and the recount/free-play controls keep a clearly
  visible focus ring.

## Feature: a manual pass over the visual uplift — cohesive candidates and one card style

The uplift above shipped two cards that read as disjoint on a second look: the
"How first-past-the-post works" section used one candidate roster (elm, fig,
gum) while "The spoiler effect" and everything after it used a completely
different one (aster, birch, cedar) — a real break from the Premise's own
claim of "one hypothetical election, three candidates, carried through the
whole piece." The two `.chapter-viz` card variants also disagreed on
alignment (the ballot-intro hero cards centred, the candidate-tally cards
left-aligned by default), and the left-aligned cards had no horizontal
padding, so content sat flush against the card edge.

- **One candidate roster, not two.** `src/data/candidates.ts` (new) is now the
  single source of truth for the three candidates (aster/birch/cedar — kept,
  since that's the name set the spoiler/strategic-voting/IRV prose already
  refers to). `scenario-explore.ts` and `scenario-spoiler.ts` both import it
  instead of each declaring their own `candidates` array; only their `groups`
  (vote tallies) differ. The FPTP ballot-intro hero, "How first-past-the-post
  works," "The spoiler effect," the strategic-voting comparison, the IRV
  ballot-intro hero, and the IRV recount all now show the same three
  candidates end to end — scrolling from one chapter to the next changes only
  the tally, never who's on the ballot.
- **One alignment style for `.chapter-viz`.** `.chapter-viz-intro` no longer
  centres its content (`align-items`/`justify-content`/`text-align: center`
  removed) — it keeps only the flex-column + gap needed to space its heading
  above the hero ballot paper, matching the left-aligned reading direction
  every other `.chapter-viz` card already used. Left-aligned was chosen over
  centred because it matches the rest of the page's editorial layout (masthead,
  prose, headings are all left-aligned) and reads naturally for a data chart
  (`.candidate-columns`), which centring would not.
- **Padding on the left-aligned cards.** `.chapter-viz` had `padding-block:
  1rem` but no horizontal padding, so its content touched the card's left/
  right edges. Added `padding-inline: 1.5rem` alongside it.
- **Equal card widths.** At desktop, `.chapter-viz` was `flex: 1 1 auto` —
  `auto` makes the flex-basis content-dependent, so a chapter with a longer
  heading ("The spoiler effect: where first-past-the-post goes wrong") or
  extra controls (the recount buttons) got a measurably wider card (690px/
  606px) than the others (560px), even though every `.chapter` container was
  the same width. Changed to `flex: 1 1 0` so the basis is always zero and
  the full remaining width (container minus the prose column and gap) goes
  to `.chapter-viz` via `flex-grow` — content-independent, so every sticky
  viz card is now exactly the same width. Verified via `getBoundingClientRect`
  on all five `.chapter-viz` cards: all report identical `left`/`width`.

Checks:
- `pnpm check` stays green (130 tests) — no test hardcodes the old
  `elm`/`fig`/`gum` ids; `spec/assignment-1.test.ts` and
  `scenario-spoiler.test.ts` both derive ids from the scenario objects rather
  than asserting literal names, and `sample-ballot-strategic.ts`'s hardcoded
  `aster`/`birch`/`cedar` rankings were left untouched since those ids didn't
  change.
- Manual browser pass at 1920×1080 and 390×844 (`pnpm preview`, via
  `agent-browser`): confirmed the ballot-intro hero and the "How
  first-past-the-post works"/"spoiler effect" cards now show identical
  candidate swatches, shapes, and labels with only the vote counts differing;
  confirmed both card variants read as one consistent left-aligned style with
  visible padding on all sides at both viewport sizes.

## Feature: the hero ballot forgot which way the reader was scrolling

Reported bug: the hero ballot (`#fptp-ballot-intro`/`#irv-ballot-intro`) played
correctly the first time a reader scrolled down through the page, but on any
later visit it went invisible while the *previous* section was in focus, then
visibly flew in from below only once its own section came back into view —
exactly the fly-in the reader should only ever see once.

Root cause, in `ballot-drift.ts`'s hero `IntersectionObserver`
(`rootMargin: "-35% 0px -35% 0px"`, the same central-30%-band "has the reader
really arrived" test the swarm observer uses): its callback treated
`entry.isIntersecting` as a full forward/backward signal —
`isIntersecting ? flyBackward() : flyForward()` — but that boolean only says
whether the hero is inside the band, not which edge it crossed to get there.
Exiting through the band's *top* edge (scrolling further down, on toward the
target stacks) and exiting through its *bottom* edge (scrolling back up, away
from the hero toward earlier content) both report `isIntersecting: false`
identically. On a first top-to-bottom pass the hero only ever exits through
the top, so the bug was invisible. On a revisit — scroll up to bring the hero
back home (correctly re-enters through the bottom → `flyBackward`), then keep
scrolling up to reread the section above it — the hero now exits through the
*bottom* edge, and the observer called `flyForward()` regardless, fading the
already-home hero back out even though the reader was moving away from the
target, not toward it. Scrolling back down to it again then replayed the
fly-in, because the flight state had been left in "away."

Fixed by adding `heroExitedThroughTop()`, which reads `entry.boundingClientRect`
against `entry.rootBounds` to tell the two exits apart, and only calling
`flyForward()` on a top-edge exit; a bottom-edge exit now does nothing, leaving
an already-revealed hero exactly as it is.

Checks:
- `pnpm check` stays green (130 tests) — this is scroll-position logic no
  existing unit test exercises directly.
- Manual browser pass (`pnpm preview`, via `agent-browser`) at both marking
  viewports: scripted `window.scrollTo` through a full
  down → up-past-the-hero → down-again cycle on both
  `#fptp-ballot-intro`/`#explore-app` and `#irv-ballot-intro`/`#recount-app`,
  reading the hero's computed `opacity` at each step. Confirmed the hero now
  stays visible (`opacity: 1`) the entire way back up past its own section to
  the one above it, and stays visible scrolling back down again right up until
  it's actually scrolled past toward its target — no re-trigger, no gap where
  it's invisible while the section above is in focus. Screenshots at
  1920×1080 confirm the same visually (ballot paper visible in its card while
  the prose column shows the section above).

## Data model

- Individual voters with full preference orderings (not just first-choice
  totals) — needed so the same ballot papers can be re-examined for later
  preferences during IRV elimination, and so the strategic-voting flaw can
  point at a specific voter's sincere vs. tactical choice.
- Full preferential (must rank every candidate) — matches Australian federal
  elections, and avoids the exhausted-vote edge case optional-preferential
  systems have.
- Tally logic (both FPTP and IRV) written generically for arbitrary N
  candidates from the start, so free-play's add/remove candidates doesn't need
  a rewrite. Same for the elimination/transfer animation — it should handle an
  arbitrary number of rounds, not just the scripted 3-candidate single-round
  case.
- Soft cap of ~6 candidates in free play, for stack legibility and because the
  colorblind-safe palette runs out of clearly distinct colours beyond that.

## Visual design

- Ballot paper as the one recurring visual object across the whole piece —
  same object drifts into a stack for FPTP, then drifts again between stacks
  during IRV elimination.
- Only a representative sample of individual ballots (roughly 15–30) animate
  individually; the rest of each stack's height/count tweens numerically. Full
  per-voter animation at real scenario sizes (hundreds/thousands of voters)
  would be slow and unreadable.
- Physics-*flavoured* motion (spring/ease interpolation — e.g. d3's force
  simulation, or simple spring easing) rather than a true physics engine
  (Matter.js etc.) — similar tactile payoff, far less engineering risk for a
  one-week build.
- Animation is scroll-*triggered* per step (IntersectionObserver-style
  checkpoints), not scroll-scrubbed — physics/spring motion doesn't reverse
  naturally, so scrolling back up resets to that step's resting state rather
  than reverse-playing the drift. One deliberate, scoped exception: the
  intro chapters' hero ballot fade+fly *does* reverse (fades back in, flies
  its chip home) when scrolling back up to it, since that handoff is the
  one place a reader is likely to scroll back to re-read "how the ballot
  works" — the swarm sample and IRV's transfer chips are unaffected.
- Candidate identity redundantly coded — colour paired with a consistent
  shape/label, not colour alone.

## Layout

- Desktop: sticky visualisation column beside scrolling text, but sticky is
  scoped *per section* (each chapter has its own sticky container that
  releases at that chapter's boundary), not one page-long sticky.
- Mobile (390×844, one of the two marking viewports): single column, viz
  pinned to roughly the top 35–40vh of the viewport with text scrolling
  beneath it — same technique, reflowed to one column, not a separate design.

## Accessibility

- `prefers-reduced-motion`: instant/snap-to-final-state fallback for every
  drift/spring animation, not just the flagship one.
- Sliders are native range inputs with `aria-valuetext` announcing e.g.
  "Candidate A: 340 of 1000 votes" — not a custom multi-handle widget, which
  would be much harder to make keyboard- and screen-reader-accessible. They
  now sit directly on top of each candidate's stack bar (transparent,
  `aria-label`led with the candidate's name) rather than as a separate widget
  beside it, so dragging/clicking the stack itself is what moves the value —
  but it's still the same native `<input type="range">` underneath, so
  keyboard operability, the focus ring, and `aria-valuetext` all still apply
  unchanged.
- Candidate colour is never the only signal (see Visual design above).

## Explicitly out of scope

- STV / multi-seat systems — single-seat IRV only, for a direct comparison
  with FPTP.
- Real, named historical elections as illustrations.
- A general survey of every FPTP flaw — spoiler effect carries the interactive
  argument; strategic voting gets a supporting moment; two-party convergence
  gets one paragraph and nothing more.
- True rigid-body physics simulation for the ballot papers.

## Open before/while building

- Author the actual default-scenario numbers (vote counts + preference flows)
  so the spoiler effect appears clearly and believably before the reader
  touches anything — this is authoring work, not a coding task, and needs to
  happen early since the rest of the story is built around it.
- Write the interaction contract in `spec/assignment-1.test.ts` from
  Assignment 1's published spec line: "the visitor does something that changes
  what they see."
- Build, test against `pnpm check` as we go, adjust the plan here if reality
  disagrees with it.
