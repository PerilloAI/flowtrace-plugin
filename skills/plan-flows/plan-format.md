# The plan file

A plan is `docs/plans/<change>.json`, where `<change>` names the change in a few kebab-case words
(`export-dates-in-utc`), never the branch. The plan file is the page's data: `page.mjs` draws the page from it, and
checks every rule marked **checked** below each time it draws (SKILL.md step 3). It is JSON as
[blocks.md](../../page/blocks.md) gives it, and it teaches by teaching.md's rules.

## A plan is a storyboard

A plan tells everything that will happen, in the order it happens, from the first thing built to the last. Its reader
goes from top to bottom once and has the whole of it: nothing is folded away, and nothing waits in another section.

- **The whole thing first**: what the change gives, drawn on the example, in a few lines.
- **Then every step, in order.** Each step has the same shape, so the eye learns it once: a picture of the example at
  that step, the gist in a sentence or two, how it works, the trade-off made there, and what the author will see when
  the step works.
- **The gist and the technical part sit together.** A reader who wants only the gist reads the pictures, the gists and
  the trade-offs, and has a true account. The page has a switch that hides the technical parts.
- **A trade-off is told at the step where it is made**, and a question for the author is asked there, so the reader
  meets each choice knowing everything that came before it.

One example runs through every step, the same person and values throughout (teaching.md, The worked example).

## The top of the file

```json
{
  "title": "What the change does, in one sentence",
  "approved": "<who> · <moment> · <fingerprint>",
  "reviewPage": "<link>",
  "build": [ … ],
  "told": { … },
  "pictures": { … },
  "sections": [
    { "heading": "The whole thing", "content": [ … ] },
    …
  ]
}
```

- `approved` is there once the plan is approved (below).
- `reviewPage` is there once the page has a link.
- `build` is there once the build has started: what each step showed (The build, below).
- `told` is there once the build is done and the author has explained it back (Telling it back, below).
- None of the four is part of the fingerprint, so writing one changes nothing the author approved.
- `pictures` holds each picture more than one step shows (blocks.md, Pictures).

## The fingerprint and the approval

The **fingerprint** is a hash of the plan's words without its `approved`, `reviewPage`, `build` and `told`, 7
characters long. `page.mjs` prints it with each drawing, and `node <page.mjs> fingerprint docs/plans/<change>.json`
prints it alone. The page's Approve button gives it, and the approval is checked against it.

The **approval** is `"approved": "<who> · <moment> · <fingerprint>"`, after `title`:

- `<who>` is the author's name, as their items under Already settled give it.
- `<moment>` is when they approved, `YYYY-MM-DDTHH:MM:SS±HH:MM`: run `node <page.mjs> now` when their approval
  arrives. The decisions the plan records are read from it later, in order, so a day alone is not enough.
- When the approved plan changes later, it takes the new fingerprint, followed by a tail naming what changed it:
  ` · after plan change <n>` or ` · after plan-check`.

**Checked**: `approved` has this form. A plan is **approved at its current fingerprint** when the fingerprint in its
`approved` is the fingerprint now.

## Sections, in order

**Checked**: the sections stand in this order, The whole thing first, What will happen, in order always there, and no
other. Each is a `heading` as written here.

1. `The whole thing`: one `whole` (below), then, only when the change adds a part or connects parts that don't talk
   today, one `chart` of the parts (teaching.md, How the pieces fit).
2. `Plan changes`: only once an approved plan has changed, the newest first (below).
3. `What will happen, in order`: one `step` for each step, in the order they are built (below), and nothing else.
4. `Already settled`: one `settled`, every decision the plan rests on.
5. `Names`, last and only when needed: one `names`.

The page adds what it can work out: under The whole thing, every step's name on one line, in order; after the last
step, every trade-off in the order it is made, as a table; and how long the gist takes to read, and the whole.

Prove each premise before writing (SKILL.md step 1); a premise only the author can confirm is a question.

## whole

