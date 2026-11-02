---
name: plan-check
description: Question a plan before any code; running it approves the plan. A fresh subagent finds the edge cases the plan doesn't handle and the gaps it leaves; each becomes a question on the plan's page, charted on a real case with the recommendation first, and the author answers by number and letter. The answers go into the plan, and the build starts as soon as the last is in. Runs when plan-flows approves a plan, or by hand on any plan in docs/plans, which it approves.
---

# Plan check

plan-check runs between the author's approval and the first line of code. Running it is the approval: the author is
moving on from planning to building. Each **finding** is a behaviour the plan leaves open. The author decides every
finding, and the plan records each answer before anything is built.

Git stays with the author. While planning, write the plan file and nothing else: make no commit, and make or switch no branch. The
author commits the plan when they choose.

First check that this session has the code: a git repository in the working directory, and `node`. When either is missing, say that plan-check needs Claude Code or Codex opened on the code, and stop.

## 1. Take the plan

The plan is the one plan-flows just approved, the file in `docs/plans` the author names, or the plan this session drew
last. Its drawings are plan-flows' step 3, with `page.mjs` (`../../page/page.mjs` from this skill's folder). Run
`node <page.mjs> seen docs/plans/<change>.json` now, and again each time the author's answers arrive, before you edit
the plan: each drawing outlines what changed since the author last read it.

Its approval, when it has one, is its `approved`; the fingerprint and the approval's form are in plan-format.md
(`../plan-flows/plan-format.md` from this skill's folder). A plan not approved at its current fingerprint is approved
by running plan-check: step 4 writes it once every question is answered. Questions still open under Questions from plan-flows stay on the page, and the author answers them
together with plan-check's.

## 2. Find what the plan leaves open

Start one fresh subagent the way this harness starts one (in Claude Code, the Agent tool with a general-purpose agent),
so the plan is questioned by someone who didn't write it. Give it this brief, with nothing from this chat, and the
paths filled in: the plan's, and blocks.md's and plan-format.md's in full (`../../page/blocks.md` and
`../plan-flows/plan-format.md` from this skill's folder):

> Read the plan at `<plan>` and the repository's code as it is now. Read only, and change nothing.
>
> For every step or check the plan marks `+`, `~` or `-`, read the code it touches, every caller of that code, the
> tests that run it, and the repository's docs and recorded decisions that describe it. Then list each finding: a
> behaviour the plan leaves open whose answer changes what someone gets, such as a response, a page, an exit status,
> an error, a write or an event. Look for each kind:
>
> - **Another way in**: a caller, route, job, command or public function that reaches a changed step, which no flow
>   covers.
> - **An unhandled input or state**: empty, missing, duplicate, too large, another person's, or a record in another
>   state.
> - **Twice at once**: the flow run concurrently, retried, or stopped half-way.
> - **An unsaid outcome**: a check with a branch whose end the plan doesn't say, or an outside call whose failure it
>   doesn't handle.
> - **A pinned behaviour**: a test the change breaks, or a behaviour a test pins that the plan doesn't mention.
> - **A contradiction**: a doc, recorded decision or comment the plan contradicts, or two parts of the plan that
>   disagree.
>
> Leave out what the plan's Already settled section answers, what its Questions sections already ask, and any finding
> whose answer changes nothing anyone gets. Done when every changed step has been checked for each kind, and every
> caller and test of the code it touches has been read.
>
> Return the findings, with the one that changes most for the people using the code first, each as:
>
> - a line `### <n>. <headline, at most 12 words>`;
> - a line `Changes: <the plan's flows, steps, screens or traces this answer changes>`;
> - the finding as one `choice`, in a `json` block, written as `<blocks.md>` and the choice section of
>   `<plan-format.md>` give it, with no `number`. Its `question` is complete on its own and carries one concrete case
>   with real values: who does what, in which state. Its 2 to 4 options are behaviours the code could have, each
>   charting the case to what the person gets, a step of code carrying its `where` (`file:line`, or "new code").
>   Recommend first the one that the code, a test, a doc or the plan's own reason supports, and say which in `why` (a
>   test by name, `file:line`, a doc, a decision). When nothing supports any of them, recommend the safest one for the
>   people using the code, and say so.
>
> Then a `names` item for each name your findings use that the plan's Names has no item for. Return "Nothing to ask"
> when there is no finding.

When the subagent returns:

- If it failed, or returned neither findings in that form nor "Nothing to ask", tell the author "plan-check didn't
  finish", say why (its error, or what it returned instead), and offer to run it again. Stop here.
- If it returned "Nothing to ask" and no question from plan-flows is open, write `approved` by step 4's second
  part when the plan has none matching, draw the page by plan-flows' step 3 so it shows "Approved", tell the
  author "Nothing to ask; building now", and build by step 5.
- If it returned "Nothing to ask" and questions from plan-flows are open, go on to step 3 with those alone.

## 3. Put the findings on the page

1. Check each finding against the code yourself before it goes on the page, by reading the places its `why` and
   its steps' `where` cite. Correct a case or an option the code contradicts, and drop a finding the plan already
   answers.
2. Put each finding's `choice` under Questions from plan-check, in the subagent's order, numbered on from the highest
   question still open. Open the section with a paragraph saying how many findings there are and how to answer. Add
   the subagent's `names` items under Names.
3. Say in What I'm asking how many questions are open.
4. Draw the page by plan-flows' step 3 (`../plan-flows/SKILL.md`); its one cold read covers the new questions. Ask
   at once, while it runs: the author answers each question by picking an option on the page, which copies the
   answers (`3 A`, or `1 A, 3 B` for several) to paste into the chat, by typing its number and letter, with Comment on
   its box, or in their own words. In the chat, say how many questions are open, not what they are.

Done when every question is on the page, charted, in front of the author.

## 4. Write the answers in

1. Write each answer in as plan-flows' step 4 does; the finding's `Changes` line names the parts it decides.
2. Once no question is open, write `approved` with the tail ` · after plan-check` (plan-format.md), replacing any
   older one.
3. Draw the page by plan-flows' step 3 once for each message of answers. Answers are the author's own words, so it
   needs no cold read.

Done when the page shows every answer, outlined, and `approved` matches the plan. Then build by step 5.

## 5. Build

The author's last answer is their go-ahead: answering plan-check's questions is the last thing they do before the
code, so start building at once, in the same turn, without asking whether to. The harness's own permission prompts apply as usual. Say in a line that the plan is
approved and the build has started. Build by plan-flows' step 7 (`../plan-flows/SKILL.md`): it asks the author nothing
the plan answers, and shows every plan change with the code before anything is committed.
