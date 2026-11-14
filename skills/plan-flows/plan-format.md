# The plan file

A plan is `docs/plans/<change>.json`, where `<change>` names the change in a few kebab-case words
(`export-dates-in-utc`), never the branch. The plan file is the page's data: `page.mjs` draws the page from it, and
checks every rule marked **checked** below each time it draws (SKILL.md step 3). It is JSON as
[blocks.md](../../page/blocks.md) gives it, and its page is teaching.md's The page; this file adds what a plan asks of it.

## The top of the file

```json
{
  "title": "What the change does, in one sentence",
  "approved": "<who> · <moment> · <fingerprint>",
  "reviewPage": "<link>",
  "pictures": { … },
  "sections": [
    { "heading": "What I'm asking", "content": [ … ] },
    …
  ]
}
```

- `approved` is there once the plan is approved (below).
- `reviewPage` is there once the page has a link. Neither it nor `approved` is part of the fingerprint, so writing
  either changes nothing on the page.
- `pictures` holds each picture more than one step shows (blocks.md, Pictures).

## The fingerprint and the approval

The **fingerprint** is a hash of the plan's words without its `approved` and `reviewPage`, 7 characters long.
`page.mjs` prints it with each drawing, and `node <page.mjs> fingerprint docs/plans/<change>.json` prints it alone. The
page's Approve button gives it, and the approval is checked against it.

The **approval** is `"approved": "<who> · <moment> · <fingerprint>"`, after `title`:

- `<who>` is the author's name, as their items under Already settled give it.
- `<moment>` is when they approved, `YYYY-MM-DDTHH:MM:SS±HH:MM`: run `node <page.mjs> now` when their approval
  arrives. The decisions the plan records are read from it later, in order, so a day alone is not enough.
- When the approved plan changes later, it takes the new fingerprint, followed by a tail naming what changed it:
  ` · after plan change <n>` or ` · after plan-check`.

**Checked**: `approved` has this form. A plan is **approved at its current fingerprint** when the fingerprint in its
`approved` is the fingerprint now.

## Sections, in order

teaching.md's The page, with a plan's own headings and its Plan changes. **Checked**: the sections stand in this
order, What I'm asking first, What changes, case by case always there, and no other. Each is a `heading` as written
here.

1. `What I'm asking`: two or three plain sentences: what the change gives the author, what they approve, and how many
   questions are open. When the research found a better way than the one asked for, say so here in a sentence, with
   the recorded decision that stands in its way, when one does, or that no research ran, when it couldn't.
2. `Questions from plan-flows`: one `choice` for each decision only the author can make (Asking or deciding, below).
   Leave the section out when none is open.
3. `Questions from plan-check`: the same, for each of plan-check's findings that only the author can decide.
4. `What changes, case by case`: one `case` for each situation that ends differently after the change (Cases, below).
   When nobody using the code would notice the change, a paragraph says so in place of the cases.
5. `Check your reading`: two `question`s.
6. `Already settled`: one `settled`, every decision the plan rests on.
7. `Plan changes`: only once an approved plan has changed.
8. `Names`, last and only when needed: one `names`, for a name the page uses that a newcomer wouldn't know and the
   sentence can't say in plain words. Each mention of a name shows its line when pointed at.

How the pieces fit goes on the plan's technical page (plan-flows-tech), not here; on a large change each case step
still names its `part`. Prove each premise before writing (SKILL.md step 1); a premise only the author can confirm is a question.

## Cases

The cases are teaching.md's Cases, each a change: `today` as the code runs it now and `after` as the plan builds it.
`after` is the contract the code is written to. A new step (`"+"`) names no code, since what the build calls it is the
build's to decide. **Checked**: each case has `today` and `after`, and every step with a `where` and no `"+"` names
something the code has at the merge base with the default branch, outside `docs/plans` (a `Class.method` is looked up
by the part after the last dot, a file by its path). There is no `flow` on a plan.

## Asking or deciding

Each decision the plan rests on is asked or is Claude's call, by teaching.md's Asking the person. On a plan, a better
way is what the research found (SKILL.md step 1), and Claude's call is accepted when the author approves the plan.

## choice

A `choice` is one question for the author, as blocks.md's choice gives it, standing on its own by teaching.md's Asking
the person: one real case charted as it runs today, then under each option with the recommendation first, then the
reason.

- A better way's options include the author's request, and its `why` links the sources. When a recorded decision
  stands in its way, its question comes first and quotes the decision and where it is recorded, its options are the
  case with the decision kept and with the better way, and its `why` says what the decision was protecting and
  whether that still holds.
- **Checked**: each has a `number`, and no two share one. The numbers run down the page across both Questions
  sections, so a number names one question. A question keeps its number until it is answered, and new questions
  number on from the highest one still open, or from 1.
- **Checked**: `today` charts the case as the code runs it now, a step of code carrying its `where`, at least one step
  holding a picture, and none marked. When the thing asked about doesn't exist yet, it shows what happens in its
  place. Each option's chart draws what would be different under it, where a person would see it.

## question

teaching.md's two, its `read` naming the case it rests on when the question needs a pointer. **Checked**: a plan asks
exactly two.

## settled

Every item says how it was decided, by teaching.md's Recording each decision. **Checked**: its keys, as said there.

## Plan changes

Once the plan is approved, each change gets an entry appended to the `Plan changes` section, right before `Names`,
numbered from 1:

```json
{ "h3": "<n>. <what changed, in a line> (<moment>, <who: the model, the author>)" },
{ "p": "Why: <the reason: a comment, something found in the code, the author's call>" },
{ "p": "Cases: <the cases it touches>" }
```