```json
{ "whole": {
  "problem": "Sam drops invoice-1042.pdf in and none of its words are read, so a search for Total finds nothing.",
  "gets": "Drop a PDF in. Get its words back, page by page, in the order a person would read them.",
  "shows": { "html": ["…"] },
  "for": "Anyone who needs to search or copy what a PDF says.",
  "in": "PDFs made by software: invoices, reports, letters.",
  "out": "Scanned pages, locked files, tables kept as tables.",
  "assumes": "You have used a PDF. Nothing about how one is stored.",
  "unknown": "Whether the fonts in real invoices carry their letter tables. Step 2 tests it.",
  "asking": "Approve the five steps and answer one question, at step 4. The research found no better way than the one you asked for.",
  "map": [ { "text": "Read the words", "here": true }, { "text": "Keep tables as tables" } ]
} }
```

- `problem`: what is wrong today, on the example: what a person does and what they get, in one or two sentences. The
  page shows it first, so nobody reads how something is built before knowing why. For something wholly new, it is
  what a person has to do without it.
- `gets`: what the change gives a person, in one or two sentences they could repeat. `shows`: the example before and
  after the change, or going in and coming out, as one picture.
- `for`, `in`, `out`: who it is for, what it covers, and what it leaves out for now. `out` is where a reader finds
  that the thing they expected is not coming, so it names each such thing.
- `assumes`: what the page takes its reader to know already, read from what they said of themselves and how they
  wrote the request. Everything past that line is explained at the step that first needs it.
- `unknown`, when there is one: what nobody knows yet and the plan rests on, and the step that tests it. Work in a
  field the author is new to always has one.
- `asking`: what they approve, and which steps hold a question for them. When the research found a better way than
  the one asked for, it says so here, with the recorded decision that stands in its way when one does, or that no
  research ran when it couldn't.
- `map`, when the change is one of several plans toward something larger: each plan in order, a line each, this one
  marked `"here": true`.

**Checked**: a plan has exactly one, first in The whole thing, with `problem`, `gets`, `shows`, `for`, `in`, `out`, `assumes`
and `asking`; a `map` marks exactly one plan `here`.

## step

```json
{ "step": {
  "title": "Read every letter on a page, with where it sits",
  "label": "Letters",
  "shows": { "html": ["…"] },
  "caption": "Each letter of invoice 1042, placed where the file says.",
  "gist": "The file doesn't store words. It stores shapes and where each one goes, so this step collects them.",
  "how": {
    "frames": [
      { "part": "Page 1, as stored", "shows": { "html": ["…"] }, "text": "The page holds drawing steps, packed the way a zip file is." },
      { "part": "Unpacked", "shows": { "html": ["…"] }, "text": "Unpacked, they are short commands, each written after its values.",
        "notes": ["`412 704 Td` moves to 412 across, 704 up from the bottom.", "`Tj` draws shapes, given as numbers, not letters."] },
      { "part": "Font F1's letter table", "shows": { "html": ["…"] }, "text": "The font's letter table turns each number into a letter: 17 is T." }
    ],
    "decides": [ { "number": "A shape's width times the size", "decides": "Where the next shape starts" } ],
    "breaks": "A font with no letter table, numbered its own way: its shapes can't be named.",
    "more": [ { "table": { "head": ["Command", "What it does"], "rows": [["`Tf`", "Picks the font and its size"]] } } ]
  },
  "trade": { "chose": "Reading the drawing steps", "over": "Searching the file for text", "because": "The text is zipped and stored as shape numbers", "costs": "A font with no letter table gives no letters" },
  "cases": [ { "title": "…", "gets": "…", "today": [ … ], "after": [ … ] } ],
  "choices": [ { "number": 1, … } ],
  "see": "1,210 letters, each in its place, matching the page by eye",
  "unknown": true
} }
```

- `title`: what the step does, as an action, in a few words. `label`, one to three words, is its name on the line of
  all steps; leave it out when `title` is that short.
- `shows`: the example as it is at this step, as a picture a person would recognise (teaching.md, The worked
  example), with an optional `caption` under it. Every step has one: the pictures, read in order, tell the story.
- `gist`: what happens at this step and why it is there, in one or two plain sentences, with no code name and no word
  the reader would have to look up. A reader of the gists alone has a true account of the whole build.
