# Process overview

## What I built

A storytelling site explaining first-past-the-post (FPTP) voting, its
flaws, and how preferential voting (IRV) resolves them; showing that the
voting system itself, not just the votes cast, can decide who wins. The core
interaction is a sticky visualisation paired with scrolling prose: readers
can drag a candidate's vote stack and watch the winner change under both
systems, or step through IRV's recount rounds.

## The moments that mattered

### Clarifying the storytelling structure, and audience

With the explanations all in place, the page still lacked an introduction,
a conclusion, and a smooth transition between the two voting systems, and
some sections assumed background knowledge readers wouldn't have, e.g., the
spoiler-effect section named no effect and read clunky:

![lack of clarity in spoiler effect section](docs/audience_clarity_before.png)

Instead of re-prompting to patch this one page, I had the agent write the
cohesive-story requirement into `CLAUDE.md` (assume no background knowledge,
require an intro, a conclusion, and a smooth transition), so every future
prompt would keep honouring it rather than drifting back
([`72ac3a0...b0a80da`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-attwelveDev/compare/72ac3a0...b0a80da)).
I confirmed it worked by checking the intro/conclusion landed and rereading
the same section:

![improved clarity in spoiler effect section](docs/audience_clarity_after.png)

The rule then paid off unprompted, when I later asked the agent to cover how
IRV mitigates FPTP's flaws, it independently added that summary to the
conclusion too.

### Solidifying the visual language

The site started plain, with no visual personality:

![website before redesign](docs/visual_redesign_before.png)

Rather than just handing the agent a one-off design brief and building
immediately, I had it write the agreed design language, serif headlines,
sans body, a neutral non-partisan palette, generous whitespace, a narrower
text column than the sticky visualisation, into `CLAUDE.md`, with checks where
applicable, so later changes would keep matching it, not just this pass
([`72ac3a0`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-attwelveDev/commit/72ac3a0998182730427bbf1ae2ee6e4c8efffa50)).
I knew it worked because the new checks passed and I visually confirmed the
result against the brief at both marking viewports, fixing a couple of
alignment/padding issues that turned up:

![website after redesign](docs/visual_redesign_after.png)

### Emphasising the importance of animations on user experience

Getting the ballot-to-candidate-stack and vote-transfer animations to look
real was the hardest part; early attempts produced a small icon instead of
the full ballot card, at the wrong size, and it lingered awkwardly after
landing. Since "realistic" and "cohesive" have no fixed standard, patching
each glitch as it appeared wouldn't stop new ones recurring.

Instead, I had the agent write an animation standard into `CLAUDE.md`:
animations must read as smooth, not janky, and must carry meaning (e.g., a
flight path showing two things are related), and required tests for them
that had to go from red to green before being trusted
([`37379b0...f6b7e1c`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-attwelveDev/compare/37379b0...f6b7e1c)).
Those tests failed at first, as expected, then passed as the agent iterated,
and I visually confirmed the final animations at both viewports. The lasting
payoff is a test suite that now guards every animation against regressions
from future changes.
