---
name: plan-flows
description: Plan a change before any code, from the code it touches and research into how it is best done, so a better way than the one asked for reaches the author as a question. The plan is a file in docs/plans with a page that teaches it (the ask, the case, screens, questions to check the reading, questions for the author charted on a real case, flows), which the author reads, answers and approves; then plan-check questions it. Use whenever a change adds or alters behaviour, before any code, and whenever an approved plan changes.
---

# Plan as flows

The plan is a JSON file, `docs/plans/<change>.json`, written as [plan-format.md](plan-format.md) describes, with its
fingerprint and approval. The plan file is the page's data: `page.mjs`, in the plugin's `page` folder
(`../../page/page.mjs` from this skill's folder), checks it and draws its page, so you write the plan and never the
page. The author reads the page, answers its questions, and comments and approves in the chat. The plan's flows are
the contract the code is written to.

Read [teaching.md](../teaching.md) in full before step 1: it holds the rules plan-flows shares with the other skills
(the reader, the worked example, charts, questions, showing the page, the cold read, the sweep after each answer). Then
check the session by its Before reading the code.

While planning, write the plan file and nothing else. The author commits the plan when they choose, on the branch
they're on.

## 1. Read the code, and find how the change is best done

The author says what they need, and may not know the way that is known to work best. A plan that builds exactly what
they asked reads well to them even when a better way exists, so research it first, while you read the code.

**Start the research.** Start from the problem behind the author's request: what they want someone to be able to do,
stop or fix. Their words and the code show one way to solve it, and a specialist may know a far better one, so the
first choice to research is the problem itself (a request for a cache asks how to make this page fast). Then list the
design choices the change makes that many projects have made before and written about: how to retry an outside call,
sign people in, page through a list, cache, migrate a database, show a form's errors, make a screen accessible, or
shape a command's output. Keep at most three in all, the ones whose answer changes most what someone gets. When the
change makes none (a rename, a bug with one obvious fix, a change that follows a pattern the code already uses
throughout and lets no one do anything new), research nothing.

Read the stack from the repository's manifests (such as `package.json`, `pyproject.toml`, a `.csproj`, `go.mod`): its
languages, frameworks and their versions. Then start one fresh subagent per choice, all at once, by
teaching.md's A fresh subagent (in Claude Code it runs in the background and can search the web), with this brief:

> Find how this is best done: `<the choice, in a sentence>`. The author asked for: `<their request, in their words>`.
> The problem behind it: `<what they want someone to be able to do, stop or fix>`. The stack, which is what exists today
> and no limit on the answer: `<languages, frameworks, versions>`. Read only, and change nothing in the repository.
> Search the web, and prefer the framework's or library's own docs for these versions, standards and specifications,
> and guides from teams known for the subject; use a blog post or forum answer only where those say nothing.
>
> Return, in under 300 words:
>
> - **Established way**: what a specialist in this would reach for today, even when neither the request nor the stack
>   suggests it, in two or three sentences, and what it gives the people using the code.
> - **The obvious way, and what it costs**: what someone who doesn't know the practice would build, and what goes wrong
>   with it, on one concrete case.
> - **Alternatives**: other sound ways, each with when it fits better.
> - **Pitfalls**: the mistakes the sources warn about.
> - **Sources**: each a link and the claim it supports, with the versions or modes it holds for. Mark a claim
>   "unsourced" when no source says it.
>
> Return "No established way" when the sources disagree or say nothing, and say what they disagree about.

Where the harness can't start a subagent that searches the web, research nothing and say so in the chat.

**Read the code yourself** while the research runs:

- each function the change edits or removes;
- every caller of each one (search for its name);
- the ways in that those callers serve, such as routes, pages, commands, jobs, tool handlers, or a library's public
  functions;
- the tests that run them.

As you read, note each behaviour the change leaves open whose answer changes what someone gets (a response, a page, an
exit status, an error, a write), of the kinds plan-check looks for: another way in that reaches a changed step, an
unhandled input or state (empty, missing, duplicate, too large, another person's), twice at once (concurrent, retried,
stopped half-way), an unsaid outcome (an outside call that can fail), a pinned behaviour, a contradiction with a doc or
decision.

**Weigh what the research returns** against the code you read. The established way fits when the code, its framework
and the repository's docs and recorded decisions allow it; a recorded decision of the repository's outweighs a general
practice. Use no claim marked "unsourced", and nothing from "No established way". Then each finding goes one of three
ways:

- **It agrees with the author's request, or adds a detail they wouldn't decide differently**: the plan builds it, and
  the change's `why` in The changes and why links its source.
- **It differs from the request in what someone gets, or costs something the author would weigh** (a dependency, a
  migration, more work): a question under Questions from plan-flows. The established way comes first unless the code
  or a recorded decision speaks against it, the author's request is one of the options, the plan's case is charted as
  it runs today and under each option, and `why` links the sources. Never swap the request for it silently: the
  author decides, and the page shows them there was a better way. The way that would change most what people get is
  question 1, and What I'm asking says so. Keep the page short: another way gets an option only when it gives people
  something clearly different.
- **It doesn't fit this code**: leave it out. The code or a recorded decision has to rule it out. Its cost doesn't,
  since that is for the author to weigh.

When a research subagent fails, plan without it, and say in the chat which choice wasn't researched.

**Prove the plan's premises**, as [premises.md](../premises.md) says, before you write anything: which path the
example takes today, what each outside thing does there, and each research finding the plan will use. Each goes in the
plan under What this rests on, with how it was proved. A premise found false changes the plan you are about to write,
so read again from there. A premise nothing here can prove is a question under Questions from plan-flows, the author
being the one who can answer it.

Done when every step you will mark as existing, changed or removed names a function or file you have read, you know
which tests pin what each one does today, every research subagent has returned and its findings are weighed, and every
premise is proved from its source or is a question.

## 2. Write the plan

Read [plan-format.md](plan-format.md) first: it gives the sections in order, each item's keys, and the rules every
drawing checks; [blocks.md](../../page/blocks.md) gives the items a plan shares with any page. Name the file after
the change, never the branch (`docs/plans/<change>.json`): a branch is gone once it merges, and the plan stays. Pick
one example change by teaching.md's The worked example and follow it through the screens and traces, drawn as a person
would see it.

Done when all of these hold:

- The case says what the plan builds, in the author's own terms, and where it sits: the larger goal it belongs to,
  from the author's request and the issues, pull requests and other plans it relates to.
- Every name a newcomer to the code wouldn't know has its item under Names.
- There is a screen for each thing a person does that the plan changes.
- Every question can be answered from the plan alone.
- What this rests on names every premise, so an author who knows better can see it at a glance.
- Every open decision, every open behaviour you noted that the code doesn't settle, and every better way the research
  found than the one asked for, is a question under Questions from plan-flows: one real case, a chart of how it
  runs today, the recommendation first, a chart of the case under each option, and why. No other section asks the
  author to decide.
- Every design choice the research covered is built the established way with its source linked, asked as a question,
  or left out because the code or a recorded decision rules it out.
- A reader of What I'm asking alone learns of the best way the research found to solve their problem, when it isn't
  what they asked for.

## 3. Draw the page

Every drawing goes through these steps, whatever asked for it: a new plan, a comment, an answer, a plan change, or
plan-check. Each time a message from the author arrives, run `node <page.mjs> seen docs/plans/<change>.json` before you
edit the plan, so the drawings after it outline what changed since they read it.

1. **Draw.** From the repository's root, run `node <page.mjs> plan docs/plans/<change>.json`. It checks every rule
   plan-format.md marks **checked** (the names at the merge base with the default branch, the question count, the
   question and choice rules, the change titles, the Look closely kinds, the section order) and prints each failure
   with its line. Fix the plan and run it again. Done when it prints its line of JSON: the page's path and the
   fingerprint.
2. **Show the page** at the path it printed, by teaching.md's Show the page.
3. **Write the review page's link** after the first publish that gives one: `"reviewPage": "<link>"`, after `title`
   (and `approved`, if there is one). It is not part of the fingerprint, so nothing is drawn again.
4. **Read it cold**, only when the plan has new words of its own: a new plan, or plan-check's findings. An answer, an
   approval or a comment's small fix is the author's own and needs none. Start it once the page is shown, by
   teaching.md's Read it cold, giving the subagent the plan file's path.
5. **Ask at once** after a new plan's first drawing, while the cold read runs: the author reads the page, answers its
   questions by picking an option on each (the page copies the answers, such as `1 A, 3 B`, to paste into the chat)
   or by typing their numbers and letters, comments in the chat, and approves, either with Approve's line or by saying
   approve. In the chat, say how many questions are open and that they are answered on the page; don't restate them
   or their recommendations there, since the page charts each one and two copies drift apart. plan-check asks as its
   own steps say.
6. **When the cold read returns**, a fix only makes the plan's words clearer, and goes into the plan file; a gap whose
   answer would change what the plan does becomes a question for the author under Questions from plan-flows, never a
   call of yours under Already settled. On a plan approved at its current fingerprint, propose the fixes in the chat,
   and make them by step 6 of this skill only on the author's OK. Write them in together with any message from the
   author that has arrived, then draw and show the page again, at the same link, and say in a line what changed. Its
   fixes start no new cold read.

Done when the page, at the current fingerprint, is in front of the author, with the cold read's fixes on it.

## 4. Answer each comment and answer

A comment arrives in the author's own words, or as the line Comment gives: a box's words and where the box sits. Reply
in the chat with what changes in the plan, or why it stays.

An answer to a question, from either Questions section, arrives as its number and letter (`3 A`, or several at once,
`1 A, 3 B`, as the page copies the options picked), in Comment on its box, or in the author's own words. Write it in:

1. Add `{ "who": "<the author's name>", "text": "<the behaviour, in the plan's terms>" }` under Already settled.
2. Change each part of the plan the answer decides (a flow's steps and checks, marked `+` or `~`, a screen, a trace, a
   row of the changes or of What this rests on), and remove the question, and its section once it's empty.
3. When the changed steps then call for a different number of reading questions, add or rework them to match. They
   test the plan, so a new behaviour can be one.
4. Sweep the whole plan by teaching.md's After an answer or a comment: no part may still say what the answer replaced.

Write in everything one message from the author brings, comments included, sweep, then draw the page once (step 3).
On an approved plan, the edit is a plan change (step 6).

## 5. Approve

The author gives Approve's line, `Approve plan <fingerprint>`, or says approve, which means the fingerprint of the page
this session last showed. In a session that drew no page, the plan is the file in `docs/plans` whose fingerprint that
is, or the one the author names. Running /plan-check approves the plan too: plan-check carries any question still open
and writes `approved` itself, with no need to come back here.

1. When the plan is already approved at its current fingerprint and plan-check has run on it, build it (step 7).
   When plan-check hasn't run, start it (step 5 below).
2. When that fingerprint isn't the plan's fingerprint now, or this session drew no page, draw the page (step 3) and ask
   the author to approve what's there now. Stop here until they do.
3. When questions are still open, name each by its number and question in the chat, and ask the author to answer them
   on the page, by picking an option on each, or by number and letter; their charts are on the page. Write each answer
   in as step 4 does, and draw the page again. What I'm asking then says no questions are open. Done when no question
   is left open.
4. Write `approved` (plan-format.md), replacing any older one, with the fingerprint `page.mjs` prints. Draw nothing:
   plan-check's drawing shows "Approved".
5. Start the plan-check skill on the plan. Once its questions are answered, it builds the plan by step 7 without
   asking again.

## 6. When an approved plan changes

A comment on an approved plan, code that departs from it, or a drawing's refusal that makes you edit it, changes the
plan with no new approval and no new plan-check: the author sees each change with the code (step 7), so nothing they
approved changes unseen.

1. Edit the flow and each part of the plan the change touches, and append a numbered entry to Plan changes, as
   plan-format.md shows it: what changed, why, and who.
2. Put the new fingerprint (`node <page.mjs> fingerprint`) in `approved`, with the tail ` · after plan change <n>`,
   then draw the page (step 3).

Done when the page shows the change outlined, and `approved` matches the plan.

## 7. Build to the plan

The approved plan answered the author's questions before the build began, so the build asks them nothing the plan
answers. Before asking the author anything while building, look for the answer in the plan's flows, Already settled
and Tests, and when it's there, build that.

1. When the code must settle something the plan leaves open, make the call the plan's reasons and the code support,
   and write it into the plan as a plan change (step 6, its first step). Ask the author nothing about it yet. A premise
   the build finds false is such a change: say what the plan believed and what the code shows.
2. Ask the author during the build only for what needs their own hands, such as signing in to something.
3. When the code is done, draw the page once (step 6, its second step) and show the author every plan change with the
   code's changes, before anything is committed.

Done when the code does what the plan's flows say, and every call the build made is a plan change the author has seen.
