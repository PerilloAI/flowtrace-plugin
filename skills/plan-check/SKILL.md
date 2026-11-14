---
name: plan-check
description: Question a plan before any code; running it approves the plan. A fresh subagent tries to prove the plan's premises false, and finds the cases the plan doesn't handle and the gaps it leaves; each that only the author can decide becomes a question on the plan's page, charted on a real case with the recommendation first, and the rest become Claude's calls the author can flip. The answers go into the plan, and the build starts as soon as the last is in. Use when plan-flows approves a plan, and whenever the person asks to check, question or approve a plan in docs/plans, or to start building one.
---

# Plan check

plan-check runs between the author's approval and the first line of code. Running it is the approval: the author is
moving on from planning to building. Each **finding** is a premise of the plan that doesn't hold, or a behaviour the
plan leaves open. The author decides every finding, and the plan records each answer before anything is built.

Read [teaching.md](../teaching.md) in full before step 1: it holds the rules plan-check shares with the other skills.
Then check the session by its Before reading the code. While planning, write the plan file and nothing else; the
author commits the plan when they choose.

## 1. Take the plan

The plan is the one plan-flows just approved, the file in `docs/plans` the author names, or the plan this session drew
last. Its drawings are plan-flows' step 3, with `page.mjs` (`../../page/page.mjs` from this skill's folder). Run
`node <page.mjs> seen docs/plans/<change>.json` now, and again each time the author's answers arrive, before you edit
the plan: each drawing outlines what changed since the author last read it.

Its approval, when it has one, is its `approved`; the fingerprint and the approval's form are in plan-format.md
(`../plan-flows/plan-format.md` from this skill's folder). A plan not approved at its current fingerprint is approved
by running plan-check: step 4 writes it once every question is answered. Questions still open under Questions from
plan-flows stay on the page, and the author answers them together with plan-check's.

## 2. Find what the plan leaves open

Start one fresh subagent by teaching.md's A fresh subagent, so the plan is questioned by someone who didn't write it.
Give it this brief, with the paths filled in: the plan's, and premises.md's, teaching.md's, blocks.md's and
plan-format.md's in full (`../premises.md`, `../teaching.md`, `../../page/blocks.md` and `../plan-flows/plan-format.md`
from this skill's folder):

> Read the plan at `<plan>`, `<premises.md>` and the repository's code as it is now. Read only, and change nothing.
>
> First, try to prove the plan's premises false: whatever its cases take as true, today and after. Treat each `where`
> and each claim as a claim. Trace each case's example yourself from its way in, and check what the plan says of an
> outside thing in that thing's own docs.
>
> Then, for every step a case marks `+`, `~` or `-`, read the code it touches, every caller of that code, the tests that
> run it, and the repository's docs and recorded decisions that describe it. List each finding: a premise that doesn't
> hold or can't be proved, or a situation the plan's cases don't cover, whose answer changes what someone gets, such as
> a response, a page, an exit status, an error, a write or an event. Look for each kind:
>
> - **A false premise**: the code or an outside thing's docs show otherwise, such as the case taking another path, or
>   an endpoint serving another kind of request. Say what the plan believes, what is true, and what that does to it.
> - **An unproved premise**: the plan relies on something neither the code nor the docs can show. Only the author can
>   say.
> - **Another way in**: a caller, route, job, command or public function that reaches a changed step, which no case
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
> Leave out what is already under Already settled, what the plan's Questions sections already ask, and any finding
> whose answer changes nothing anyone gets. Done when every premise has been traced or looked up, every changed step
> has been checked for each kind, and every caller and test of the code it touches has been read.
>
> Then sort each finding by `<teaching.md>`'s Asking the person: **ask** when a fact only the author knows decides it,
> the author could reasonably go either way, or a wrong call would be costly to undo; otherwise **call**, when you
> would bet on what the author would pick and a wrong bet is cheap to put right.
>
> Return the findings, with the one that changes most for the people using the code first, each as:
>
> - a line `### <n>. <headline, at most 12 words>`, then a line `Ask` or `Call`;
> - a line `Changes: <the plan's cases this answer changes or adds>`;
> - for **Call**: one `settled` item in a `json` block, `"who": "Claude"`, `"how": "claude"`, your pick in `text`, the
>   other options in `alternatives`, and in `from` what supports your pick (a test by name, `file:line`, a doc, a
>   rule); then the case it adds or changes, as plan-format.md's case gives it;
> - for **Ask**: the finding as one `choice`, in a `json` block, written as `<blocks.md>` and the choice section of
>   `<plan-format.md>` give it, with no `number`, standing on its own by `<teaching.md>`'s Asking the person. Its `today` charts one concrete case, with real
>   values, as the code runs it now, traced yourself, each step of code carrying its `file:line`. Its 2 to 4 options are behaviours the code could have, each
>   charting the case to what the person gets, a step of code carrying its `where` (`file:line`, or "new code"). A
>   step of `today` draws the case's example as it stands, as a picture, and each option draws what would be different
>   under it, as `<teaching.md>`'s The worked example and Questions that check the reading say. Recommend first the one that
>   the code, a test, a doc or the plan's own reason supports, and say which in `why` (a test by name, `file:line`, a
>   doc, a decision). When nothing supports any of them, recommend the safest one for the people using the code, and say
>   so. What an outside thing does under an option comes from its docs, linked in `why`.
>
> Return "Nothing to ask" when there is no finding.

