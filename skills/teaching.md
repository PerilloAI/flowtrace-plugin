# Teaching

The rules explain, plan-flows, plan-flows-tech and plan-check share. Each skill reads this file in full before its first
step; its own SKILL.md holds only what is its own. [teaching-sources.md](teaching-sources.md) gives where each rule
comes from, for whoever changes them; a run needn't open it.

Parts: The reader · The page · Cases · The worked example · Charts · Questions that check the reading · Asking the
person · Recording each decision · Show the page · A fresh subagent · Read it cold · After an answer or a comment ·
Before reading the code

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

A page teaches the thing case by case, each case drawn with pictures of the example, because people take in a picture
of what happens faster than a paragraph about it. A page is never a wall of text: what isn't a case, a question or a
decision is left off, and so is the build's detail: its classes, files and functions, its traces, its tests and its
order of work. A change large enough to need it shows how its pieces fit, at a high level (How the pieces fit).

Git stays with the person: a skill makes no commit and makes or switches no branch, since what the history says and
which branch they work on are theirs to decide. What each may write is in its own steps.

## The page

Every page has these sections, in this order, each left out when it would be empty. A skill may name them more
exactly (plan-format.md does for a plan), and adds nothing else:

1. **What I'm asking** (or **In short**, when there is nothing to decide): two or three plain sentences: what this is,
   what it gives the reader, and what they are asked, with your recommendation first.
2. **The questions**: each decision only the reader can make, as a `choice` (Asking the person).
3. **How the pieces fit**, only when the change calls for it: one `chart` of its parts (How the pieces fit).
4. **The cases**: one `case` for each situation (Cases).
5. **Check your reading**: two `question`s.
6. **Already settled**: one `settled`, every decision the page rests on (Recording each decision).
7. **Names**, last: one `names`, for each name a newcomer wouldn't know and the sentence can't say in plain words.

## Cases

A **case** is one situation: who does what, with which values, in which state. List them all, so a reader who thinks
of a situation finds it, by walking each way in to what the page is about (a route, a page, a command, a job, a tool
handler, a library's public function, a skill's slash command) and asking of each step what it is given: the usual
input, and then empty, missing, duplicate, too large, another person's, in another state, twice at once, stopped
half-way, and an outside call that fails. Then:

- **Keep only what matters to the reader.** For a change, that is each situation that ends differently after it than
  today: one that ends as it does today is left out. For how something works, it is each situation that takes a
  different path.
