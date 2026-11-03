# The plan file

A plan is `docs/plans/<change>.json`, where `<change>` names the change in a few kebab-case words
(`export-dates-in-utc`), never the branch. The plan file is the page's data: `page.mjs` draws the page from it, and
checks every rule marked **checked** below each time it draws (SKILL.md step 3). It is JSON as
[blocks.md](../../page/blocks.md) gives it, with the items a plan shares with any page (`chart`, `question`, `choice`,
`settled`, `names`); this file adds what a plan asks of them, and the items only a plan has.

## The top of the file

```json
{
  "title": "The plan in one sentence",
  "approved": "<who> · <date> · <fingerprint>",
  "reviewPage": "<link>",
  "sections": [
    { "heading": "What I'm asking", "content": [ … ] },
    …
  ]
}
```

- `approved` is there once the plan is approved (below).
- `reviewPage` is there once the page has a link. Neither it nor `approved` is part of the fingerprint, so writing
  either changes nothing on the page.
- Then the sections, drawn in the order written.

## The fingerprint and the approval

The **fingerprint** is a hash of the plan's words without its `approved` and `reviewPage`, 7 characters long.
`page.mjs` prints it with each drawing, and `node <page.mjs> fingerprint docs/plans/<change>.json` prints it alone. The
page's Approve button gives it, and the approval is checked against it.

The **approval** is `"approved": "<who> · <YYYY-MM-DD> · <fingerprint>"`, after `title`:

- `<who>` is the author's name, as their items under Already settled give it, and `<YYYY-MM-DD>` the day they
  approved.
- When the approved plan changes later, it takes the new fingerprint, followed by a tail naming what changed it:
  ` · after plan change <n>` or ` · after plan-check`.

A plan is **approved at its current fingerprint** when the fingerprint in its `approved` is the fingerprint now.

## Sections, in order

**Checked**: the sections stand in this order, and What I'm asking comes first. Each is a `heading` as written here.

1. `What I'm asking`: one or two plain sentences saying what the author approves and how many questions are open, and
   the better way the research found, when there is one.
2. `The case`: one `case`.
3. `What you'd see`: a paragraph introducing the example change that the screens and traces follow, then the
   `screens`. When nobody using the code would notice the plan, a paragraph says so in place of the screens.
4. `Check your reading`, right after What you'd see: the `question`s.
5. `Questions from plan-flows`: a paragraph saying how many there are and how to answer, then one `choice` for each
   decision still open, each behaviour plan-flows found the plan leaves open, and each better way than the one asked
   for that its research found. Leave the section out when none is open. Every decision waiting on the author is a
   question here or under Questions from plan-check; no other section asks the author to decide.
6. `Questions from plan-check`: the same, for each finding plan-check's subagents returned that is still open.
7. `What this rests on`: one `table` of the plan's premises (below).
8. `The changes and why`: one `changes`.
9. `Already settled`: one `settled`.
10. `How it works, traced with <the example>`: the `trace`s.
11. `How it's built`: the `flow`s.
12. `Order of work`, `Tests`, `What comes next`: paragraphs and lists. What comes next lists later work, each item
    saying who decides it and when.
13. `Plan changes`: only once an approved plan has changed.
14. `Names`, last: one `names`.

## Charts

`screens`, `trace` and `choice` draw charts, their steps as blocks.md's chart gives them.

A step that a change makes names it in `change`, the change's title. On the page it is a link to that row of The
changes and why. **Checked**: each `change` names a title in `changes`, word for word.

## case

`{ "case": [ { "p": "…" }, { "list": ["…"] } ] }`: what the plan builds and why, in the author's own terms, as
paragraphs or a short list, and where it sits: the larger goal it belongs to, and the issues, pull requests and other
plans around it, each with its state. Today's behaviour goes in the screens' Today column. The example change is
introduced where the screens begin.

## screens

