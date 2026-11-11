# A deliverable's plan

The plan-deliverable skill's page is drawn from a JSON file by `page.mjs`, in this folder, as a plan's page is. You
write the file. The script checks it and draws the page, with its styles and its script, the same way every time.

```sh
node <this folder>/page.mjs deliverable docs/plans/<name>.json
```

It prints every problem with its line and writes nothing, or prints one line of JSON: the page's path (`page`) and its
counts. `--whole` writes a whole document, for a file the person opens in a browser; `--out <path>` puts it elsewhere.
Write the file as [blocks.md](blocks.md)'s Writing it says: strict JSON, one item to a line, texts may hold `**bold**`,
`` `code` `` and `[links](https://…)`, and every key below is all there is.

## The page

The page has three layers, so a reader who wants only the high level stops at the first:

1. **The map**, one screen: the title, a TL;DR, a tile for each deliverable with its picture, and two columns of
   cards, the questions for the author and the edge cases.
2. **One card open**, with the map kept beside it as a strip (a row of chips on a phone). A question shows its picture
   and its options, each with what it gives and what it costs. An edge case shows what happens, its picture, what to
   consider, and Looks right / Let's discuss.
3. **A fold** in the open card, named by what it opens (`more`).

Picking an option, and Looks right or Let's discuss, fill one line of answers ("1 A, 3 B. Let's discuss edge case 2
(…)"), which the page sends to the chat where it can, or copies to paste.

## The file

```json
{
  "title": "What the author will have, in their words",
  "about": "The eyebrow over the title",
  "tldr": "What they get and what it's for, and what's left to decide, read in ten seconds",
  "deliverables": [
    {
      "name": "Agenda",
      "kind": "One page",
      "line": "What it is and what it's for, in one line",
      "picture": ["<table>", "…", "</table>"],
      "more": { "label": "See each session's notes", "picture": ["…"] },
      "from": "where its facts came from"
    }
  ],
  "questions": [
    {
      "question": "Where do you hold it?",
      "line": "The choice in one line",
      "picture": ["…"],
      "options": [
        { "name": "A venue an hour away", "gives": ["…"], "costs": ["…"], "recommended": true },
        { "name": "The office", "gives": ["…"], "costs": ["…"], "chosen": true }
      ],
      "why": "Why the recommendation, in one or two sentences",
      "more": { "label": "…", "picture": ["…"] },
      "from": "…"
    }
  ],
  "edgeCases": [
    {
      "title": "The venue cancels a week before",
      "line": "One line on the map card",
      "happens": "What happens to the deliverable",
      "picture": ["…"],
      "consider": "What to do about it",
      "covered": false,
      "more": { "label": "…", "picture": ["…"] },
      "from": "…"
    }
  ],
  "settled": [{ "who": "You", "text": "What the author already decided" }]
}
```

- **`deliverables`** are what the author will hold at the end, each drawn as it will look, filled with one real
  example. `kind` is the small label over its name (a spreadsheet, a one-page handout, an email).
- **`questions`** are the calls only the author can make, highest first. Options are lettered A to D in order.
  `recommended` marks yours. `chosen` marks one the author already picked before the costs were shown, so they see what
  it costs; the map card shows it as theirs. `picture` draws what the choice changes.
- **`edgeCases`** are what could go wrong with the deliverable. `covered` says whether the plan already handles it, and
  `consider` says how, or what the author could do when it doesn't.
- **`more`** is a fold under the open card, its `label` named by what it opens ("See week 4 as participants see it"),
  never "More" or "Details".
- **`from`** names where a card's facts came from ("your notes; the venue's quote"), shown as "From …". It names
  sources only: a number with no source says so where it appears.
- **`settled`** lists what the author already decided or can't change (a date, a budget), folded under the map.

## Pictures

A picture is HTML or SVG, one line a string, by [blocks.md](blocks.md)'s Pictures rules on what it may hold, its
styling and the page's colours for light and dark. A picture here is written where it's shown: there is no `use` or
shared `pictures`, and a card's `from` says where its facts came from. An open card's picture is about 700px wide on a
computer and the phone's width on a phone, and a wider one scrolls inside its card. A deliverable's picture also shows
on its tile at about 60% and cut off at the bottom, so put what identifies it at the top.

## Checked

- At least one deliverable and at most 6, at most 7 questions and at most 5 edge cases: the map fits a screen or two.
- A title, a deliverable's name, a question and an edge case's title have at most 12 words, a `line` at most 30, and
  the `tldr` at most 60.
- A question ends with a question mark, has 2 to 4 options with different names, exactly one `recommended` and at most
  one `chosen`, and each option gives and costs at least one thing.
- Every picture passes blocks.md's Pictures check, and holds at least one line.
