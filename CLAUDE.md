# COMP4020 prototype

This is your starter repo for a COMP4020 prototype: a static site written in
HTML/CSS/TypeScript that builds to plain HTML/CSS/JS and deploys to GitHub
Pages. The **deployed site is what gets marked** --- not this repo, and not "it
works on my machine". It's marked live in Chrome against the deployed URL at two
viewports --- 1920×1080 (desktop) and 390×844 (phone) --- and both count in
full, so make that artefact good at both and use the checks below to know
whether it is.

What you're building this week — the spec — is published on the course website,
and this repo's name tells you which deliverable it is. Run the course plugin's
**start** skill at the start of each week: it pulls the right spec from the
course API, carries your harness forward from last week, and helps you turn the
spec's checkable lines into tests of your own. Read the spec before you build,
and see `spec/README.md` for how the checks in this repo relate to it.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Before you push, run `pnpm check`. It runs most of what CI runs --- build,
  lint, and the spec --- so you catch those in seconds instead of waiting for
  the pipeline. The links check, the evidence check, the secrets scan, and the
  deploy itself only run in CI; run `pnpm dlx linkinator ./dist --silent`
  locally against a fresh `pnpm build` for the links check without waiting for
  CI.
- To see what the page actually looks like rather than what you assume it looks
  like, open it in a browser (the `agent-browser` CLI, documented on
  [the course site](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/backpressure/#agent-browser-the-rendered-page-as-ground-truth),
  works well for this). The rendered page is the truth; your mental model of it
  isn't.
- When a check fails, read its output before changing anything. Each check below
  names what it measures, and the failure message is the instruction: it tells
  you the file, the line, or the contract. Treat a red check as authoritative
  --- the page is wrong until the check is green, not until you decide it should
  be.
- Keep `PLAN.md` current. Before building a feature, write or update its
  entry in `PLAN.md` --- what it does, why, and what "done" looks like --- and
  name the check that will prove it: a `spec/*.test.ts` assertion, a
  co-located unit test, or (for things a test can't reach, like an animation
  or a layout at a marking viewport) an explicit manual browser pass. A
  feature with no corresponding check in `PLAN.md` isn't planned yet, it's
  just started. Update the plan as you build, not just before --- if reality
  disagrees with what's written, the file is wrong, not the code.
- Commit when the checks pass. Never commit a red state.

## The site is one story, not two feature demos

This piece has one job: walk a reader with no background in voting systems or
politics from "here's a simple election" to "here's why the rules you count
it under can change who wins" and out the other side understanding both the
flaw and the fix. That's a narrative arc, not a pair of interactive demos
stapled together — hold every section to that bar, not just to "does the
mechanic work."

- **Assume nothing.** The reader may not know what "preferential voting,"
  "spoiler effect," "IRV," or "Duverger's law" mean, and may never have
  thought about how counting rules can change an election's outcome at all
  — the one thing they can be assumed to know is what a ballot paper looks
  like. Define a term in plain language the first time it's used, in the
  flow of the story, not as a glossary aside. If a sentence only lands for
  someone who's already taken a politics class, rewrite it.
- **Open with the stakes, not the mechanic.** The introduction's job is to
  give the reader a reason to keep scrolling before it teaches them
  anything — why would the way votes get counted matter to *them*? Lead
  with that motivation, then bring in the ballot paper and the election.
- **Close the loop.** The ending needs a real conclusion — key takeaways
  stated plainly and tied back to the question the introduction opened
  with — not just a "free play, have fun" hand-off with no summary. Free
  play is a bonus after the story lands its point, not a substitute for
  landing it.
- **One election, one throughline, carried on purpose.** `PLAN.md`'s
  Premise section already establishes the mechanism: the same hypothetical
  election is recounted, not replaced, when the story moves from FPTP to
  IRV. Protect that when adding or changing sections — a new mechanic that
  doesn't refer back to the same scenario breaks the "second look at the
  same election" logic the whole piece depends on.
- **The FPTP → IRV transition is a hinge, not a scene break.** The reader
  should never feel like they've closed one explainer and opened another.
  The transition needs to say what's about to happen and why — *we just
  saw this go wrong under FPTP; here's the same votes, counted a different
  way* — before the mechanic changes under them. FPTP lives in
  `app.ts`/`ballot-drift.ts` and IRV in `irv-app.ts`/`irv-drift.ts` as
  separate implementations for good engineering reasons, but that split
  must never be visible to the reader as a change in voice, tone, or
  assumed knowledge.
- **Read it cold before calling a section done.** The narrative equivalent
  of animation's "not green until watched": read new or changed copy start
  to finish as if you were a first-time reader with no context, out loud if
  that helps catch stumbles. If you have to reread a sentence to parse it,
  or a section doesn't make clear why it follows the one before it, that's
  a bug in the story, not a matter of taste.

## Design system: editorial, not generic

The visual language is a deliberate news/long-form-journalism system, not the
starter template's system-ui defaults. It exists to make the page read as a
piece of considered journalism about a real mechanism, not a form with some
widgets on it — so hold new markup and CSS to this, not just "does it work."

- **Serif headlines, sans body, on purpose.** `h1`/`h2`/`h3` use **Fraunces**
  (variable, Google Fonts; weight 600 for `h1`/`h2`, 500–600 for `h3`,
  `font-optical-sizing: auto` so its characterful low-opsz shapes show at
  display sizes; fallback `Fraunces, Georgia, "Times New Roman", serif`).
  Everything else — body copy, buttons, nav, labels, candidate names, vote
  counts — uses **IBM Plex Sans** (400 body, 500 for buttons/labels/UI
  emphasis; fallback `"IBM Plex Sans", system-ui, sans-serif`). Both were
  chosen for character over a generic system stack; don't reach for
  system-ui/Arial/Helvetica for new elements. Loaded via Google Fonts
  `<link>` (preconnect + stylesheet, `display=swap`, only the weights in use)
  — `swap` plus the serif/sans fallback stacks mean text is never invisible
  waiting on the font request. Base body size is `1.125rem`/line-height 1.7
  for premium long-form reading; buttons keep an explicit `1rem` so controls
  don't inherit the larger reading size.
- **Palette is neutral chrome, not another candidate colour.** Tokens live in
  `:root` in `global.css`: `--colour-paper` (warm ivory page background),
  `--colour-surface` (slightly lifted panels — ballot paper, sticky viz,
  buttons), `--colour-ink` (primary text), `--colour-ink-muted` (secondary/
  meta text), `--colour-hairline` (borders/dividers), `--colour-accent` /
  `--colour-accent-hover` (a deep, desaturated plum, ~300° hue). The plum is
  a deliberate choice, not a default: candidate data (`src/data/scenario-
  *.ts`) already occupies blue ~200°, orange/vermillion ~20–40°, and green
  ~160° (an Okabe-Ito colour-blind-safe set), and the leader badge already
  claims gold ~45° — plum is the one hue none of that data uses, dark and
  desaturated enough to read as structural chrome rather than a vote.
  **Never** reuse a candidate hue or the leader-badge gold for chrome, and
  never give the accent colour a fill large enough to be mistaken for a
  candidate's stack or swatch — links, focus rings, and hover borders only.
  Candidate colours and the leader-badge gold are data-semantic and out of
  scope for styling passes like this one.
- **Generous, uniform whitespace is a layout rule, not a per-section
  choice.** Every top-level section under `main` — `.chapter`s and the plain
  intro/Duverger/conclusion/free-play sections alike — shares one spacing
  rule (`--section-gap: clamp(4rem, 10vw, 9rem)` via `main > section`), not
  a value some sections happen to set and others forget. A reader should be
  able to feel one section end and the next begin before any new content
  starts, every time, not just where a `.chapter` wrapper happened to add
  margin.
- **The reading column is narrower than the sticky visualisation on
  purpose.** `--prose-max-width` (~34rem, roughly 60–65 characters at the
  new body size) caps prose text — both `.chapter-prose` and the plain
  sections' heading+paragraph — while `.chapter-viz` and the free-play
  widget are allowed the remaining width. That asymmetry (narrow story,
  wide data) is what makes the page read as premium long-form storytelling
  next to its own evidence, rather than two equal-width columns. Keep it
  when adding sections: a new chapter's prose shouldn't stretch to match its
  viz.
- **One grid, everywhere.** `--content-max-width` (72rem desktop cap) and a
  fluid horizontal padding (`clamp(1.25rem, 4vw, 3rem)`) on `main` are the
  only things that should ever set the page's outer margins — don't
  hand-roll a one-off max-width or padding on a new section. Consistency of
  the outer grid is what makes the whole page feel like one document instead
  of a sequence of separately-styled demos.
- **Out of scope, on purpose.** No dark mode / `prefers-color-scheme`
  support, and no new section-kicker copy (e.g. "Part one" labels) — this is
  a chrome/typography/spacing system, not a new content pass. If either
  becomes worth doing, it's a separate decision, not an accidental side
  effect of touching `global.css`.

**Checks**: `pnpm check` must stay green after any styling change.
`src/styles/contrast.test.ts` computes real WCAG contrast ratios for the
token pairs that carry text (ink/paper, muted-ink/paper, accent/paper) and
asserts they clear 4.5:1 (normal text) / 3:1 (large text, UI) — a palette
change that fails it is a real accessibility regression, not a nitpick. And,
same rule as animation: a passing test proves the numbers are right, not
that it looks right — before calling a styling change done, look at it in
`pnpm preview` at both marking viewports (1920×1080, 390×844) and confirm
fonts render cleanly, the narrow-prose/wide-viz asymmetry is visible at
desktop, section whitespace feels consistent scrolling top to bottom, chrome
colours are never confused with candidate colours, and every interactive
element still shows a clear focus ring and stays keyboard-operable.

## Animation is a first-class feature, not garnish

Animation is one of the things meant to make this prototype stand out, and
in this piece it does real work: a ballot flying from one section into a
candidate's stack is *how* the reader is shown that ballot belongs there.
Motion here is argument, not decoration — hold it to a real bar, not a
vibe check.

- **Not green until watched.** A passing test proves the keyframes/values
  are correct; it doesn't prove the motion looks right. No animation is
  done until someone has watched it play, full duration, in a real browser
  (`pnpm preview`) at both marking viewports. That's the actual check for
  this class of bug — `PLAN.md`'s "manual browser pass" line for each
  feature is not optional polish, it's the check unit tests can't do.
- **Janky is a bug, not a taste call.** If it stutters or looks wrong,
  something specific is wrong: competing animations forcing layout thrash,
  a duration that doesn't match the distance/scale of the move, too many
  properties changing on one element at once, an easing curve fighting the
  direction of travel. Diagnose which one and fix that, rather than
  retuning numbers by feel until it seems okay.
- **Every animation should answer "what is this telling the reader?"** If
  the motion doesn't map onto a fact or relationship the reader should take
  away (this ballot belongs to that stack; this candidate's votes just
  transferred there), it's decoration — cut it or simplify it rather than
  keep it for visual appeal alone.
- **When the same fix keeps getting reapplied by hand, it belongs in the
  shared helper** (`spring.ts`), not scattered per-call tweaks — that's the
  difference between fixing an animation and fixing animation.

## The checks (your sensors)

CI runs these on every push once your repo is public. GitHub's checks UI shows
two jobs, `check` and `deploy` --- not one status per sensor below --- and
within `check` the steps run in sequence (`pnpm check` chains typecheck, build,
lint, and the spec with `&&`), so an early failure like a broken build stops the
later sensors from running for that push; fix it and push again to see the rest.
While the repo is private (all week, until you ship) the CI jobs stay skipped
--- `pnpm check` is the same roster on your machine, and it's the faster loop
anyway. They aren't hoops. Each is a different way of finding out something true
about the site that you can't reliably see by looking at it.

They also carry a mark at a crit: the sweep runs fifteen minutes after your
cutoff, and green checks there are worth half that week's shipped mark. Still
running counts as not green, so ship with time for CI to finish.

- **typecheck** --- `tsc --noEmit` runs first in `pnpm check`, so a type error
  stops the roster before the build even starts. The types are extra
  backpressure: a red here is the compiler telling you a claim in the code is
  false.
- **build** --- the site must build (`pnpm build`). A build failure means the
  deployed site is broken or stale, so nothing else matters until this is green.
- **deploy / online** --- the live GitHub Pages URL must load and return the
  page you expect. An asset that 404s on the deployed URL counts as broken even
  if it loads locally.
- **spec** --- `spec/invariants.test.ts` asserts what's true of any good
  website, whatever the week's brief asks; the tests you write for the week's
  own spec run alongside it (any `spec/*.test.ts`). A failure names the contract
  you haven't met yet.
- **lint** --- `stylelint` for CSS, `oxlint` for TypeScript. Flags code that's
  wrong, fragile, or non-idiomatic. Read the rule it names.
- **tests** --- any other tests you write, wherever you put them (co-located
  with your source is fine, not just `spec/`), must pass. Vitest picks up both
  this and the spec suite in one `vitest run`, the last step of `pnpm check`. A
  failing test is a claim about the site that's no longer true.
- **evidence** (`pnpm check:evidence`) --- checks your process evidence:
  `PROCESS.md`'s citations resolve to real commits, the current deliverable's
  exact reflection is in `reflections/` (worked out from this repo's name
  against the public course API), and your `CLAUDE.md` is present. Evidence
  gates the deploy --- `deploy` needs `check` to pass, so failing evidence
  blocks the deploy alongside everything else. See
  [Your process is part of the mark](#your-process-is-part-of-the-mark) below,
  and the course website's
  [assessment page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#what-you-submit)
  for what counts as evidence.
- **links** --- internal links must resolve. A broken link is a dead end you
  didn't mean to ship.
- **secrets** --- the repo is scanned for committed credentials. Never put a
  key, token, or password in a tracked file. If one leaks, rotate it. A local
  pre-commit hook (`.githooks/pre-commit`, installed by `pnpm install`) also
  blocks any commit containing something shaped like an API key --- by the time
  CI sees a key it's already pushed, so the hook is the sensor that matters.

Nothing here measures **accessibility** or **performance** --- wiring those
sensors (`axe-core`, Lighthouse, or whatever you choose) is your work, and later
in the course the spec will ask you to show how you tested both. When you do,
read a green performance result honestly: it's a lab estimate from one run on a
CI machine, not proof the site is fast for real users.

## The stack is swappable

Out of the box this is plain HTML/CSS/TypeScript on Vite, and every `.html` file
in the repo is a page: add pages, link them, and the build picks them up with no
config. That's a default, not a rule (unless the week's spec says otherwise).
You can swap in Astro or any other static generator, because nothing in CI names
a tool --- the whole contract is:

- `pnpm build` emits the complete site into `dist/`
- the `package.json` scripts (`check`, `check:evidence`, `build`) keep working
- whatever lands in `dist/` still passes the invariants in `spec/`

Two things bite in a swap. The deployed site lives under a path
(`…github.io/<repo>/`), so configure your generator's base path --- this
template's Vite config uses relative asset URLs to sidestep that, but most
generators (Astro included) need `base` set explicitly, and getting it wrong
looks fine locally while every asset 404s on the live URL. And commit the
updated `pnpm-lock.yaml`: CI installs with `--frozen-lockfile`.

## Your process is part of the mark

The deployed page is only half of it. How you got there is marked too: your
commit history, your agent files, and the decisions visible across them. The
checks above can't see any of that, so a person reads it directly --- which
means building legibly is part of building well.

- **Commit as you go.** Small, frequent commits are the record of how the work
  came together, and that record is read, not just the final state. A trail that
  grew alongside the code is the strongest evidence of your process; a single
  dump the night before is the weakest.
- **Keep a process overview** (`PROCESS.md`). A short reading-guide, not an
  essay: what you built, the moments that mattered --- each pointing at a
  commit, a `CLAUDE.md` change, or a prompt and the commit it produced --- and
  where to look in the history. It points a marker at the evidence; it doesn't
  stand in for it, and claims the history doesn't back don't count. The
  `PROCESS.md` in this repo is a template showing the shape and the citation
  format (link text the commit hash or range, target the commit or compare URL);
  `pnpm check:evidence` verifies your citations resolve to real commits before
  you ship. Markers follow those citations and don't trawl the repo for evidence
  you didn't cite.
- **Write your reflection in `reflections/`** --- a short markdown file in this
  repo, named for the deliverable it answers, so the number in the filename is
  the number in this repo's name (`crit-1.md` in `comp4020-crit1-<you>`,
  `assignment-1.md` in `comp4020-ass1-<you>`); `reflections/README.md` has the
  full rule. `pnpm check:evidence` checks the exact current name against the
  course API, not merely the presence of any well-named file. It answers the two
  standing prompts: the breakthrough that moved the work forward, and what this
  work changed about the developer you want to be. It stays out of the deployed
  site. It's due at the cutoff, and if it isn't in the repo by then the week
  doesn't count as shipped, however good the prototype is.
- **This file is process evidence.** The harness you build to direct the agent,
  this `CLAUDE.md` and any `AGENTS.md`, is itself read as part of how you
  worked. Keep it honest and current (see below).

You don't need a name, a student number, or any identity file in the repo: we
know whose repo it is. Spend the effort on the work.

## This file is yours

This CLAUDE.md is a starting point, not a fixed rulebook. As you learn what your
prototype needs --- a convention to hold the agent to, a sensor that keeps
catching you out, a fact about the stack the agent keeps getting wrong --- write
it down here. Growing this file is the work of harness engineering, and the gap
between this boilerplate and your own version is part of what your prototype
says about the developer you're becoming.
