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

## Feature: IRV transfer animation reverses on Previous, plus round-1 leading/final-round winner highlights

Reported bug: clicking "Previous round" in the IRV recount silently desynced
`irv-drift.ts`'s own chip-transfer animation from `irv-app.ts`'s round state —
after the first "Previous" click, clicking "Next round" again produced no
chip animation at all. Separately, the user asked for the same leading-
candidate treatment explore/spoiler/free play already have (see "drag-on-
stack sliders..." above) to also appear in the IRV recount, so round 1 makes
clear who's ahead before any elimination and the final round makes clear who
actually won.

- **Root cause of the desync**: `irv-app.ts` and `irv-drift.ts` each own a
  separate `IrvController` instance (a deliberate sibling-controller split,
  documented in both files), both listening independently to the same
  Next/Previous buttons. `irv-drift.ts` only ever listened for "Next" clicks
  — it had no "Previous" handler at all — so its own `roundIndex` fell
  behind `irv-app.ts`'s the moment a reader clicked "Previous", and every
  subsequent "Next" click called `controller.next()` on an already-wrong
  round.
- **Fix**: added a symmetric `prevButton` listener to `irv-drift.ts` that
  calls `controller.prev()` and a new `reverseTransferChips()`, which flies
  every still-live chip from its landed position back to the eliminated
  candidate's revived stack (mirroring the forward flight's spring/box-morph
  mechanism and reusing `computeFinalFillTop()` for the same "read past a
  still-transitioning CSS height" reason it already existed), removing each
  chip once its own `Animation.finished` promise resolves (or immediately
  under reduced motion). A `LiveChip[]` list tracks the current in-flight
  batch so `spawnTransferChips`/`reverseTransferChips` always start from a
  clean slate — chips never pile up or double-process across any number of
  Next/Previous cycles.
- **Leading/winner highlight**: reuses 100% of the existing `.is-leading`
  amber badge/glow markup and CSS (`CandidateStack.astro`/`global.css`), no
  new markup needed. `irv-app.ts` gained `currentLeader(counts)` — the same
  synthetic-single-preference-tally-via-`tallyFptp` trick `app.ts`'s
  `currentWinner()` already uses, adapted to take a round's `counts`
  explicitly — and toggles `is-leading`/`is-winner` on each candidate's stack
  every `render()`, swapping the shared badge's text between "Leading" and
  "Winner". `global.css` gained a new `.is-winner` rule reusing the same gold
  token family (per this file's Design-system rule that candidate hues and
  the leader-badge gold are reserved) but with a doubled box-shadow ring, so
  the final-round treatment reads as more emphatic than "leading" without a
  new colour.

Checks:
- `irv-drift.test.ts` — new tests assert a just-spawned batch of chips flies
  back and is removed on Previous (`vi.waitFor`); that reduced motion removes
  them instantly with no extra `animate` call; and a regression test that
  clicks Next → Previous → Next → Previous → Next and asserts a fresh batch
  of chips spawns every time, not just the first.
- `irv-app.test.ts` — new tests assert round 1's actual leader gets
  `is-leading` + a "Leading" badge (and no one else does); that the final
  round switches to `is-winner` + a "Winner" badge and clears `is-leading`
  everywhere; and that stepping back to round 1 restores `is-leading` and
  clears `is-winner`.
- `pnpm check` (typecheck, build, lint, full test suite) stays green — 136
  tests passing.
- Manual browser pass (`agent-browser` against `pnpm dev`) at both marking
  viewports: clicked Next → Previous → Next → Previous → Next (3 forward
  cycles, 2 reverse) and visually confirmed a genuine reverse animation —
  chips flying from Aster's stack back to Birch's — every time "Previous"
  was clicked, and a fresh forward batch every time "Next" was clicked
  afterward, with no leftover chips and no console errors. Confirmed Cedar
  shows "Leading" with an amber glow on round 1 (Cedar 380 > Aster 320 >
  Birch 300), switching to Aster showing "Winner" with a visibly bolder
  doubled ring on round 2, and Cedar's "Leading" state correctly clearing —
  toggling correctly in both directions, at both 1920×1080 and 390×844.

## Feature: recount status copy, a stray swarm line left behind by elimination, and a one-line status/winner readout

Three follow-up requests against the IRV recount section after the
leading/winner highlight work above landed:

- Round 1's status text just said "Round 1." with no candidate named, unlike
  round 1's `.is-leading` badge which already names Cedar — inconsistent.
  Round 2's markup also put the winner announcement (`<p
  data-testid="winner">`) *before* the round-status paragraph in
  `index.astro`, so a screen reader (or anyone reading top to bottom) heard
  "Aster wins" before "Birch is eliminated" — backwards causally.
- **Fix**: `irv-app.ts`'s `render()` now hoists `winner`/`leader` to the top
  of the function (previously computed twice) and, when there's no
  elimination yet, sets `statusEl` to `Round ${n}: ${leader} is leading.`
  instead of a bare `Round ${n}.`. `index.astro` swaps the two `<p>`
  elements' order so `round-status` (the cause) precedes `winner` (the
  effect) in the DOM regardless of any CSS layout on top.
- A reader noticed a colour-matched line remained stuck at the top of a
  candidate's stack bar after that candidate was eliminated and their live
  fill collapsed to nothing. **Root cause**: `bootstrap.ts` runs
  `initBallotDrift` on `#recount-app` too (for the same one-shot "ballot
  swarm drifts into each stack" illustration explore/spoiler get), and that
  swarm's landed chips are placed once, permanently (`fill: "forwards"`), at
  each candidate's *round-1* fill position. The existing stale-swarm fix
  (see "drag-on-stack sliders..." above) only ever retires that illustration
  on an `"input"` event, because explore/spoiler/free play invalidate it by
  dragging a slider — but the recount section has no sliders, only
  Next/Previous round buttons, so `clearSwarm()` was never wired to fire
  there at all, and a candidate's swarm chips just sat frozen at their
  original height forever, including past their own elimination.
- **Fix**: `ballot-drift.ts` now also wires `clearSwarm` to a one-shot click
  listener on `targetRoot`'s `[data-action="next-round"]` and
  `[data-action="prev-round"]` buttons (a no-op for explore/spoiler/free
  play, which have neither button), so the very first round change retires
  the illustration the same way a slider drag already does everywhere else.
- The same reader asked for the round-status and winner text to render on
  one visual line, so the sticky `.chapter-viz` card doesn't change height
  between round 1 (status only) and the final round (status + winner).
  **Fix**: wrapped both `<p>`s in a `.recount-status` flex row
  (`global.css`) with `flex-wrap: wrap` and `column-gap`, zeroing each
  `<p>`'s own margin — each keeps its own `aria-live="polite"` region (still
  announced separately, in the same DOM order as before), they just flow
  onto one line visually instead of stacking as two block paragraphs.

