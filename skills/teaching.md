# Teaching

The rules explain, plan-flows, plan-check and pr-review share. Each skill reads this file in full before its first
step; its own SKILL.md holds only what is its own. [teaching-sources.md](teaching-sources.md) gives where each rule
comes from, for whoever changes them; a run needn't open it.

Parts: The reader · The worked example · Charts · Questions that check the reading · Show the page · A fresh subagent ·
Read it cold · After an answer or a comment · Before reading the code

## The reader

Write for a **newcomer**: a person who knows software but has never read this code, this branch or this conversation,
and who may read the page a week from now. Everything they need is on it. People learn from an explanation:

- **The whole before the parts**: the bigger goal this belongs to, its pieces in order, which are done, and where this
  one sits, before any detail.
- **Every name explained wherever it appears**, in plain words saying what the thing does for someone: on a page,
  under its Names; in the chat, a few words where it first appears. A name that doesn't help the reader is replaced by
  what it does. A step number, a branch, a tool or an error code always comes with what it is.
- **One worked example** with real values, followed through the charts, and seen as a person would see it.
- **Where each fact comes from** (`file:line`, a test, a record, a document or a person), so checking it costs a
  click. What you inferred and couldn't prove says so where it is used.
- **Short and focused**: what matters most comes first, so a reader who stops after any section has had the most
  important part.
- **Questions that check the reading**, each answer saying why: reading an explanation feels like understanding even
  when it isn't.

Git stays with the person: a skill makes no commit and makes or switches no branch, since what the history says and
which branch they work on are theirs to decide. What each may write is in its own steps.

## The worked example

Pick the one case that shows the problem most plainly: a person doing one thing with real values, such as an export of
order 1042, a request that gets 403, a run with its counts. Take every value from the code, a test or the data, and
check it before you draw it. Done when the problem shows in the example alone.

**Draw it as a person would see it.** At each step where the example changes, draw it in that step's card (a step's
`shows`, [blocks.md](../page/blocks.md)): rows as a table, a screen as it looks, a file's text with the part the code
uses marked, a structure or a sequence as a diagram, whatever someone who works with the thing would recognise at a
glance. Draw it in HTML or SVG, as a picture, never as code: people read pictures. Keep it to what the step uses. A
value of a few words stays in the step's words.

- **Where it comes from.** Take it from a fixture, a test or a recorded run where one exists, and name that in `from`.
  Where none exists (a feature not built yet, a repository without such a file), draw it as well as the code, the plan
  and the format's docs allow, and leave `from` out: the card then says it was drawn for the page.
- **Its names.** The step's words say what the step does and name what the picture shows, and the page links those
  names; a picture's own words stay as drawn.
- **Two ways.** Where the code goes two ways on the example, show a second example, at most one, from the step where
  they part, drawn the same way, so a reader whose case takes the other way finds theirs.

## Charts

Each step holds the example's own values in plain words, with `where` on a step of code. Mark what works ✓ and what
never runs or is refused ✗ (`result`), and put the one thing to notice beside its step as `note`. A chart holds only
the steps the example needs, one idea a box. A fact no chart carries cites its source where it is said.

## Questions that check the reading

A question asks what a person gets in a case, what happens next, or which piece does what; a name, a path, a count or a
date is never the answer. Each is complete on its own, naming the person, the values and the situation, and never
refers to another question. Its wrong options are what a reader who skimmed would believe, about as long as the right
one.

Each question charts its case in `steps`, up to the step it asks about, and each option in its own `steps`, on from
there to what the person gets; the page draws each option as a card holding its chart. The option charts are about the
same length and carry no `result`, so none gives the answer away.

**Draw what it asks about.** The reader answers from the question alone, without scrolling back to the page's charts,
so the question's own charts draw the example, by The worked example's rules. The case draws it as it stands at the
step asked about (a step's `shows`). When what the person gets under an option is something they would see (a screen,
rows, a file, a message), each option's last step draws it, every option the same kind of picture at the same level of
detail, so none stands out. A question for the author (a `choice`) is drawn the same way: its case as it stands today,
and under each option what would be different. A picture another chart already draws is shown again by its name
(`pictures`, blocks.md), never copied.

A plan or a review asks as many as its changed steps call for: 2 for 0 or 1, and one more each time they double, at
most 8.

| Changed steps | Questions |
|---|---|
| 0 or 1 | 2 |
| 2–3 | 3 |
| 4–7 | 4 |
| 8–15 | 5 |
| 16–31 | 6 |
| 32–63 | 7 |
| 64 or more | 8 |

## Show the page

Draw it with `node <page.mjs> plan|explain <data file>` (`../page/page.mjs` from this folder). It prints each failure
with its line: fix the file and run it again. Show the page at the path it prints the way this harness shows a page
best: in Claude Code, publish that file with the Artifact tool, the same path each time, so the page keeps its link; in
Codex, with its visualize skill; elsewhere, draw with `--whole` and give the file's path. Picking an option on the page
gives the chat its answer: sent where the page can send it, otherwise copied to paste.

## A fresh subagent

Start one the way this harness starts one: in Claude Code, the Agent tool with a general-purpose agent, which runs in
the background. Give it only its brief, with nothing from this chat, so it reads as someone who didn't write the work.

## Read it cold

Only where a skill's own steps call for it. The writer knows the context and can't see what is missing; a reader with
none can. Once the page is shown, start a fresh subagent, on a faster model where the harness lets you choose one, and
give it the data file's path with this brief:

> You have never seen this project or this conversation. Read the explanation in `<path>`. List, under two headings:
> "Can't follow": every name, number, step or claim you can't understand from it alone; "Before deciding": every
> question you would have to ask before you could decide or act on it, which the explanation neither answers nor lists
> under Still open. Quote the words each is about, and mark an item "changes the decision" when its answer could change
> what you would decide or do. Reply "Clear" when both are empty.

Fix only what is wrong: a false or contradictory claim, a name missing from Names or meaning two things, and an item
marked "changes the decision", answered on the page when the code or the records answer it, and otherwise put where the
skill's page keeps what is still open. Close each gap in the fewest words that close it: a long answer raises new
questions. Make all the fixes at once, draw and show the page again at the same link, and say in a line what changed.
One round is enough: its fixes start no new cold read.

## After an answer or a comment

Write in everything the person's message brings, then sweep the whole page for what it replaced: search every part
(the title, the opening section, screens and charts, questions and their charts, traces, flows, tests, what comes next)
for words that still say the old behaviour, and rewrite each before you draw. Done when no part of the page says what
the answer replaced.

## Before reading the code

A skill that reads the code first checks that this session can run commands and has `git` and `node`, and for a plan,
a git repository in the working directory. When it can't, say that the skill needs Claude Code or Codex opened on the
code, and stop.
