# A page's data

A page is drawn from a JSON file by `page.mjs`, in this folder. You write the file; the script checks it and draws the
page, with its styles and its script, the same way every time. The one HTML you write is a step's picture of the
example (`shows`, below).

```sh
node <this folder>/page.mjs plan docs/plans/<change>.json      # a plan (plan-flows, plan-check)
node <this folder>/page.mjs explain <file>.json                # an explanation (explain)
node <this folder>/page.mjs fingerprint docs/plans/<change>.json
node <this folder>/page.mjs seen <file>.json
node <this folder>/page.mjs now                                # this moment, as "at" and "approved" write it
```

- **It checks first.** On a failure it prints every problem, each with its line in your file (a missing comma, a key
  the format doesn't have, a broken rule), and writes nothing. Fix the file and run it again.
- **It prints one line of JSON**: the page's path (`page`), and for a plan its `fingerprint`, whether it is `approved`
  at that fingerprint, and its counts: `cases`, `questions`, `minutes` (the whole page), `gist` (the gist alone) and
  `steps`.
- **It outlines what changed** since the person last read the page. `seen` keeps a copy of the file as they have read
  it: run it when their message arrives, before you edit the file. Every drawing after outlines what differs from that
  copy. `--since <copy.json>` compares with another copy.
- **The page is an HTML fragment**, as Claude Code's Artifact tool and Codex's visualize skill take it. `--whole`
  writes a whole document, for a file the person opens in a browser. `--out <path>` puts it elsewhere.

## Writing it

- Strict JSON: keys and texts in double quotes, no comments, no comma before `}` or `]`.
- **No text runs over a line.** A paragraph is one string on one line; lines of code are a list of strings. Write `\"`
  for a quote inside a text.
- Keep one item to a line: a step, a row, a name, an option. Then each edit is one line, and so is each failure.
- Texts may hold `**bold**`, `` `code` `` and `[links](https://…)`. A link goes to `https:`, `http:`, `mailto:` or
  `#` a place on the page.
- Every key below is all there is: a key the format doesn't give is refused.

## The file

```json
{
  "title": "What is explained or asked",
  "about": "For an explanation: the repository, and the pull request, branch or files, linked",
  "sections": [
    { "heading": "A section's heading", "content": [ … ] }
  ]
}
```

`pictures`, before `sections`, holds each picture more than one step shows (Pictures, below). A plan also takes
`approved`, `reviewPage`, `build` and `told` (plan-format.md), and may open with `intro`, a `content` list before the first
section. Each item of a `content` list is one object with one key:

| Item | What it draws |
|---|---|
| `{ "p": "…" }` | a paragraph |
| `{ "list": ["…", "…"] }`, `{ "numbered": ["…", "…"] }` | a list, with bullets or numbers |
| `{ "h3": "…" }` | a subheading |
| `{ "table": { "head": ["…", "…"], "rows": [["…", "…"]] } }` | a table, each row one text per heading |
| `{ "code": { "lang": "sh", "lines": ["…", "…"] } }` | code, shown as written |
| `{ "chart": { … } }` | a flowchart (below) |
| `{ "case": { … } }` | one situation: `title`, `gets`, and `today` beside `after` for a change or `steps` for how something works (teaching.md, Cases); on a plan, only inside a step |
| `{ "flow": { … } }`, `{ "question": { … } }` | a way in through the code, step by step, and a question that checks the reading (below); never on a plan |
| `{ "choice": { … } }` | a decision for the person (below); on a plan, only inside a step |
| `{ "settled": [ … ] }`, `{ "names": [ … ] }` | below |
| `{ "whole": { … } }`, `{ "step": { … } }` | on a plan only, below |

## chart

A flowchart, top to bottom. `title` (which a question's `read` can name) and `about` are optional. A chart has
`steps`, or `columns` drawn side by side, each `{ "title": "Today", "steps": [ … ] }`.

```json
{ "chart": { "title": "How it decides", "steps": [
  { "text": "The export asks the warehouse for order 1042", "kind": "start" },
  { "text": "Did it time out?", "kind": "question", "answers": [
    { "label": "yes", "steps": [ { "text": "Wait 30 seconds and ask again" } ] },
    { "label": "no", "steps": [ { "text": "The file downloads", "result": "ok" } ] }
  ] },
  { "text": "A step", "where": "exports/run.ts:42", "note": "the one thing to notice", "inner": [ { "text": "a step inside it" } ] }
] } }
```

A step's keys, each optional but `text`:

- `text`: the step, in the example's own values.
- `kind`: `"start"` where it starts, `"question"` a question that decides, `"here"` the piece the page is about.
- `result`: `"ok"` it works (✓), `"bad"` it fails or is refused (✗).
- `where`: a file and line, or a function; drawn small under the words.
- `note`: the one thing to notice, beside the step.
- `part`: on a change that shows how its pieces fit, the part this step runs in, in the words of its box under How
  the pieces fit (teaching.md).
- `mark`: on a case's `after` or a How the pieces fit chart, what the change does to this step: `"+"` adds it, `"~"` changes it, `"-"` removes it.
  Drawn as a tag before the words.
- `answers`: on a question only, each `{ "label": "yes", "steps": [ … ] }`. Several fan out side by side; one alone
  sits beside its question while the chart carries on below.
- `inner`: steps drawn in a dashed box under this one.
- `shows`: on a chart's step (a question's and a choice's steps are a chart's), never a flow's, the example as it is
  at this step, drawn inside the step's card under its words (Pictures, below).

## Pictures

A step's `shows` is the example as it is at that step, as a picture:
`{ "html": ["<table>", "…", "</table>"], "from": "tests/fixtures/order-1042.json" }`. `html` is the picture, in HTML or
SVG, one line a string. `from`, where it came from, is left out when there is no such file, and the card then says it
was drawn for this page.

- **Drawn once, shown wherever it's needed.** A picture more than one step shows, such as a question's case showing
  what a chart already draws, goes under `pictures` at the top of the file, by a name of your own, and each step shows
  it by that name. A change to it then reaches every step, and the file holds no copies.

  ```json
  {
    "title": "…",
    "pictures": {
      "order 1042, ready": { "html": ["<table>", "…", "</table>"], "from": "tests/fixtures/order-1042.json" }
    },
    "sections": [ … { "text": "Ana presses Export on order 1042", "shows": { "use": "order 1042, ready" } } … ]
  }
  ```

- **Its lines are joined with line breaks.** Where a picture keeps white space as typed, a break between two strings
  shows as one.
- **Styling.** A tag may carry a `style` attribute; a picture has no classes to use. A `<table>` gets the page's own
  borders. Colour with `currentColor` and the page's colours, which follow light and dark: `var(--fg)`,
  `var(--muted)`, `var(--line)`, `var(--card)`, `var(--bg)`, `var(--accent)`, `var(--ok)`, `var(--bad)`, and the soft
  backgrounds `var(--accent-soft)`, `var(--ok-soft)`, `var(--bad-soft)`. A fixed colour that reads on white can vanish
  on dark. In SVG a page colour goes in `style` (`style="fill: var(--ok)"`), since an attribute takes no variable. The
  page's fonts are `var(--body)` and `var(--mono)`.
- **Width.** A step holding a picture takes its chart's whole width, or its column's in a chart drawn side by side,
  and a wider picture scrolls inside its card. Draw for about 600px, or 400px in a column.

**Checked**: a picture only draws, with HTML boxes and tables or SVG shapes and text: `div`, `span`, `p`, text tags
such as `b`, `em`, `mark`, `kbd` and `code`, `pre`, tables, lists, `figure`, `h4` to `h6`, and SVG's shapes, `text`,
gradients and markers. It holds no script, `style` tag,
frame, image, link, form, `id`, `on…` attribute, nothing that loads from elsewhere (`src`, `href`, `url(…)` in a
`style`), and no tag left open; write a `<` in its words as `&lt;`. Each `use` names one of `pictures`, each of
`pictures` is shown by at least one step, and no picture is written out twice.

## question

A question that checks the reading, on an explanation: its case charted up to the step it asks about, with the example
drawn as it stands there, and each option charted on from there to what the person gets, drawn as a card holding its
chart.

```json
{ "question": {
  "question": "The question, complete on its own: it names the people, values and situation?",
  "steps": [ { "text": "The case, up to the step asked about", "kind": "start", "shows": { "html": ["<table>", "…", "</table>"] } } ],
  "options": [
    { "text": "a wrong option a skimming reader would believe", "steps": [ { "text": "what the person gets under it" } ] },
    { "text": "the right option", "steps": [ { "text": "what the person gets under it" } ] },
    { "text": "another wrong option", "steps": [ { "text": "what the person gets under it" } ] }
  ],
  "answer": "B",
  "read": "a chart's or case's title, a section's heading, a flow's name, or a step's where",
  "why": "One or two sentences."
} }
```

On the page, the link to `read` opens what it names in a modal over the page, so the reader keeps their place. A click
on an option's words, or anywhere else on its card but a link or a button in it, picks it.

Write the options about the same length, so the right one doesn't stand out. **Checked**: three different options,
each with its chart, `answer` the right one's letter, a `read` that names a part of the page, and no `result` on an
option's steps, which would give the answer away. Across the page, the right option doesn't sit in the same place
every time, and a page asks no more than two.

The reader answers from the question alone, so it holds its own picture of the example (a step's `shows`), even when
a chart elsewhere on the page draws the same one, which it then shows by its name (`use`). **Checked**: at least one step of the case holds a picture, and
either every option's chart holds one or none does.

## choice

One decision, charted on one real case under each option, the recommendation first.

```json
{ "choice": {
  "number": 3,
  "question": "The question, carrying its case",
  "today": [ { "text": "On a plan, the case as the code runs it now", "kind": "start", "shows": { "html": ["…"] } } ],
  "recommended": "The recommended option, in a sentence",
  "alternatives": ["Another option, in a sentence"],
  "options": [
    { "name": "Retry once", "steps": [ { "text": "The case under the recommended option", "kind": "start", "shows": { "html": ["<table>", "…", "</table>"] } } ] },
    { "name": "Don't retry", "steps": [ { "text": "The same case under this one", "kind": "start" } ] }
  ],
  "why": "Why the recommendation: a test, a file and line, a doc, a decision, or the reason",
  "decides": "On a plan: the facts about the person's own situation that make each option the right one"
} }
```

On a plan a choice sits in the `choices` of the step it belongs to, written as the object inside `{ "choice": … }`.
`decides`, on a plan only, is drawn before the options, as "What decides it", and names no recommendation.

Each option is drawn as a card holding its chart, which the reader picks with a click on its words or anywhere else on
it but a link or a button in it. Picking one gives the chat its answer: sent where the page can
send to the chat, otherwise copied, with a line saying so. A plan's answer is its number and letter (`3 A`), and the
picks of every question so far are copied together (`1 A, 3 B`), so one paste answers them all; an explanation's is
the letter and the option's name (`A · Retry once`).

The first of `options` is the recommended one; they are lettered A, B, C, D in order. A plan numbers each choice and
adds `today` (plan-format.md); an explanation leaves both out. **Checked**: 2 to 4 options, and one `alternatives` text per
option after the first; on a plan, `decides` on each; on an explanation, no `decides`.

The person decides from the choice alone, so it holds its own picture of the example (a step's `shows`): the case as
it stands, and under each option what the person would get where they would see it. **Checked**: at least one step
holds a picture, of `today` on a plan, of an option's chart on an explanation.

## settled

```json
{ "settled": [
  { "who": "Sam", "how": "said", "at": "2026-11-14T09:30:00-05:00", "text": "What was settled" },
  { "who": "Sam", "how": "rule", "from": "AGENTS.md", "text": "A rule from a file" },
  { "who": "Claude", "how": "claude", "text": "A call the person hasn't made", "alternatives": ["What else they could pick"], "wrongIf": "What about the person's situation would make this call wrong" }
] }
```

`who` is the person's name, as the conversation or `git config user.name` gives it, and `you` when neither does. A
rule from a file is its author's when known, and otherwise `the repository`'s, with `from` naming the file. `Claude`
(or the model's own name) is for a call the person hasn't made.

Each item also says how and when it was decided, since the decisions are kept as a record (teaching.md, Recording
each decision):

- `how`: `"chose"` the person picked it, from a question or by flipping a call; `"said"` they said it, in their
  request or a comment; `"rule"` a file holds it; `"claude"` Claude's call.
- `at`: the moment it was decided, `YYYY-MM-DDTHH:MM:SS±HH:MM`, as `page.mjs now` prints it. A rule has none (its
  file's history holds it), and neither has Claude's call: it stands once the person answers the page, or on a plan,
  once it is approved.
- `alternatives`: on Claude's call only, what else the person could pick, each a flip on the page.
- `wrongIf`: on a plan, on the one or two of Claude's calls most likely to be wrong. The page draws those first, under
  "Calls most likely to be wrong", each with its `wrongIf` and its flip, and folds Claude's other calls under a line
  that counts them.

## flow

A way in through the code, from what starts it down to what the caller gets, for an explanation (a plan
draws cases in its steps instead). Write one for each way in that the change adds or touches.

```json
{ "flow": { "name": "The way in, in plain words", "steps": [
  { "keyword": "Starts", "text": "who or what starts it: a request and who sends it, a person's action, a command, a schedule, a call into a library", "where": "file or function" },
  { "keyword": "Step", "text": "what it does", "where": "function", "mark": "~", "inner": [
    { "keyword": "Check", "text": "a question whose yes is the way out?", "mark": "+", "answers": [
      { "label": "yes", "steps": [ { "keyword": "Raises", "text": "the error as the caller sees it", "mark": "+" } ] }
    ] }
  ] },
  { "keyword": "Step", "text": "a step the change removes", "where": "function", "mark": "-" },
  { "keyword": "Returns", "text": "what the caller gets" }
] } }
```

- **Keywords**: `Starts`, `Step`, `Check`, `Only if`, `Repeats`, `Tries`, and to end `Returns`, `Raises`, `Exits` or
  `Finishes`. A `Check`, `Only if`, `Repeats` or `Tries` takes `answers`, each `{ "label": "yes", "steps": [ … ] }`
  (`no`, `fails (someone saved the same name first)`). A step with none, as inside an answer, is plain words.
- **Marks**: `"mark": "+"` new, `"~"` changed (its code changes), `"-"` removed, and no mark for what exists. Keep a step
  for each existing step the change sits among, so the reader sees where it lands. A flow added as a whole is
  `"mark": "+"` on the flow, and its steps carry none; a flow removed is `"mark": "-"`.
- **Lean.** List the flow's top-level steps, one per function the change adds, changes or removes on it, in the order
  they run. Under them (in `inner`, or an answer's `steps`), put every check whose branches end differently for whoever
  started the flow (another response or page, an error, an exit status, a write, an event), each answer with its end.
  Leave out checks whose branches end alike for the caller, and nested helpers.
- **Names.** `where` holds the code's name for a step: a function, a `Class.method`, or a file by its path from the
  repository's root.
- **Plain English.** Write each step the way you'd explain it to someone who uses the code and has never read it: what
  the caller sees, what is checked about them or their data, and what is saved, sent or queued. The code's names go in
  `where` and only there. A code the caller itself receives goes in parentheses after the words: `"not found" (404)`.
- A flow's step takes no picture: the example is drawn on a chart's steps.

## names

One item per name a newcomer wouldn't know, in alphabetical order, `also` holding other spellings the page uses:

```json
{ "names": [
  { "name": "warehouse service", "also": ["warehouse"], "text": "the service that holds stock and answers each export's questions" },
  { "name": "letter table", "usual": "ToUnicode map", "text": "the table in a font that says which letter each shape is" }
] }
```

`usual` is the name the field uses for a thing the page calls by a plain word, drawn beside it, so a reader who goes
on to the field's own docs knows what to search for.

Pointing at, clicking or tapping any mention of a name shows its line beside it, so each name means one thing: where
the same word means something else, reword the sentence.

## whole

A plan's first item: the whole change, in a few lines. Its keys and what each says are in plan-format.md (whole).

```json
{ "whole": {
  "problem": "What is wrong today, on the example, in a sentence or two",
  "gets": "What the change gives a person, in a sentence or two",
  "shows": { "html": ["…"] },
  "for": "Who it is for", "in": "What it covers", "out": "What it leaves out for now",
  "assumes": "What the page takes its reader to know",
  "unknown": "What nobody knows yet, and the step that tests it",
  "asking": "What they approve, and which steps hold a question for them",
  "map": [ { "text": "This plan, in a line", "here": true }, { "text": "The next plan" } ]
} }
```

`shows` is a picture as on a chart's step (Pictures), or `{ "use": "…" }`. The page draws `gets` large with the
picture under it, then `asking`, then the rest as a short list of labelled lines (For, In, Left out for now, Assumes,
Not known yet), and the `map` as a row of plans with this one marked. Under it the page adds what it works out itself:

- **Everything that will happen, in order**: every step's `label`, or its `title` when it has none, on one line,
  numbered, each a link to its step, the steps holding a question for the person shaded.
- **How long it takes to read**: the gist alone and the whole page, at 230 words a minute over every text the reader
  reads: all of the page's texts but its pictures, Names, Claude's folded calls and the `build` and `told` records.
  The gist alone also leaves out every step's `how`. Neither has a limit.

A `chart` of the parts may follow `whole` (plan-format.md, Sections). **Checked**: a plan has exactly one `whole`,
first in The whole thing, with every key but `unknown` and `map`; The whole thing holds nothing else but that one
chart; a `map` marks exactly one plan `here`.

## step

One step of a plan's storyboard, under What will happen, in order, one for each step in the order they are built.
What each key says is in plan-format.md (step).

```json
{ "step": {
  "title": "Read every letter on a page, with where it sits",
  "label": "Letters",
  "shows": { "use": "inside invoice 1042" },
  "caption": "Each letter of invoice 1042, placed where the file says.",
  "gist": "The file stores shapes and where each one goes, not words, so this step collects them.",
  "how": {
    "frames": [ { "part": "…", "shows": { "html": ["…"] }, "text": "…", "notes": ["…"] }, … ],
    "decides": [ { "number": "…", "decides": "…" } ],
    "breaks": "…",
    "more": [ { "table": { … } } ]
  },
  "trade": { "chose": "…", "over": "…", "because": "…", "costs": "…" },
  "cases": [ { "title": "…", "gets": "…", "today": [ … ], "after": [ … ] } ],
  "choices": [ { "number": 1, "question": "…", … } ],
  "see": "1,210 letters, each in its place, matching the page by eye",
  "unknown": true
} }
```

- `shows` is a picture as on a chart's step (Pictures), drawn beside the step's words, with `caption` under it.
- `how` is drawn under How it works, and holds no paragraph. Its `frames` are drawn one under the other,
  numbered, each a card as wide as the step: the part that acts, the frame's picture on the left, and beside it its
  caption with its `notes` as small points. A picture has the room a table or a request needs, so it is not cut off. A `how` with a `chart` in place of `frames` draws that flowchart. Then `decides` as a table of each number and
  what it decides, `breaks` as Where it goes wrong first, and `more` (a `table`, `list`, `numbered` or `chart`) under
  More detail. The page's switch, "The gist and the technical parts" or "The gist only", hides every step's `how` and
  nothing else.
- `trade` is drawn as The trade-off: Chose, Over, Because and It costs.
- `cases` and `choices` hold cases and choices as `case` and `choice` give them, each written as the object inside
  `{ "case": … }` or `{ "choice": … }`. Cases are drawn under What a person gets.
- `see` is drawn as You will see, until the build reaches the step.

Each step is drawn as a numbered row: its picture beside its title, tagged "Your call · question <n>" when it holds a
question and "Tests what nobody knows yet" when it carries `unknown`, and its gist; then, across the step's width, How it works, its
cases, its trade-off or its questions, and You will see. After the last step the page draws Every trade-off, in the order it is
made: a table of each step's number, what it chose, over what, and what it costs. A step with a question and no
`trade` shows "Your call: question <n>" in its row.

**Checked**: at least one step, and nothing else under What will happen, in order; a `gist` of fifty words or fewer;
a `how` with `frames` or a `chart`, never both, and `breaks`: two to eight frames, each with a picture, a caption of
twenty-five words or fewer and at most three notes of twenty-five words or fewer;
a `trade` with all four of its texts, its `costs` naming a cost, never "nothing" or "none"; when `whole` has an
`unknown`, exactly one step with `"unknown": true`, and otherwise none. A plan's cases and choices stand only in its
steps.

## The build on the page

Once the plan has a `build` (plan-format.md, The build), each step draws where the build stands at it, tagged Done,
Building now, Stopped for you or Not started: what the plan promised (`see`) beside what it showed (`saw`), and what
it `found`. A stopped step draws its `causes` open, each with its `check`, and a box for the person's words, which
gives the chat `step <n>: <their words>` the way a choice gives its answer.

Once every step is done, the page asks the person to tell it back, after the last step and the trade-offs: the fixed
question (plan-format.md, Telling it back) and a box whose words give the chat `told: <their words>`. Once the plan
has `told`, the page draws it there instead: their account, what it had right, and what it missed.