Checks:
- `irv-app.test.ts` — new tests assert round 1's status text names the
  leader (`"Round 1: A is leading."`) and that, after advancing a round, the
  round-status and winner `data-testid` elements appear in that order in the
  DOM (`querySelectorAll("[data-testid]")` index comparison, since this
  project's jsdom/vitest setup doesn't expose a bare `Node` global for
  `compareDocumentPosition`).
- `ballot-drift.test.ts` — a new test builds a section with recount-style
  next/prev buttons (no sliders) and asserts clicking "Next round" fades and
  removes the swarm's landed `.ballot-paper-mini` chips, mirroring the
  existing slider-driven `clearSwarm` test.
- `pnpm check` (typecheck, build, lint, full test suite) stays green — 139
  tests passing.
- Manual browser pass (`agent-browser` against `pnpm dev`) confirmed: round
  1 reads "Round 1: Cedar is leading."; after "Next round", the line reads
  "Round 2: Birch is eliminated. Aster wins after the recount." on one
  visual line with no visible height change in the sticky card; no stray
  coloured line remains in any bar after elimination, in either direction
  (Next then Previous); no console errors.

## Feature: a flash of a stray ballot chip near Aster's stack on Next round

A reader reported a small ballot card flashing briefly next to Aster's stack,
in the top-left corner, right when clicking "Next round" — gone almost
immediately.

- **Root cause**: `irv-drift.ts`'s `flyTo()` staggers each transfer chip's
  departure with a real `delayMs` (see "hero handoff, premature hero
  re-trigger, transfer stagger..." above), and its `el.animate()` call used
  `fill: "forwards"`. WAAPI's `"forwards"` only ever backfills the
  animation's *last* keyframe once it completes — during the delay before a
  delayed animation starts, it applies nothing at all. A chip element is
  appended to the DOM and `animate()` is called on it immediately, but for
  the length of that chip's `delayMs` it rendered at its raw, un-animated
  stylesheet position instead: `.ballot-paper-mini { position: absolute;
  top: 0; left: 0 }`, i.e. the top-left corner of
  `.candidate-columns[data-ballot-drift]` — which is exactly where Aster's
  column sits, since Aster is first in the row.
- **Fix**: changed `fill: "forwards"` to `fill: "both"` in `flyTo()`.
  `"both"` also holds the animation's *first* keyframe for the entire delay
  window, so a chip renders at its real starting position (already set as
  the first keyframe, matching its departure point) from the instant it's
  appended, not just from the instant its flight actually begins.

Checks:
- `irv-drift.test.ts` — a new test asserts every staggered chip flight
  passes `fill: "both"` to `animate()`, confirming at least one of those
  flights genuinely carries a nonzero delay (so the assertion isn't
  vacuous).
- `pnpm check` (typecheck, build, lint, full test suite) stays green — 140
  tests passing.
- Manual browser pass (`agent-browser` against `pnpm dev`) confirmed: no
  visible flash or stray chip near Aster's stack across several "Next
  round"/"Previous round" clicks, watched at real animation speed; no
  console errors.

## Feature: realistic ballot papers with a hand-drawn fill-in animation

The full ballot paper (`BallotPaper.astro`, `variant="full"`) read more like
a schematic than a ballot someone actually marks: a small 0.9rem checkbox
with a text-glyph tick, and an IRV ranking rendered as a preference-sorted
`<ol>` where the printed "1./2./3." was really just list position, not
something a voter wrote in themselves. Requested: bigger boxes, a real
numbered box per IRV candidate, a bigger checkmark, and a hand-drawn
draw-in animation the first time each ballot scrolls into focus — numbers
appearing in the voter's own preference order (1, then 2, then 3), each
traced like handwriting.

Also decided along the way: keep the tree/plant candidate names (Aster,
Birch, Cedar, etc.) rather than switch to human names — confirmed with the
user, since apolitical names keep the piece about the counting mechanism,
not a cast of characters. And: the IRV hero ballot's own ranking (the one
introduced in "How preferential ballots work") changed to Birch=1, Aster=2,
Cedar=3 (reusing `scenarioSpoiler.groups[1]`, the same 300-voter block the
recount narrative already eliminates first) so it flows into the following
"Recounting the same election under IRV" section, where that hero now flies
into Birch's stack instead of Aster's.

