---
name: plan-deliverable
description: Plan something that isn't a change to code (a course, an event, a hiring round, a launch, a report, a budget) with the person who wants it, starting from what they will hold at the end. Agrees the deliverable first with a sketch, asks why, for whom and what is fixed one question at a time, then draws a page in layers - what they get, the calls only they can make with what each option gives and costs, and the edge cases worth a look - which they answer and send back. Use when someone asks to plan, design or put together something that isn't code, and when plan-flows is asked to plan one.
---

# Plan a deliverable

plan-deliverable plans a thing that isn't code with the person who will own it. They know their field, but may never
have written a prompt and may not know what to ask for. So the plan starts from what they will hold at the end, asks
one question at a time from the highest level down, and stops where they stop caring: a detail they don't need to
decide goes into the deliverable, not into a question.

The plan is a JSON file, `docs/plans/<name>.json` in the folder you're working in, written as
[deliverable.md](../../page/deliverable.md) describes. `page.mjs`, in the plugin's `page` folder (`../../page/page.mjs`
from this skill's folder), checks it and draws its page, so you write the plan and never the page. While planning,
write the plan file and nothing else.

## How to ask

Steps 1 and 2 ask in the chat, one question at a time, each with lettered answers and your best guess first, so the
person can answer with a letter or in their own words. Use the harness's question tool when it has one (in Claude
Code, AskUserQuestion), otherwise one short message. Skip any question their words already answer, and never ask two
at once. From step 4 the questions go on the page, where several sit side by side and each opens on its own.

Write for them: their words and their field's terms. A software word (flow, field, schema) appears only where their
field uses it too, and the names of these steps never appear.

## 1. Agree the deliverable

1. From their words, name what they will end up holding: each file or thing (an agenda, a budget and the invite; a
   course map and a workbook for each project; a scorecard and a set of interview questions).
2. Show it as a sketch in the chat, its shape in a few lines with one example filled in: a table is its header row and
   one row, a document its headings, a spreadsheet its tabs and one filled row, a message its subject and first line.
   Keep the whole sketch under about 15 lines.
3. Ask whether that is what they want to end up with. Your sketch is the first answer; the others are the plausible
   alternatives (more, less, a different form).

## 2. Ask why, for whom, and what's fixed

Three questions, one after the other, in plain words (never "job to be done"):

1. **Theirs**: what having it will let them do. Guesses span kinds: save preparation time, replace an old version,
   pass a review, win a client, run it again next year.
2. **Its audience's**: what the people who use it must be able to do afterwards. Learners build something on their
   own, guests know where to be and when, interviewers score candidates the same way, readers make a decision. When
   more than one group uses it, an answer names each.
3. **What's fixed**: what can't move, such as a date it's needed by, money, people, a place or a length, and anything
   they already lean towards. Your answers are what their words so far suggest; one answer is "nothing fixed yet".

The first two set what done means: the `tldr` says in a few words what it's for, and every recommendation's `why`
comes back to them. What's fixed goes under `settled`, and shapes every option.

## 3. Find how it's best done

1. Read what they gave you (notes, an old version, a file, a link). A fact on the page comes from there or from a
   source the card's `from` names. A number with no source says so where it appears ("about 60k, my estimate").
2. Find the method people who make this kind of thing for a living use, and let it set the order of the questions and
   how each deliverable is drawn: a course by backward design (what learners can do, then how that's checked, then the
   lessons), an event by its run of show, a hiring round by its scorecard before its interviews, a report by its
   reader's question before its sections. Search the web for the method when you don't know it, and for the facts the
   deliverable needs that they didn't give you (going rates, usual lengths, rules that apply), and say in the chat
   what you found and where.

## 4. Write the plan

1. **What you get.** Each deliverable from step 1, drawn as it will look with one real example filled in, in its
   field's own form: a week-by-week table, a run of show, a budget's bars, an email as it will read. Never a flowchart
   of steps. Where an open question changes it, draw it with your recommendation, and redraw it when they pick
   otherwise.
2. **Questions for them.** Only calls that change a deliverable and that only they can make, highest first, in the
   order the method gives. Each has your recommendation, and every option says what it gives and what it costs in the
   deliverable's own terms (hours, money, people, weeks, pages). A call they already made goes under `settled`, unless
   it costs something they may not have seen: then it stays a question, with their option marked `chosen`, so they
   see the cost. Draw a picture when the choice changes something they can see.
3. **Edge cases.** What could go wrong once the deliverable is in use (a person missing, a number off, a date
   slipping, the world changing), each with what happens and whether the plan covers it. What to consider is what the
   plan does about it when it's covered, and what they could do when it isn't.
4. **Keep to the high level.** A detail they don't need to decide (a session's wording, a cell's formula) goes into
   the deliverable or under a card's `more`, named by what it opens. The page holds what they decide and what could go
   wrong; the deliverables hold the rest.

## 5. Draw and show the page

1. From the folder you're working in, run `node <page.mjs> deliverable docs/plans/<name>.json`. It prints each failure
   with its line: fix the file and run it again.
2. Look at the page before anyone else does, in a browser your harness has, or a screenshot of the file drawn with
   `--whole`: open each card, and fix any picture that overlaps, runs off its card or can't be read. The script checks
   what a picture holds, not how it looks.
3. Show the page at the path it prints, by [teaching.md](../teaching.md)'s Show the page. That section is the one part
   of teaching.md this skill reads: the rest writes for a newcomer to code, and this skill writes for someone who knows
   their field.
4. In one or two lines, say what's on the page and what you need: open each question and pick, mark each edge case,
   then send the answers, or copy and paste them here.

## 6. Take the answers

1. **A pick** ("1 A, 3 B"): move each picked question under `settled` with its option's words, and change everything
   the pick changes: a deliverable's picture and line, the `tldr`, another question's options. A pick that differs
   from your recommendation is theirs to make; don't argue it again.
2. **Let's discuss** on an edge case: talk it through in the chat, then write what you agree into the plan (it becomes
   `covered`, or a deliverable changes).
3. A new question an answer raises goes on the page only if it changes a deliverable.
4. Edit the file in place, draw it again and publish it to the same path.

## 7. Make it

When no question is open, ask once whether to make the deliverables now. Then make each as its picture showed, in the
form agreed (a spreadsheet, a document, an email), and say where each one is.
