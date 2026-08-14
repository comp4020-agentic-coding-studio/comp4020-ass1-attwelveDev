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

1. **How FPTP works.** Reader sees a simulated ballot paper (a full ranked
   preference order) and, on scroll, watches it drift and land on one of three
   stacks — the candidate it ranked first. Stacks double as the bar chart.
   Sliders (one per candidate, native `<input type="range">`, redistributing
   the remaining pool proportionally) let the reader freely explore outcomes.
2. **Transition to the flaw.** The story pivots from free exploration to one
   authored, hand-tuned scenario that reliably produces a spoiler-effect
   result — vote splitting between two similar candidates hands the win to a
   less-preferred third. This authored scenario (not whatever the reader left
   the sliders at) is what carries forward into the IRV recount.
3. **The flaws.**
   - *Spoiler effect* — primary, fully interactive, demonstrated on the
     authored scenario.
   - *Strategic voting* — shown via one or two of the sampled ballot papers:
     the voter's sincere ranking vs. the vote they'd need to cast tactically
     under FPTP.
   - *Two-party convergence (Duverger's law)* — one text paragraph, no new
     visualisation. It's a claim about many elections over time, not this one
     scenario, so it doesn't get a second mechanic.
4. **How IRV works, recounting the same election.** Same ballot-paper objects,
   same stacks. Last-place candidate is eliminated and those ballots drift to
   their next preference's stack. With 3 candidates this is at most one
   elimination round. Reader watches the spoiler resolve.
5. **Takeaway + free play.** A closing line, then a free-play mode: the reader
   can add or remove candidates and freely adjust votes, no scripted outcome.

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
  would be much harder to make keyboard- and screen-reader-accessible.
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
