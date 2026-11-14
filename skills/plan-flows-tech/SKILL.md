---
name: plan-flows-tech
description: Draw the technical page of a plan, for the engineer who will build it and wants to learn how - how the pieces fit and what each runs on, the ideas behind the approach drawn on the plan's own example, why the established way beats the obvious one, and how each case runs through the pieces. Reuses the plan in docs/plans and the research and code traces plan-flows saved beside it. plan-flows draws it by itself when a change adds a part or connects parts; use it whenever someone wants the technical side of a plan, asks how a planned change will be built, or wants to understand the technology a plan uses.
---

# Plan flows, the technical page

A plan's own page is for the person deciding what gets built. This page is for the engineer building it, who may know
nothing of this kind of code (someone asked for a search index who has never built one), and who should come away able to
build it and to explain why it is built that way. It decides nothing: every decision stays on the plan's page, where it
is asked, flipped and recorded.

Read [teaching.md](../teaching.md) in full before step 1: the page, its cases, the worked example and its pictures, the
two reading questions, and How the pieces fit hold here as on any page. Then check the session by teaching.md's Before
reading the code.

Write the tech page's data and nothing else: `docs/plans/<change>.tech.json`, beside the plan.

## 1. Take the plan

Take `docs/plans/<change>.json`: the one the person names, the one plan-flows just drew, or the only plan changed on
this branch. Read it, and `docs/plans/<change>.notes.md` beside it, which holds what plan-flows' research subagents
and code readers returned. When there are no notes, or the plan's fingerprint (`node <page.mjs> fingerprint`) differs
from the one the notes name, do that part of plan-flows' step 1 again for what changed (research the parts' technology,
trace the ways in) and write the notes as plan-flows does.

Done when you know each part the change adds, changes or passes through, what each runs on, and, for each technology
the plan uses, the established way, the obvious way and what goes wrong with it, and the sources.

## 2. Write the page

The page is an explanation, drawn with `page.mjs explain`. Its `title` is the plan's followed by ": how it's built";
its `about` links the plan's page (its `reviewPage`) and names the plan's file and fingerprint. Follow the plan's
example throughout, with the same people and values. The sections, in this order:

1. `In short`: two or three sentences: what gets built, from which parts, and on what.
2. `How the pieces fit`: one chart of the parts, by teaching.md's How the pieces fit.
3. `The ideas behind it`: one chart for each idea the engineer must hold to build this (for a search index: what
   the index holds for each record, how a query's results are ranked, why the index is rebuilt when the records
   change), each drawn on the plan's example as a person would see it, a picture at each step. Only
   the ideas this build needs, most needed first.
4. `Why this way`: for each technology the plan picked, one chart with `columns` "The obvious way" and "The way it's
   built", the same case under each, the obvious way charted to what goes wrong, and the sources linked in its
   `about`. Name the plan's question or call that picked it by its words, never its number, so the engineer knows
   where to change it.
5. `How each case runs`: for each of the plan's cases, one `case` with its title and `gets`, and its `after` as
   `steps` without marks, each step with its `part`. A step of existing code carries the `where` of the function it
   calls; a new step has no `where`, and says what it does, never a class or a file.
6. `Check your reading`: two `question`s on the build: which part does what for the example, what goes wrong under
   the obvious way.
7. `Names on this page`.

A part's technology is decided on the plan's page, not here (teaching.md's How the pieces fit, on a plan): this page
explains the decision and names where it was made. Pictures are this page's own: draw again, under its `pictures`,
any it shares with the plan.

High level, as teaching.md's How the pieces fit says: parts, what passes between them and why, never classes, file
layout, schemas or order of work. A choice that comes up while writing goes on the plan's page as a question or a call
(plan-flows step 2), never on this one.

Done when every part the plan adds has its box, every technology its Why this way, every case its run through the
pieces, and each chart draws the example.

## 3. Draw and show it

Run `node <page.mjs> explain docs/plans/<change>.tech.json` and fix what it prints, then show the page by teaching.md's
Show the page, its own path each time so it keeps its link. Read it cold once, by teaching.md's Read it cold. In the
chat, give its link in a line beside the plan's.

Whenever the plan changes after this (an answer, a flip, plan-check, a plan change), draw this page again from the new
plan before the person is shown either, so the two never say different things.

Done when the page is in front of the person, at the plan's current fingerprint.