`{ "screens": { "title": "…", "columns": [ { "title": "Today", "steps": [ … ] }, { "title": "After", "steps": [ … ] } ] } }`.
The title names the thing a person does, such as `Exporting a report, with the export command` or `Paying an invoice,
on the checkout page`. Write one for each thing a person does that the plan changes. Each step a change makes names
that change, and the page links it to the first step naming that change in each flow. **Checked**: each change a
screen's step names is on a flow's step.

## question

Questions test the plan (what it changes, who does what, how it works), never facts about the example. Each question
is complete on its own: it names the people, values and request it asks about, and never refers to another question by
number. Its form and its checked rules are blocks.md's question.

**Checked**: the number of questions follows the change. One changed step calls for 2 questions, and each doubling of
the changed steps adds one more, up to 8. A changed step is a flow step whose `keyword` is `Step`, `Check` or `Only if`
and whose mark is `+`, `~` or `-` (its own `mark`, or its flow's).

| Changed steps | Questions |
|---|---|
| 0 or 1 | 2 |
| 2–3 | 3 |
| 4–7 | 4 |
| 8–15 | 5 |
| 16–31 | 6 |
| 32–63 | 7 |
| 64 or more | 8 |

## choice

A `choice` is one question for the author: a decision still open, a behaviour the plan leaves open whose answer
changes what someone gets (a response, a page, an exit status, an error, a write), or a better way than the one the
author asked for, which the research found. A better way's options include the author's request, and its `why` links
the sources. Its form is blocks.md's choice: the
recommendation first, each option charted on one real case, then the reason.

- `question` carries its case: who does what, with which values, in which state.
- **Checked**: each has a `number`, and no two share one. The numbers run down the page across both Questions
  sections, so a number names one question. A question keeps its number until it is answered, and new questions
  number on from the highest one still open, or from 1.
- The case uses real values, from the code or the plan's example.
- Write it in plain English, as the flows are: a reader who has never seen the code can answer it from the question
  and its charts alone.

## What this rests on

The premises the plan is built on ([premises.md](../premises.md)), the one that changes most if false first, so the
author can spot a wrong one at a glance and plan-check knows what to try to break.

```json
{ "table": { "head": ["The plan rests on", "How it was proved", "Where"], "rows": [
  ["Reminders go out through the queue's worker", "Traced from the schedule to the call; the other sender has one caller, a one-off script", "jobs/remind.ts:12, mail/send.ts:30"]
] } }
```

**Checked**: the section is on every plan, and its table has these three headings, with every cell filled in. Write
the premise in plain words and its code in Where. An answer from the author is a proof: its Where is their name. A
premise still unproved is a question, not a row.

## changes

`{ "changes": [ { "title": "…", "gets": "what users get, on the example", "why": "…" } ] }`. A change built the way
the research found best links its source in `why`. **Checked**: each title
is at most six words and no other row's; a chart's steps name the change by it.

## settled

As blocks.md's settled gives it, `who` being the author's name for their own call or a rule from a file.

## trace

`{ "trace": { "title": "…", "about": "…", "steps": [ … ] } }`, `about` optional, or `columns` in place of `steps`. The
traces come in this order:

1. The problem: the example going wrong today.
2. How the plan decides between cases: one chart, with each answer naming its case.
3. One chart per case (`Case A · …`).
4. Last, `Before and after, side by side`, in two columns.

## flow

The flows are the contract the code is written to. Write one for each way in that the change adds or touches.

On the page each flow is a closed row that opens in place. Its line shows the flow's name, its new or removed tag or its
counts of marked steps, its number of steps, and the screens that link to it (`Seen in`, or `No screen links here`). A
question's `read`, or any other link, that names a flow or a step's `where` opens a copy of the flow in a modal over the
page, with the step lit.

```json
{ "flow": { "name": "The way in, in plain words", "steps": [
  { "keyword": "Starts", "text": "who or what starts it: a request and who sends it, a person's action, a command, a schedule, a call into a library", "where": "file or function" },
  { "keyword": "Step", "text": "what it does", "where": "function", "mark": "~", "inner": [
    { "keyword": "Check", "text": "a question whose yes is the way out?", "mark": "+", "answers": [
      { "label": "yes", "steps": [ { "keyword": "Raises", "text": "the error as the caller sees it", "mark": "+", "lookClosely": [ { "kind": "Breaking", "text": "what a reviewer should check" } ] } ] }
    ] }
  ] },
  { "keyword": "Step", "text": "a step the change removes", "where": "function", "mark": "-" },
  { "keyword": "Step", "text": "a step the change adds", "where": "function", "mark": "+", "change": "The change's title" },
  { "keyword": "Returns", "text": "what the caller gets" }
] } }
```

- **Keywords**: `Starts`, `Step`, `Check`, `Only if`, `Repeats`, `Tries`, and to end `Returns`, `Raises`, `Exits` or
  `Finishes`. A `Check`, `Only if`, `Repeats` or `Tries` takes `answers`, each `{ "label": "yes", "steps": [ … ] }`
  (`no`, `fails (someone saved the same name first)`). A step with none, as inside an answer, is plain words.
- **Marks**: `"mark": "+"` new, `"~"` changed (its code changes), `"-"` removed, and no mark for what exists. Keep a step
  for each existing step the change sits among, so the reader sees where it lands. A flow the plan adds as a whole is
  `"mark": "+"` on the flow, and its steps carry none; a flow it removes is `"mark": "-"`.
- **Change names.** A plan's step names in `change` the change whose row describes what the step does, by the writer's
  judgement, and a review leaves `change` out.
- **Lean.** List the flow's top-level steps, one per function the change adds, changes or removes on it, in the order
  they run. Under them (in `inner`, or an answer's `steps`), put every check whose branches end differently for whoever
  started the flow (another response or page, an error, an exit status, a write, an event) as `Check`, `Only if`,
  `Repeats` or `Tries`, each answer with its end. Leave out checks whose branches end alike for the caller, and leave
  out nested helpers.
- **Names.** `where` holds the code's name for a step: a function, a `Class.method`, or a file by its path from the
  repository's root. **Checked**: every step marked `~`, `-` or not at all names something the code has at the merge
  base with the default branch, outside `docs/plans`. A `Class.method` is looked up by the part after the last dot,
  and a file by its path. New steps name what the code will add.
- **Look closely**, in `lookClosely` on the step it flags, `{ "kind": "…", "text": "what to check" }`. **Checked**:
  the kind is one of Breaking, No undo, Access check, Default changed, External call, Migration, Error hidden, Side
  effect.
- Config, SQL, infrastructure and pipeline files get a flow too when they decide something, for example when a service
  starts only once its migration exits 0, or when a role may read a secret.

### Plain English

Write every step the way the author would explain the change to someone who uses the code (opens the page, runs the
command, calls the library) and has never read it. Say what the person or program that started the flow sees, what is
checked about them or their data, and what is saved, sent or queued. The code's names go in `where` and only there.

| Written from the code | In plain English |
|---|---|
| `Check: order.ownerId !== user.id && !user.isAdmin?` | `Check: Is the reader neither the order's owner nor an admin?` |
| `Step: queue.add("reminder", { invoiceId })` | `Step: Queue a reminder for each unpaid invoice` |
| `fails (23505): goes on` | `fails (someone saved the same name first): goes on` |
| `Exits: 1 after logging import.failed` | `Exits: the import stops and saves nothing (exit 1)` |
| `Raises: RangeError(tz)` | `Raises: "unknown time zone" (RangeError)` |

When the caller itself receives a code (an HTTP status, an error code in the response, an exit status, an exception
type), put it in parentheses after the plain words: `"not found" (404)`.

## Plan changes

Once the plan is approved, each change gets an entry appended to the `Plan changes` section, right before `Names`,
numbered from 1:

```json
{ "h3": "<n>. <what changed, in a line> (<date>, <who: the model, the author>)" },
{ "p": "Why: <the reason: a comment, something found in the code, the author's call>" },
{ "p": "Flows: <the flows it touches>" }
```

## names

One item per name a reader who has never seen the code wouldn't know, in alphabetical order: a tool, a product, a pull
request, an issue, a recorded decision, a term the plan coins. A name the code has goes in `where` and needs no item.
Its form is blocks.md's names.