When the subagent returns:

- If it failed, or returned neither findings in that form nor "Nothing to ask", tell the author "plan-check didn't
  finish", say why (its error, or what it returned instead), and offer to run it again. Stop here.
- If it returned "Nothing to ask", or only Calls, and no question from plan-flows is open, put any Calls in as step
  3's second part says, write `approved` by step 4's second part when the plan has none matching, draw the page by
  plan-flows' step 3 so it shows "Approved", tell the author "Nothing to ask; building now", with how many calls
  plan-check added, which they can flip while the build runs, and build by step 5.
- If it returned "Nothing to ask", or only Calls, and questions from plan-flows are open, go on to step 3 with those.

## 3. Put the findings on the page

1. Check each finding against the code yourself before it goes on the page, by reading the places its `why` and its
   steps' `where` cite: the subagent can be wrong, and the author decides on what the page says. Correct a case, a
   `today` chart or an option the code contradicts, and drop a finding the plan already answers. A false premise is
   settled by the code, never by what the plan says, which is the claim in question. Check its sorting too: a finding
   marked Ask that you would bet on is a Call, and a Call whose wrong bet would be costly to undo is an Ask.
2. Put each Ask's `choice` under Questions from plan-check, in the subagent's order, numbered on from the highest
   question still open. Put each Call's item under Already settled, and add or change the case it names under What
   changes, case by case.
3. Say in What I'm asking how many questions are open and how many calls plan-check added for the author to flip.
4. Draw the page by plan-flows' step 3 (`../plan-flows/SKILL.md`); its one cold read covers the new questions. Ask
   at once, while it runs: the author answers each question by picking an option on the page and flips any call they'd
   make differently, which copies the answers (`3 A`, or `1 A, 3 B, call 4 B` for several) to paste into the chat, by
   typing them, with Comment on a box, or in their own words. In the chat, say how many questions are open, not what
   they are.

Done when every question is on the page, charted, in front of the author.

## 4. Write the answers in

1. Write each answer in as plan-flows' step 4 does; the finding's `Changes` line names the parts it decides.
2. Once no question is open, write `approved` with the moment `node <page.mjs> now` prints and the tail
   ` · after plan-check` (plan-format.md), replacing any older one.
3. Draw the page by plan-flows' step 3 once for each message of answers. Answers are the author's own words, so it
   needs no cold read.

Done when the page shows every answer, outlined, and `approved` matches the plan. Then build by step 5.

## 5. Build

The author's last answer is their go-ahead: answering plan-check's questions is the last thing they do before the
code, so start building at once, in the same turn, without asking whether to. The harness's own permission prompts
apply as usual. Say in a line that the plan is approved and the build has started. Build by plan-flows' step 7
(`../plan-flows/SKILL.md`): it asks the author nothing the plan answers, and shows every plan change with the code
before anything is committed.