- **Markup/CSS realism** (`BallotPaper.astro`, `global.css`): checkbox and
  new `.ballot-paper-number-box` both grew to 1.4rem with a thicker border;
  the CSS text-glyph tick was replaced by a real inline `<svg><path>`
  checkmark so it has an actual path to stroke-animate (a pseudo-element's
  `content` string can't be). The IRV list changed from iterating `ranking`
  (list position *was* the rank) to iterating the fixed `candidates` prop,
  computing `rank = ranking.indexOf(candidate.id) + 1` per row and printing
  it in a numbered box with its own hand-authored SVG numeral path — since a
  real preferential ballot prints one fixed candidate order and the voter
  writes their own number next to whichever candidate they rank. Added a
  printed instruction line per mode ("Number the boxes 1 to n…" / "Place one
  tick…"), and a new `.sr-only` utility + per-row visually-hidden "ranked N
  of M" text, since the fixed-order list lost the `<ol>`'s implicit
  position-equals-rank semantics that screen readers relied on before.
  Bounded to ranks 1–3 (documented in code): every scenario that renders a
  full IRV ballot has exactly 3 candidates; free play (which can grow to 6)
  never renders a `BallotPaper`, only `CandidateStack`s.
- **Hand-drawn fill-in** (new `src/scripts/ballot-marks.ts`, wired into
  `bootstrap.ts` as one global `initBallotMarks(document)` call): per full
  ballot, an `IntersectionObserver` (`threshold: 0`, `rootMargin: "-35% 0px
  -35% 0px"`, matching `ballot-drift.ts`'s swarm observer — fire once on the
  first "substantially in view" report, disconnect, no bidirectional
  transition tracking needed since a mark only ever draws once) triggers
  `getTotalLength()`/`stroke-dasharray`/`stroke-dashoffset` WAAPI strokes:
  the checkmark draws over 350ms; the three preference numbers draw 350ms
  each, staggered 280ms apart, sorted by `data-pref-rank` ascending (not DOM
  order) so they always animate 1 → 2 → 3 regardless of which box a given
  candidate's number happens to print in. CSS defaults every mark's
  `stroke-dashoffset` to `0` (fully drawn); the script only sets the hidden
  start state right before it plays a real animation, so a slow script or
  missing `Element.animate`/`IntersectionObserver` never leaves a mark
  invisible — it falls back to CSS's already-drawn default instead.
  `prefers-reduced-motion` skips animating entirely, same reason.

Checks:
- `ballot-marks.test.ts` (new): asserts the observer gates drawing until a
  ballot is scrolled into the centred band, disconnects after firing once
  (no redraw on a later re-scroll), draws the checked box's tick, draws IRV
  preference numbers in ascending `data-pref-rank` order with distinct
  staggered delays regardless of DOM position, skips animating under
  reduced motion (leaving the CSS default alone), and falls back to drawing
  immediately when `IntersectionObserver` isn't available.
- `pnpm check` (typecheck, build, lint, full test suite) stays green — 149
  tests passing.
- Manual browser pass (`agent-browser` against `pnpm preview`, both marking
  viewports) confirmed: marks genuinely read as hand-drawn (not a mechanical
  wipe) at real speed; IRV numbers visibly draw in 1 → 2 → 3 order regardless
  of printed position; no redraw on scrolling away and back; no flash of an
  invisible/undrawn mark before the observer fires; the IRV hero ballot's
  fly-into-recount animation now targets Birch's stack; reduced-motion shows
  every mark already drawn; no console errors.

## Feature: full-height intro hero, an original illustration, and a scroll cue

The page opened with a bare `<h1>` directly under `<main>`, immediately
followed by a plain, no-set-height intro `<section>` — so on load, the next
section's sticky "How the ballot works" card was already visible, cutting
against the introduction's job of giving the reader a reason to keep
scrolling before teaching them anything. Requested: make the intro fill the
viewport so nothing peeks through, add a scroll-down indicator, and add
something visually appealing beyond plain text. Two decisions confirmed
with the user up front: an **original SVG illustration** built in the
site's own shape/colour vocabulary (not a real photo), and an **animated
chevron only** for the scroll cue (no text label).

- **Layout** (`index.astro`, `global.css`): the `<h1>` and the old intro
  section's heading/paragraph are now wrapped together in one
  `<section class="hero">`, alongside the new illustration and scroll cue.
  `.hero` is `min-height: 100vh` / `100dvh` (the `dvh` line wins where
  supported, ignored otherwise) so the next card never peeks in on load —
  `min-height`, not `height`, so a phone viewport with more copy than fits
  one screen just grows taller rather than clipping. Single column on
  mobile, two-column (text / illustration) above 900px, matching the
  existing `.chapter`/`.chapter-viz` row-column switch stylistically
  without reusing those exact classes (the hero needs no sticky/order
  semantics). `.hero-content` now owns the `--prose-max-width` cap directly,
  since it's no longer a direct `section` child of the old generic
  `main > section:not(.chapter) > h2, > p` selector.
- **Illustration** (new `src/components/HeroIllustration.astro`): a static
  inline SVG — a ballot box (with a lid seam, a recessed front panel, and a
  flat grounding shadow beneath it, so it reads as an object sitting on a
  surface rather than a blank card) with two ballot papers, one mid-slot —
  reusing the same circle/square/triangle shape techniques already used for
  candidate swatches, but restricted entirely to the neutral chrome palette
  tokens (paper/surface/ink/ink-muted/hairline/accent) — never a candidate
  hue or the leader-badge gold, since those are reserved for real vote
  data. The user initially found the first pass "cheap and low quality" and
  asked about a real photo background instead; the design system's
  editorial/original-illustration commitment argued against a photo, so the
  fix was to raise the SVG's craft instead: the tick and preference-number
  marks on the two ballot papers are now the *exact same* hand-lettered
  Bezier paths `BallotPaper.astro` draws for the real ballots
  (`CHECK_PATH`/`NUMERAL_PATHS[1]`, reused via a nested `<svg>` per mark, one
  coordinate space inside another) rather than a second, cruder set of
  straight-line marks invented just for the hero — so the scene shows the
  same artefact the reader goes on to mark later. Every added shape (the
  seam line, the panel, the grounding ellipse) stays inside this codebase's
  existing flat/hairline elevation vocabulary (confirmed via a `global.css`
  sweep: no `box-shadow`/`filter`/gradient exists anywhere outside the
  focus ring) — no drop-shadows or gradients were introduced, since that
  would read as a design-system inconsistency, not a polish upgrade.
  Deliberately not animated: per this file's animation rule, a decorative
  scene doesn't teach the reader a fact the way the ballot-flight
  animations do, so motion here is reserved for the scroll cue only. Its
  sizing class is hardcoded directly on the component's root `<svg>` rather
  than accepted as a prop, matching this repo's existing convention
  (`BallotPaper.astro`/`CandidateStack.astro` take explicit named props,
  not a generic `class` passthrough) — a `class="hero-illustration"` passed
  from the call site would silently not reach the SVG, since Astro doesn't
  auto-forward a `class` prop onto a child component's root element.
- **Scroll cue** (`.hero-scroll-cue`, pure markup + CSS, no new script): a
  real `<a href="#fptp-ballot-intro">` (the existing sticky viz card's id)
  wrapping a chevron `<svg>`, keyboard-reachable with a real accessible
  name. A new CSS `@keyframes` bounce — the project's first purely
  CSS-driven animation — guarded by its own
  `@media (prefers-reduced-motion: reduce)` block (every other animation in
  this codebase is WAAPI/JS, gated via `matchMedia`, so this needed a
  CSS-level guard instead). `html { scroll-behavior: smooth }` is wrapped in
  `@media (prefers-reduced-motion: no-preference)`, so the anchor jump is
  smooth normally and instant for reduced-motion readers, with zero JS.
  Below 900px the cue is `position: sticky; bottom: var(--space-lg)`
  (pinned to the *viewport's* bottom edge) rather than placed via flex
  `justify-content: space-between` (which would pin it to the *hero's own*
  bottom edge) — see the first bug fixed below for why that distinction
  matters. At 900px and up it switches to `position: absolute`, centred
  under the two-column row.

Three bugs turned up during the manual browser pass and got fixed before
this was called done:
1. **Scroll cue below the fold at both viewports.** `<header>` (~66px) plus
   `main`'s own top padding (`--space-xl`, 64px) sat above `.hero` before
   its `100vh`/`100dvh` min-height calculation even started, pushing the
   flex-`space-between`-positioned cue about 130px past the real viewport
   bottom. Fixed with a negative-margin/padding swap on `.hero`
   (`margin-top: calc(-1 * var(--space-xl))` cancels `main`'s padding,
   `padding-top: var(--space-xl)` re-adds the same visual gap *inside*
   `.hero`'s own box) plus a new `--header-height: 66px` token, so
   `min-height: calc(100dvh - var(--header-height))` lands the hero's true
   bottom flush with the viewport.
2. **Scroll cue still below the fold at 390×844 specifically**, even after
   fix 1. Root cause was different: the hero's real copy (headline +
   subheading + the paragraph) plus the illustration naturally render
   taller than one 390×844 screen, so a cue pinned to the hero's own
   (content-driven, now-overflowing) bottom edge via `space-between` was
   never going to be on-screen at load, regardless of the header fix. Fixed
   by switching `.hero-scroll-cue` to `position: sticky` below 900px (see
   the Scroll cue bullet above) — this keeps the cue anchored to the
   *viewport's* bottom edge from the first paint, independent of how tall
   the hero's actual content turns out to be.
3. **Illustration rendering far larger than intended, and overlapping the
   scroll cue at 390×844 after fix 2.** `class="hero-illustration"` was
   being passed from `index.astro` to `<HeroIllustration />`, but the
   component's frontmatter never forwarded it onto the root `<svg>` — Astro
   doesn't do that automatically — so the sizing rule never applied at all,
   and the SVG stretched to the full width of its flex container instead.
   Fixed per the Illustration bullet above; also removed a since-redundant
   `.hero-illustration-art { width: 100%; height: auto }` rule that would
   otherwise have won the cascade over the (now correctly attached)
   `.hero-illustration` sizing rule on the same element, and shrank the
   mobile illustration further (`min(38vw, 16rem)`, down from `60vw`).
4. **The cue/illustration overlap came back at 390×844 during the
   illustration-craft pass above**, and turned out to be structural rather
   than a one-off sizing mistake: at that width the hero's real copy alone
   is already taller than one screen, so the illustration — which flows
   normally, unlike the sticky cue — can end anywhere below the fold
   depending on exactly how the copy wraps, while the cue is always pinned
   near the viewport's bottom edge. Shrinking the illustration enough to
   guarantee clearance in every case would mean rendering it too small to
   read. Fixed by treating the cue as a self-contained floating badge
   instead of fighting the vertical-space budget: `.hero-scroll-cue` now
   has an opaque `background: var(--colour-paper)` (matching the page
   background, not the illustration) and a circular `border-radius: 50%` +
   hairline border, with `z-index: 1` so it paints in front of whatever the
   illustration is doing underneath it. The two elements' bounding boxes
   still overlap geometrically — confirmed via `agent-browser`, illustration
   bottom ~825px vs. cue top ~762px at 390×844 — but the badge cleanly
   occludes the overlap, so it reads as an intentional floating "scroll"
   affordance rather than a tangle of SVG lines. Confirmed by cropping and
   zooming a screenshot of that exact region (a plain "is the cue within the
   viewport" bounding-rect check can't see a visual collision like this —
   only looking at the rendered pixels can).

Checks:
- `spec/invariants.test.ts` and `src/styles/contrast.test.ts` stay green —
  the restructuring keeps exactly one `<h1>` and doesn't introduce any new
  text/background colour pairing outside what's already covered.
- `pnpm check` (typecheck, build, lint, full test suite) stays green.
- Manual browser pass (`pnpm preview`, both marking viewports), confirmed
  via `agent-browser` with real bounding-rect measurements and screenshots
  — including cropped/zoomed screenshots of the cue/illustration region, not
  just thumbnails — at both 1920×1080 and 390×844: the next section's card
  never peeks through on load at either viewport (`#fptp-ballot-intro` sits
  at ~1288px/desktop and ~972px/mobile, both well past the fold); the
  scroll cue is fully within the viewport at load and its badge treatment
  reads as a clean floating affordance rather than a collision with the
  illustration at mobile (see bug 4 above); the illustration renders at its
  intended size, its tick/number marks match `BallotPaper.astro`'s real
  hand-lettered paths, and it uses only chrome-palette tones — no candidate
  hues or the leader-badge gold visible; the cue remains a real,
  keyboard-focusable anchor (confirmed a visible focus outline via
  `getComputedStyle`) and clicking/activating it scrolls to "How the ballot
  works"; no console errors at either viewport.

## Feature: the conclusion closes the loop on the spoiler effect and Duverger's law

The previous introduction/conclusion pass (above, "an introduction, a
conclusion, and an explicit FPTP → IRV hinge") gave the conclusion a real
takeaway, but a follow-up question caught two threads it opened earlier
and never tied off: the spoiler-effect section names that term explicitly,
and the Duverger's-law section sets up the two-party-convergence problem,
but the conclusion only described the outcome in generic language ("that
split gets resolved") without calling back to either by name — exactly the
kind of dangling thread `CLAUDE.md`'s "close the loop" rule warns against.

Fixed by rewriting the conclusion into three paragraphs instead of one:
the first now names "the spoiler effect from earlier" directly against
Cedar's win, rather than re-describing the mechanic in new words. The
second is new, and deliberately narrow: it ties Duverger's law's
two-party-convergence pressure to the same sincere-vote-is-risky bind
Aster/Birch supporters faced, and states that preferential voting removes
*that specific incentive* — not a claim that IRV eliminates two-party
politics outright, which the demo doesn't show and the real-world
evidence doesn't support. The third paragraph keeps the original closing
line ("The votes never changed. The rules did...") unchanged, since it
already lands the point cleanly. No test asserts prose content — this is
a copy-only change, no markup/script structure changed.

Checks:
- `pnpm check` (typecheck, build, lint, full test suite) stays green — no
  markup structure changed, only text inside existing `<p>` elements.
- Read cold, start to finish, per `CLAUDE.md`'s "read it cold" rule: the
  new second paragraph was checked for overclaiming (it explicitly caveats
  "won't rebuild a multi-party system on its own") so it doesn't overstate
  what a three-candidate demo can prove about real electoral systems.

## Feature: an IRV free-play mode, sharing candidates and vote counts with the FPTP sandbox

Free play (`#freeplay-app`) only ever counted first-past-the-post, even
though the rest of the page's whole point is that the same votes can be
counted two different ways. The user asked for a second, IRV free-play mode
on the *same* candidates and vote counts, toggled with a "switch systems"
button. The open design problem: IRV needs a full preference ranking per
voter, but free play only ever tracked one first-preference count per
candidate — there was no ranking data to adjust at all. Resolved with the
user via `AskUserQuestion`: give the reader a **full, reorderable ranking
per candidate bloc** — for each candidate, an ordered list of every *other*
candidate representing where that candidate's own voters' preferences go,
in order, if their candidate is eliminated. This is the same one-ranking-
per-bloc simplification every `src/data/scenario-*.ts` file already uses,
just exposed as an editable control. Reordering is up/down move buttons per
list item, not pointer drag-and-drop, so it stays keyboard- and
touch-operable per this file's own accessibility bar, without a new
dependency.

- **Data model** (`src/lib/freeplay-candidates.ts`): `FreeplayState` gained
  `rankings: Record<CandidateId, CandidateId[]>`. `addCandidate` appends the
  new id last to every existing bloc's ranking and seeds the new candidate's
  own ranking as a full permutation of the rest; `removeCandidate` strips
  the removed id from every remaining ranking with no orphans; a new
  `moveRankingEntry(state, ownerId, candidateId, direction)` swaps a
  candidate with its neighbour, no-op at either boundary.
- **Scenario synthesis** (new `src/lib/freeplay-scenario.ts`): `toScenario`
  turns the editable state into a real `Scenario` (one `BallotGroup` per
  candidate, `ranking: [ownerId, ...rankings[ownerId]]`), so every existing
  tally/controller function (`tallyFptp`, `tallyIrv`, `createIrvController`)
  runs completely unchanged against it — no IRV-specific tallying logic
  needed in free play at all. `initialRankings` derives a starting rankings
  map from a scenario whose groups already carry one full ranking per
  candidate bloc, used to seed free play from the existing
  `scenario-freeplay.ts` data.
- **UI** (`src/scripts/freeplay-app.ts`): a `mode: "fptp" | "irv"` toggle,
  defaulting to `"fptp"` (unchanged existing behaviour). The editable
  candidate stacks/sliders are untouched; in IRV mode each stack additionally
  shows its ranking list (hidden via the native `hidden` attribute in FPTP
  mode). The recount panel (`[data-freeplay-recount]`) is wholly separate
  DOM, mirroring the scripted `#recount-app` section's exact contract
  (`.candidate-columns[data-ballot-drift]` of plain `[data-candidate]`
  stacks, plus `.recount-status`/`.recount-controls`) so `initIrvApp` and
  `initIrvDrift` — **including the chip-flight transfer animation** — run
  against it completely unchanged. Per the user's explicit follow-up
  ("make sure to also add the transfer animation like in 'Recounting the
  same election under IRV'"), this reuse is the point of the whole design,
  not an incidental detail. The recount panel is rebuilt from scratch
  (never patched in place) on every mode switch to `"irv"` and on every
  state-changing action taken while already in `"irv"` mode, always
  restarting the walkthrough at round 0 — a changed vote is a new election.
  No changes needed to `irv-app.ts`, `irv-drift.ts`, `tally-irv.ts`,
  `tally-fptp.ts`, or `irv-controller.ts`.
- **Styling**: `.freeplay-ranking-group`/`.freeplay-ranking` reuse only
  existing neutral chrome tokens (`--colour-ink-muted` etc.), visually
  subordinate to the candidate stack they belong to — no new colours, per
  this file's palette rule.

Checks:
- `src/lib/freeplay-candidates.test.ts` — extended for `rankings`:
  add/remove keep every ranking a full permutation of the remaining
  candidates with no orphans; new `moveRankingEntry` tests cover swap-up,
  swap-down, and no-op at both boundaries.
- `src/lib/freeplay-scenario.test.ts` (new) — `toScenario` builds one group
  per candidate with the owner first and the right count, and tallies
  correctly through the real (not mocked) `tallyFptp`/`tallyIrv`;
  `initialRankings` derives the right rankings from a hand-built `Scenario`.
- `src/scripts/freeplay-app.test.ts` — extended: toggling `switch-system`
  shows the ranking lists and recount panel and flips its own label; the
  recount panel's eventual winner (stepped through via "Next round" until
  final) matches `tallyIrv` run directly on the equivalent scenario; any
  edit made while already in IRV mode (a ranking move) resets the recount
  panel back to round 0; adding or removing a candidate while in IRV mode
  doesn't throw and leaves every ranking a valid permutation of the
  remaining candidates; all pre-existing FPTP-mode tests stay green
  unchanged.
- `pnpm check` (typecheck, build, lint, full test suite) stays green — 165
  tests passing. The stylelint pass caught one real
  `no-descending-specificity` issue (`.freeplay-ranking button` overlapping
  an earlier, higher-specificity `button:hover:not(:disabled)` rule), fixed
  by scoping the selector to `.freeplay-ranking-group .freeplay-ranking
  button` rather than suppressing the rule.
- **Manual browser pass** (`pnpm preview`, both marking viewports —
  1920×1080 and 390×844) — required before this is done, since it reuses
  the chip-flight transfer animation against reader-authored data for the
  first time: confirm the recount panel's next/prev-round transfer
  animation plays correctly for a freshly synthesized scenario; ranking
  move buttons and the mode-toggle button are keyboard-reachable with a
  visible focus ring; the ranking lists read clearly at phone width without
  crowding the stack; chrome colours (ranking list, move buttons, toggle
  button) are never confused with a candidate hue or the leader-badge gold.

## Fix: consecutive "Previous round" clicks lost the transfer animation

Reported bug: stepping forward through IRV rounds was "perfect" every time,
but stepping backward wasn't — the *first* "Previous round" click animated
correctly, but every consecutive one after it (without an intervening
"Next") showed no chip animation at all and the receiving stack jumped
straight to its correct tally instead of visibly depleting. This affected
both the free-play recount panel above and the original scripted
"Recounting the same election under IRV" section, since both are driven by
the same unmodified `irv-drift.ts`.

- **Root cause**: the "Feature: IRV transfer animation reverses on
  Previous..." entry above fixed the *desync* between `irv-app.ts`'s and
  `irv-drift.ts`'s controllers, but its own `LiveChip[]`/`liveEliminated`
  state was a single mutable slot holding only the *most recent* forward
  transfer — not a real per-round history. `reverseTransferChips()`
  unconditionally cleared that slot after using it, so exactly one reverse
  worked (whatever `spawnTransferChips` had just written), and every
  following "Previous" click found the slot empty and silently no-opped.
  This is why the earlier manual pass ("Next → Previous → Next → Previous →
  Next") never caught it: alternating clicks always refill the slot with a
  `Next` before the next `Previous` needs it, so only two or more
  *consecutive* "Previous" clicks — the case the user actually hit — expose
  the gap. The underlying round data itself (`irv-controller.ts`) was never
  wrong at any step; the numbers a reader saw after the animation skipped
  were always the correct tally for that round, just unanimated.
- **Fix**: replaced the single slot with `transferBatches`, an array pushed
  on every successful `next()` (one entry per round transition, `null` for
  the rare transition with nothing to animate) and popped on every
  successful `prev()`. `spawnTransferChips` now returns the batch of chips
  it created instead of writing to shared state; `reverseTransferChips`
  takes a specific batch as a parameter instead of reading a module-level
  variable. Because each "Previous" click pops and reverses its own real
  batch — the one that actually belongs to the step being undone — any
  number of consecutive clicks in either direction now animates correctly,
  not just alternating ones.
- Shared-code fix: since `irv-drift.ts` is used unmodified by both the
  scripted section and the free-play recount panel, this fix applies to
  both with no per-caller changes.

Checks:
- `pnpm check` (typecheck, build, lint, full test suite) stays green — 165
  tests passing, no new warnings (one unused-parameter hint from the old
  single-slot design was also cleaned up along the way).
- **Manual browser pass** (`pnpm preview`, both marking viewports —
  1920×1080 and 390×844), specifically targeting the case the earlier pass
  missed: stepped forward through all rounds, then clicked "Previous round"
  **twice in a row with no intervening "Next"** in both the free-play
  recount panel and the scripted section. Confirmed the animation now plays
  on every consecutive click (chips visibly flying back each time, not just
  the first), the settled tallies are correct with zero leftover chip
  elements in the DOM afterward, and the scripted section's single-reverse
  case (only one elimination in that scenario) still animates as before.

## Fix: a stray chip left hanging in a since-eliminated candidate's stack

Reported bug (screenshot, 6-candidate free-play scenario): after Dahlia was
eliminated in round 4 of a "Next round"-only walkthrough (never using
"Previous"), her stack bar showed an orange sliver floating partway up an
otherwise-empty column — visually disconnected from the bar, "hanging in
the middle of Dahlia's rectangle."

- **Root cause**: `spawnTransferChips` computes a landed chip's y-position
  once, via `computeFinalFillTop` at the moment it lands, and never
  revisits it — the chip is just a plain absolutely-positioned element
  holding that pixel position forever (or until `reverseTransferChips`
  explicitly flies it back out). That's invisible as long as the receiving
  candidate's fill only ever grows afterward: an older chip ends up
  submerged inside a taller fill of the same colour, indistinguishable from
  the solid stack. But if that candidate is *themselves* eliminated in a
  later round, their fill collapses toward zero while the old chip's frozen
  position doesn't move with it — stranding it above the now-short fill as
  a visible, disconnected sliver. Dahlia had received a transfer batch of
  chips two rounds earlier (when Beech was eliminated and her voters'
  ranking pointed to Dahlia next); those chips were never cleaned up on
  ordinary forward stepping, only ever reversed by an explicit "Previous"
  click undoing that exact round — which a reader who only ever clicks
  "Next" never does. The user's other observation in the same report —
  Dahlia's votes splitting to transfer into both Alder and Ebony on her own
  elimination — is correct IRV behaviour, not a bug: different blocs that
  had each landed in Dahlia's stack in earlier rounds carry their own
  distinct remaining rankings, so a single candidate's elimination
  routinely fans out to more than one receiver.
- **Fix**: a new `purgeStrandedChips(candidateId)` in `irv-drift.ts`, called
  right when a candidate becomes the newly eliminated one (before spawning
  that round's own outgoing transfer). It walks every batch in
  `transferBatches` and removes any chip whose `receivedBy` is that
  candidate — regardless of which earlier round's batch it belongs to —
  since there's no longer a matching fill underneath for it to sit in.
  Because this can now remove a chip out of turn, ahead of the "Previous"
  click that would otherwise have reversed its batch,
  `reverseTransferChips` skips any chip whose element is no longer
  `.isConnected` instead of assuming every chip it's handed is still live —
  reversing the rest of that batch normally, just without a redundant
  fly-back for the ones already purged.
- Shared-code fix: applies to both the free-play recount panel and the
  scripted section, same as every other `irv-drift.ts` fix, though the
  scripted scenario only ever has one elimination and so never exercises
  this path.

Checks:
- `pnpm check` (typecheck, build, lint, full test suite) stays green — 165
  tests passing, no new warnings.
- **Manual browser pass** (`pnpm preview`, both marking viewports —
  1920×1080 and 390×844): built a 6-candidate free-play scenario tuned so
  Beech's elimination (round 1→2) transfers into Dahlia, then Dahlia
  herself is eliminated two rounds later (round 3→4) — the same shape as
  the reported bug. Confirmed via the DOM that Dahlia's stack held 28
  landed chips right after receiving Beech's transfer, and exactly 0 right
  after her own elimination; confirmed visually (screenshot) that her bar
  is a clean, empty column with no stray fragment, at both viewports.
  Also stepped "Previous round" all the way back past that purge point (4
  clicks) with no console errors and the correct round-1 tallies restored,
  and re-ran the scripted section's own single-elimination case forward and
  back to confirm no regression there.

## Feature: disclose the tie-break rule wherever a tie is actually broken

A reader hit a genuine exact tie in free play (two candidates left, 500
votes each) and watched the recount silently pick a winner with no
explanation. `tallyFptp`/`tallyIrv` already break ties deterministically
(the candidate whose id sorts lower wins/survives) precisely so scenarios
stay reproducible and testable — confirmed with the user that the rule
itself should stay, but the page must say so explicitly whenever a tie is
actually the reason for an outcome.

- Shared helpers in `src/lib/format.ts`: `tiedCandidateIds(counts,
  outcomeId)` returns the other candidate ids sharing that exact count;
  `tieNote(tiedLabels, onWhat)` returns `""` when untied, otherwise a
  sentence fragment naming who it was tied with and that ties are broken
  alphabetically by name. Both covered by `src/lib/format.test.ts`.
- Four call sites reuse these: the FPTP explore winner banner (`app.ts`),
  the free-play winner banner (`freeplay-app.ts`, both FPTP and IRV
  modes), and IRV's round-status text for both the round-1 leader and an
  elimination (`irv-app.ts`), the latter needing a new
  `IrvController.justEliminatedTiedWith` getter (`irv-controller.ts`) to
  reach the previous round's counts.
- Two standing footnotes, static prose in `index.astro` right after the
  winner `<p>` in the explore and free-play sections (the only two
  sections a reader can actually drive to a tie), styled by a new
  `.tie-footnote` rule in `global.css` — muted, small print, clearly
  secondary to the winner banner. The scripted recount section uses a
  fixed, tie-free scenario, so it gets no footnote.
- Out of scope: no change to the tie-break rule itself or to
  `tallyFptp`/`tallyIrv`'s return types; no duplicate note on the
  per-candidate stack badges; no on-page copy about real-world tie-break
  practice (coin flips, by-elections) — already covered directly with the
  user, not requested as on-page content.

Checks:
- `pnpm check` (typecheck, build, lint, full test suite) stays green — 176
  tests passing, including new coverage in `format.test.ts`,
  `irv-controller.test.ts`, and `irv-app.test.ts` for tied and untied
  cases.
- **Manual browser pass** (`pnpm preview`, both marking viewports):
  reproduced the reported scenario in free play (drove two candidates to
  500/500 in IRV mode) and confirmed the round-status text names the tie
  and the rule at the moment one is eliminated; also drove the FPTP
  explore section and the IRV round-1 leading indicator to a tie via the
  sliders and confirmed each shows the note. Confirmed `aria-live` still
  announces the fuller sentence sensibly, the added text doesn't overflow
  or wrap awkwardly at 390×844, and the two standing footnotes read as
  clearly-secondary small print at both viewports.

## Copy: ground first-past-the-post in real stakes before naming it

The "How the ballot works" chapter dropped the term "first-past-the-post"
on the reader with no run-up and no reason to care beyond the mechanic
itself — a "cool demo, but so what?" gap per CLAUDE.md's "open with the
stakes" rule, since this is the reader's first contact with the term.

- The chapter's opening paragraph now names it explicitly as a voting
  system — "the voting system we'll look at first" — before describing
  the mechanic, and grounds it in real stakes: it's how elections are run
  across the United States, and how the United Kingdom, Canada, and India
  choose their governments, so a reader from any of those places is very
  likely looking at how their own vote actually gets counted.
- Deliberately doesn't claim it's how the US president is elected
  specifically (that's the Electoral College, a layer on top) — "across
  the United States" stays accurate to Congressional and state-level
  races without overclaiming.

Checks:
- Copy-only change: `pnpm check` stays green (176/176 tests, no code
  touched).
- **Manual read-cold pass**: read the new paragraph start to finish as a
  first-time reader — the term now has a reason to matter before it's
  used, and the added sentences don't overflow or wrap awkwardly in the
  narrow prose column at 390×844.

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
