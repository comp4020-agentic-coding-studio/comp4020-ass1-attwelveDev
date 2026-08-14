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
  than reverse-playing the drift.
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