- `how`: the technical part, drawn, in enough detail that an engineer could build the step and explain it. It holds
  no paragraph: a reader's eye slides off a block of text, so everything a paragraph would say goes on a picture.
  - `frames`: the example going through the step, one frame for each moment, in the order it happens. A frame is a
    picture (`shows`) of the example as it is at that moment, as the program holds it or as a person sees it (the
    bytes, the request sent, the row, the reply), its caption (`text`: what happened to get here), the `part` that
    acts, and up to three `notes`: the detail that belongs to this frame and nowhere else, such as what a command
    means, an exact field, or why. Give the format's or library's own word for a thing in code type where the reader
    would meet it (`startxref`). A frame whose picture is only its caption again is a paragraph in a box: draw the
    thing itself.
  - `chart`, in place of `frames`, when the step branches or its parts answer each other: a flowchart (blocks.md,
    chart), the example pictured on at least one of its steps.
  - `decides`, when a number decides what happens: each number, and what it decides.
  - `breaks`: where the step goes wrong first, in a sentence or two.
  - `more`, when detail is left that belongs to no one frame: a `table`, `list`, `numbered` or `chart`. A chart here
    follows the example, its steps of existing code carrying their `where`.

  Use the plain word for each thing, and give the field's own name once, here, and under Names (`usual`). No classes,
  files or schemas of code not yet written: the build decides those.
- `trade`: the trade-off made at this step, when the step could sensibly have been built another way: what was
  chosen (`chose`), what it was chosen over (`over`), why (`because`), and what the choice costs (`costs`). `costs` is
  never empty and never "nothing": a choice with no cost is not a trade-off, and is left out. The decision is also
  under Already settled, where the author flips it.
- `choices`: each question for the author that belongs to this step (choice, below). A step whose trade-off is the
  author's to make has the question and no `trade` until they answer.
- `cases`: each situation this step changes for a person using the code, as teaching.md's Cases: `today` as the code
  runs it now beside `after` as the plan builds it. A case sits in the step that makes its `after` come true, and in
  no other. A plan for something wholly new, which nobody uses today, has none.
- `see`: what the author can look at when the step works, in the example's own values: a line printed, a picture, a
  count out of a hundred.
- `unknown`: `true` on the step that tests what `whole` says nobody knows yet.

Order the steps as they are built: the first is the least that runs from one end to the other on the example, and
each later one adds one thing. A reader who stops the build after any step still has something that works.

**Checked**: at least one step; each has `title`, `shows`, `gist`, `how` and `see`; a `gist` is fifty words or
fewer; a `how` has `frames` or a `chart`, never both, and `breaks`; it has two to eight frames, each with its picture,
a caption of twenty-five words or fewer and at most three notes of twenty-five words or fewer; a `how` drawn as a
chart pictures the example on a step, each step twenty-five words or fewer; `breaks` is forty words or fewer, each
text of `decides` twenty or fewer, and each list item and table cell under `more` thirty or fewer; a `trade` has all
four of its texts; a case's `today`, `after` and code names as teaching.md and the rule
below give them; when `whole` has an `unknown`, exactly one step carries `"unknown": true`, and otherwise none does.
There is no `flow`, `question`, `say` or `ladder` on a plan.

**Checked**: every step of a case with a `where` and no `"+"` names something the code has at the merge base with the
default branch, outside `docs/plans` (a `Class.method` is looked up by the part after the last dot, a file by its
path). A new step (`"+"`) names no code, since what the build calls it is the build's to decide.

## Asking or deciding

Each decision the plan rests on is asked or is Claude's call, by teaching.md's Asking the person. On a plan, a better
way is what the research found (SKILL.md step 1), and Claude's call is accepted when the author approves the plan.

## choice

A `choice` is one question for the author, as blocks.md's choice gives it, standing on its own by teaching.md's Asking
the person, under the `choices` of the step it belongs to: one real case charted as it runs today, then under each
option with the recommendation first, then the reason.

- **`decides`** says what decides it: the facts about the author's own situation that make each option the right one
  ("Skip it when few of your files are scans; read them when most are"). The page shows it before the options. An
  author who sees their situation in it can decide; without it they can only agree.