- **Group what ends alike.** Situations that end the same way are one case, its title naming them all ("The file is
  empty or unreadable").
- **Be complete.** A reader who thinks of a situation and finds no case for it should be right to assume it ends as
  it does today, or as the nearest case does. A situation whose ending is not yet decided is a question or Claude's
  call (Asking the person), and its case is drawn as decided.

```json
{ "case": {
  "title": "The warehouse times out once",
  "gets": "Ana gets her file after one retry, instead of an error",
  "today": [
    { "text": "Ana exports order 1042", "kind": "start", "where": "exportOrder", "shows": { "use": "order 1042" } },
    { "text": "\"Export failed\"", "result": "bad" }
  ],
  "after": [
    { "text": "Ana exports order 1042", "kind": "start", "where": "exportOrder" },
    { "text": "Did the warehouse time out?", "kind": "question", "mark": "+", "answers": [
      { "label": "yes", "steps": [ { "text": "Wait 30 seconds and ask once more", "mark": "+" } ] }
    ] },
    { "text": "Ana's file downloads", "result": "ok", "shows": { "html": ["…"] } }
  ]
} }
```

- `title` names the situation, in the reader's words; `gets` says in a line what the person gets.
- **For a change**, `today` charts it as the code runs it now, flaws included (what you traced, not what the code
  seems meant to do), and `after` as it will run, side by side. A situation that can't arise today (a button that
  doesn't exist yet) shows what happens in its place. `after` marks its new (`"+"`), changed (`"~"`) and removed
  (`"-"`) steps; `today` marks none.
- **For how something works**, the case is one chart, `steps`, with no marks.
- A case may branch where its situations share a start and part later, each ending a lane (a step of
  `"kind": "question"` with `answers`).
- **The pictures carry it.** Each case draws the example at the steps where it changes (The worked example). A reader
  new to this kind of code learns how it works by watching the example move through the steps, so a step that teaches
  something gets a picture.
- Write every step in plain English, as you would explain it to someone who uses the code and has never read it. The
  code's names go in `where` and only there: a function, or a file by its path from the repository's root, and never a
  line. On a change that shows how its
  pieces fit, each step names the part it runs in, in `part`.
- **Checked**: each case draws a picture on a step; no step of `today` or `steps` has a `mark`; at least one step of
  `after` has one.

## How the pieces fit

A reader can't follow the cases of a large change without seeing, at a high level, how it will be built. Draw it when
the change adds a part (a service, a job, a store, a queue, a model, an outside service, a library the code doesn't
use yet), or connects parts that don't talk to each other today, and whenever the reader asks how something will be
built. A change that stays inside one part as it is (a check, a message, a field) needs none.

- **One chart of the parts**, before the cases, under `How the pieces fit` (on a plan, on its technical page): each part in the order the example passes
  through it, a box each, saying what the part does for the reader and the technology it runs on ("a nightly job on
  the scheduler the API server already has", "a table in the existing Postgres"), with the example as each part hands
  it to the next drawn as a picture. Mark a new part `"+"` and a changed one `"~"`; the parts that stay as they are
  carry their `where`.
- **Each case step names its part** in `part`, the same words as its box in the chart, so the reader sees where in
  the whole each step runs; a step outside the system (a person's own action) takes none.
- **A part's technology is a decision** like any other: the established way the research found is your call under
  Already settled, its source linked, or a question when it gives people something different or costs something they
  would weigh (a new dependency, a service to run, money).
- **High level only**: the parts and what passes between them. No classes, files, schemas or order of work: the build
  decides those.

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
detail, so none stands out. A question for the person (a `choice`) is drawn the same way: its case as it stands today,
and under each option what would be different. A picture another chart already draws is shown again by its name
(`pictures`, blocks.md), never copied.

A page asks two, each testing what a reader who skimmed would get wrong, about what a person gets in a case the page
draws: more wear the reader out, and they stop reading them. **Checked**.

## Asking the person

Every decision the work rests on is either a question for the person or Claude's call, which they can flip. Ask only
what Claude can't decide well on their behalf, so their time goes on the few calls that are theirs: a person handed
questions whose answers are obvious stops reading them, and then misses the one that matters. Ask it, as a `choice`,
when one of these holds:

- **A better way.** What you found (research, the code, the docs) gives people something clearly different from what
  was asked, or a recorded decision stands in its way.
- **A fact only they know.** A premise nothing in the code or its docs can prove: how production is set up, what
  someone intends, data that can't be seen.
- **They could go either way.** Neither the request, the code, the repository's rules and recorded decisions nor their
  earlier answers point to one option, and the options give people something different.
- **A wrong call costs a lot.** It can't be undone or is costly to undo: data deleted or rewritten, something sent, a
  contract other people rely on, money, access, security. This is asked however sure you are.

Otherwise it is Claude's call: when you would bet on their answer and a wrong bet is cheap to put right. It goes under
Already settled, the option you picked in `text`, the others in `alternatives`, and in `from` what it follows when
something does (a rule, the code's own convention, an earlier answer); they flip it on the page when they'd decide
differently. A decision with one sensible answer, which nobody would want otherwise, is not a decision: do it and say
nothing.

**A question stands on its own.** The person answers from the question and its charts alone, without reading the rest
of the page. `question` names who does what, with which values, in which state, and what is being decided. It uses no
word the page coins, and no name from another question or chart, without saying what it means right there. The
recommendation is the first option, and `why` says in two or three sentences why it, and what it costs, with its
sources as links.

## Recording each decision

Already settled lists every decision the page rests on, each saying how it was decided, so the decisions can be read
later in the order they were made ([blocks.md](../page/blocks.md), settled):

- `"said"`: what the person said, in their request or a comment, with `at` the moment you write it in.
- `"chose"`: a question they answered or a call they flipped, with `at` the moment their answer arrived.
- `"rule"`: what a file holds, with `from` naming it and no `at`, since the file's history holds when it was made.
- `"claude"`: Claude's call, with its `alternatives` and no `at`: it stands once the person answers the page, or on a
  plan, once they approve it.

Run `node <page.mjs> now` for each `at`. When an answer or a flip arrives, the item it settles becomes `"chose"`, with
the option taken in `text`.

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
(the title, the opening section, cases and charts, questions and their charts, flows, what's settled, what comes next)
for words that still say the old behaviour, and rewrite each before you draw. Done when no part of the page says what
the answer replaced.

## Before reading the code

A skill that reads the code first checks that this session can run commands and has `git` and `node`, and for a plan,
a git repository in the working directory. When it can't, say that the skill needs Claude Code or Codex opened on the
code, and stop.
