# A page's data

A page is drawn from a JSON file by `page.mjs`, in this folder. You write the file; the script checks it and draws the
page, with its styles and its script, the same way every time. The one HTML you write is a step's picture of the
example (`shows`, below).

```sh
node <this folder>/page.mjs plan docs/plans/<change>.json      # a plan (plan-flows, plan-check)
node <this folder>/page.mjs explain <file>.json                # an explanation (explain)
node <this folder>/page.mjs fingerprint docs/plans/<change>.json
node <this folder>/page.mjs seen <file>.json
```

- **It checks first.** On a failure it prints every problem, each with its line in your file (a missing comma, a key
  the format doesn't have, a broken rule), and writes nothing. Fix the file and run it again.
- **It prints one line of JSON**: the page's path (`page`), and for a plan its `fingerprint`, whether it is `approved`
  at that fingerprint, and its counts.
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

A plan also takes `approved` and `reviewPage` (plan-format.md), and may open with `intro`, a `content` list before the
first section. A review (pr-review) may take `"send": true`, which offers Send answers once every question is answered. Each item of a `content` list is one object with one key:

| Item | What it draws |
|---|---|
| `{ "p": "…" }` | a paragraph |
| `{ "list": ["…", "…"] }`, `{ "numbered": ["…", "…"] }` | a list, with bullets or numbers |
| `{ "h3": "…" }` | a subheading |
| `{ "table": { "head": ["…", "…"], "rows": [["…", "…"]] } }` | a table, each row one text per heading |
| `{ "code": { "lang": "sh", "lines": ["…", "…"] } }` | code, shown as written |
| `{ "chart": { … } }` | a flowchart (below); a plan also has `screens` and `trace` (plan-format.md) |
| `{ "question": { … } }`, `{ "choice": { … } }`, `{ "settled": [ … ] }`, `{ "names": [ … ] }` | below |

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
- `change`: in a plan, the title of the change that makes this step.
- `answers`: on a question only, each `{ "label": "yes", "steps": [ … ] }`. Several fan out side by side; one alone
  sits beside its question while the chart carries on below.
- `inner`: steps drawn in a dashed box under this one.
- `shows`: on a chart's step, never a flow's, the example as it is at this step, drawn inside the step's card under its
  words: `{ "html": ["<table>", "…", "</table>"], "from": "tests/fixtures/order-1042.json" }`. `html` is the picture,
  in HTML or SVG, one line a string; `from`, where it came from, is left out when there is no such file, and the card
  then says it was drawn for this page. **Checked**: a picture only draws, with HTML boxes and tables or SVG shapes and
  text. It holds no script, `style` tag, frame, image, link, form, `id`, `on…` attribute, nothing that loads from
  elsewhere (`src`, `href`, `url(…)` in a `style`), and no tag left open; write a `<` in its words as `&lt;`.

## question

A question that checks the reading: its case charted up to the step it asks about, and each option charted on from
there to what the person gets, drawn as a card holding its chart.

```json
{ "question": {
  "question": "The question, complete on its own: it names the people, values and situation?",
  "steps": [ { "text": "The case, up to the step asked about", "kind": "start" } ],
  "options": [
    { "text": "a wrong option a skimming reader would believe", "steps": [ { "text": "what the person gets under it" } ] },
    { "text": "the right option", "steps": [ { "text": "what the person gets under it" } ] },
    { "text": "another wrong option", "steps": [ { "text": "what the person gets under it" } ] }
  ],
  "answer": "B",
  "read": "a chart's title, a section's heading, a flow's name, or a step's where",
  "why": "One or two sentences."
} }
```

A review's question also takes `source`, where its answer comes from: `map`, `test ran`, `test read` or `reading`.

On the page, the link to `read` opens what it names in a modal over the page, so the reader keeps their place. A click
on an option's words, or anywhere else on its card but a link or a button in it, picks it.

Write the options about the same length, so the right one doesn't stand out. **Checked**: three different options,
each with its chart, `answer` the right one's letter, a `read` that names a part of the page, and no `result` on an
option's steps, which would give the answer away. Across the page, the right option doesn't sit in the same place
every time.

## choice

One decision, charted on one real case under each option, the recommendation first, and worded as
[teaching.md](../skills/teaching.md)'s Questions to decide says: the question and each option's words say what a person
sees or gets, and the code goes in the steps' `where` and in `why`.

```json
{ "choice": {
  "number": 3,
  "question": "A shop owner's export fails whenever the warehouse is slow. Should it try again?",
  "recommended": "The shop owner gets the file, up to 30 seconds late",
  "alternatives": ["The shop owner sees \"Export failed\" and presses Export again"],
  "options": [
    { "name": "Retry once", "steps": [ { "text": "Ana exports order 1042", "kind": "start", "where": "exports/run.ts:42" } ] },
    { "name": "Don't retry", "steps": [ { "text": "Ana exports order 1042", "kind": "start" } ] }
  ],
  "why": "Why the recommendation in a plain sentence, then its evidence: a test, a file and line, a doc, a decision"
} }
```

Each option is drawn as a card holding its chart, which the reader picks with a click on its words or anywhere else on
it but a link or a button in it. Picking one gives the chat its answer: sent where the page can
send to the chat, otherwise copied, with a line saying so. A plan's answer is its number and letter (`3 A`), and the
picks of every question so far are copied together (`1 A, 3 B`), so one paste answers them all; an explanation's is
the letter and the option's name (`A · Retry once`).

The first of `options` is the recommended one; they are lettered A, B, C, D in order. A plan numbers each choice and
adds `today` (plan-format.md); an explanation leaves both out. A plan's question may be a fix (plan-format.md):
`"fix": true`, with one option, its words in `recommended`, and no `alternatives`. Its heading says "fix to confirm",
and picking its option confirms it. **Checked**: 2 to 4 options, or 1 for a fix, and one `alternatives` text per option
after the first; only a plan has a fix; and no `code` in the question, an option's words or its name.

## settled

```json
{ "settled": [
  { "who": "Sam", "text": "What was settled" },
  { "who": "Sam", "from": "AGENTS.md", "text": "A rule from a file" },
  { "who": "Claude", "text": "A call the person hasn't made" }
] }
```

`who` is the person's name, or `Claude` (or the model's own name) for a call the person hasn't made.

## names

One item per name a newcomer wouldn't know, in alphabetical order, `also` holding other spellings the page uses:

```json
{ "names": [
  { "name": "warehouse service", "also": ["warehouse"], "text": "the service that holds stock and answers each export's questions" }
] }
```

Pointing at, clicking or tapping any mention of a name shows its line beside it, so each name means one thing: where
the same word means something else, reword the sentence.