- A better way's options include the author's request, and its `why` links the sources. When a recorded decision
  stands in its way, the question quotes the decision and where it is recorded, its options are the case with the
  decision kept and with the better way, and its `why` says what the decision was protecting and whether that still
  holds.
- **Checked**: each has a `number`, and no two share one. The numbers run down the page, so a number names one
  question. A question keeps its number until it is answered, and new questions number on from the highest one still
  open, or from 1.
- **Checked**: each has `decides`. `today` charts the case as the code runs it now, a step of code carrying its
  `where`, at least one step holding a picture, and none marked. When the thing asked about doesn't exist yet, it
  shows what happens in its place. Each option's chart draws what would be different under it, where a person would
  see it.

## settled

Every item says how it was decided, by teaching.md's Recording each decision. Of Claude's calls, the one or two most
likely to be wrong carry `wrongIf`: what about the author's situation would make the call wrong. The page shows those
first, each with its flip, and folds the rest, so the author's eye goes to the calls worth checking.
**Checked**: its keys, as said there; when the plan has a call of Claude's, one or two carry `wrongIf`, and no more.

## The build

`build`, at the top of the file, is the steps as they have gone so far: one item for each step started, in order.

```json
"build": [
  { "state": "done", "saw": "invoice-1042.pdf · 1 page", "code": [
    { "where": "invoices/read.py", "name": "read_invoice", "does": "Opens the file and hands on each page with its number" }
  ] },
  { "state": "done", "saw": "Every letter in its place.", "found": "Two fonts had no letter table. Their words show as boxes." },
  { "state": "stopped", "saw": "The total sits on the wrong line.", "causes": [
    { "text": "Letters on one line differ in height by a hair", "check": "Print the height of each letter on that line" }
  ] }
]
```

- `state`: `"now"` while the step is being built, `"done"`, or `"stopped"` when it waits for the author.
- `saw`: what the step showed, in the same terms as its `see`, so the page sets the two side by side.
- `found`: what the step taught that the plan didn't know, in a sentence: the unknown's answer, or a surprise.
- `code`: where the step's code is, once it is written: each file by its path (`where`), the function or class in it
  when one holds the step's work (`name`), and what it does there in the step's own words (`does`). The author goes
  from the idea to the code that carries it.
- `causes`, on a stopped step: the possible reasons, the cheapest to check first, each with its `check`.

The page draws it on each step: Done, Building now, Stopped for you or Not started, with what the plan promised beside
what the step showed. A stopped step has a box for the author's words, which reach the chat as `step <n>: <their
words>`. **Checked**: it holds no more items than the plan has steps; every item but the last is `done`; a `done` or
`stopped` item has `saw`; a `done` item has `code`; each `where` is a file of the repository as it stands now, outside
`docs/plans`, and each `name` is in that file; only a `stopped` item has `causes`.

## Telling it back

Once every step is `done`, the page asks the author to explain what was built, as they would to a colleague: what it
does, how it is built, what was chosen over what and why, what that cost, and what they would do differently. Their
words reach the chat as `told: <their words>`, and are kept in `told`, at the top of the file:

```json
"told": {
  "at": "2026-11-21T16:40:00-05:00",
  "said": "It reads the file from the end to find the index, then …",
  "right": ["Why the file is read from its end", "Why letters are grouped by where they sit"],
  "missed": ["What reading columns one at a time costs: a page with a pull quote across both is split"]
}
```

`right` and `missed` are what the plan's own record shows they have and haven't got (SKILL.md step 8), each a
sentence, `missed` holding at most three. The page draws `told` after the last step. This is the plan's test of
itself: an author who can't give this account didn't get from the plan what it was for. **Checked**: `told` only when
every step is `done`; `at` and `said` are there; `missed` holds at most three.

## Plan changes

Once the plan is approved, each change gets an entry at the top of the `Plan changes` section, numbered from 1, the
newest first:

```json
{ "h3": "<n>. <what changed, in a line> (<moment>, <who: the model, the author>)" },
{ "p": "Why: <the reason: a comment, something a step found, the author's call>" },
{ "p": "Changes: <the steps and cases it touches>" }
```

The drawing outlines every item the change touched (SKILL.md step 3), so the entry and the outlines together show what
moved and that everything else stands as approved.
