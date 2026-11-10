---
name: explain
description: Ask the person to choose, or explain how code, a change or a piece of work fits together, so that someone who has never seen it understands it. In the chat when nothing waits on a choice; on a page when one does, with the whole picture first, one worked example with real values, drawn as a person would see it, traced through before and after flowcharts, and questions that check the reading. Use whenever the person must choose between ways of doing something, large or small, and when they ask how something works, what a change did or why a bug happened.
---

# explain

explain teaches someone a thing they haven't seen, so they can decide or act on it. Read
[teaching.md](../teaching.md) in full before step 1: it holds the rules explain shares with the other skills (the
reader, the worked example, charts, questions, showing the page, the cold read).

explain only reads: it writes nothing in the repository. A page's data goes in a temporary directory outside the
repository.

## 1. Choose the chat or a page

- **A go-ahead**, a yes on a step the person already knows (commit, push, open a pull request, act on what was just
  explained or found): ask it in one sentence, your recommendation first, and stop here. In the Claude app it is the
  next-step box's question with one reply button, or the app's own buttons and at most one reply.
- **An explanation** with nothing to choose (how something works, what a change did, why a bug happened): the chat,
  by steps 2, 3 and 5. It becomes a page when it runs past about 40 lines or the person asks for one.
- **A choice** between ways of doing something: a page, by every step. In the Claude app, the plugin's hook
  (`hooks/explain-before-ask.mjs`) refuses a next-step box with two or more reply buttons until a page has been
  published, or opened again, since the person's last message. A step only they can take, such as signing in, goes in
  your message.

## 2. Gather the whole picture

Find out who will read it and what they will do with it: decide, review, fix, use. Then read what surrounds the thing:
the goal it serves and where that is written (a plan, an issue, a pull request, a design document); the goal's pieces
in order and the state of each (done, in progress on which branch, waiting, not started); the related work the reader
may know by name. Check each against its source (`git status`, `git log`, the forge, the plan, the code), reading only
what the explanation will say, with independent reads at once.

Then prove the explanation's premises, as [premises.md](../premises.md) says: which path the case takes, what each
outside thing does there. The cold read can't catch a wrong one, since it reads only what you wrote. A cause ("why a
bug happened") is proved by a trace or by running it, along with what rules out the other causes it could have been. A
premise you can't prove is marked as unproved where you use it, and on a page goes under Still open too.

Done when you can say in two sentences, that a newcomer would follow, what this is and why it matters to the reader,
each name you will use has a plain description, and every premise is proved from its source or marked unproved.

## 3. Pick the worked example

Pick it, and see it as a person would, by teaching.md's The worked example.

## 4. Write the page

Write the page's data as one JSON file, as [blocks.md](../../page/blocks.md) shows: its `title` (what is explained or
asked), `about` (the repository, and the pull request, branch, plan or files, linked), then these sections in this
order, so that a reader who stops after any section has had the most important part. Leave out a section the page
doesn't need.

1. **What I'm asking** (or **In short**, when there is nothing to decide): one or two plain sentences, your
   recommendation first.
2. **The big picture**: two or three sentences, and a chart of the goal's pieces in order, each done, this one
   (`"kind": "here"`) or still to come, with the related work beside its piece. When the thing belongs to no larger
   piece of work, chart the thing itself: its parts in the order a person meets them, the one this page is about
   marked `here`.
3. **The example**: the case, in the reader's terms.
4. **What you'd see**: for each thing a person does that this changes (signs in, runs a command, opens a page), one
   chart with Today and After as `columns`, as that person meets it: Today marked where it goes wrong, After under the
   recommendation.
5. **How it works**, only when the after chooses between cases: a chart of how it decides, each exit naming its case,
   then a chart per case under an `h3`, on the example or its smallest variant that lands there, the case where it
   gives up or falls back included.
6. **Check your reading**: 2 or 3 `question`s.
7. **The choice**: one `choice`, each option the same example charted to what the person gets. Under it,
   `{ "h3": "Still open" }` and a list of each question this choice leaves open, saying who answers it and when. A
   page asks one decision: when the work holds several, ask the one that comes first and list the others here. With
   nothing to decide, Still open is a section of its own.
8. **Already settled**: a `settled`, what isn't open, each item with who settled it.
9. **Names on this page**: a `names`, every name the page uses.

Charts and questions follow teaching.md's Charts and Questions that check the reading.

Done when every case has a chart, every box shows the example's value or state, each question and the choice draws
the example in its own charts, and each name in a box has its line under Names on this page.

## 5. Show it

- **In the chat**: under about 40 lines, with one case. Each chart goes in its own fenced block under its heading,
  drawn with `│` and `▼`, a branch fanning out as `┌──┴──┐`, and a step's example right under that step as a small
  text picture (a grid of cells, the lines with the used part marked). Before sending, read it yourself with
  teaching.md's cold-read brief and close what it finds.
- **As a page**: draw and show it by teaching.md's Show the page.

  Then, at once: start the cold read (step 6), and ask the page's decision in the chat, your recommendation first (in
  the Claude app, as the next-step box's question), so the person reads and answers while the cold read runs. Picking
  an option on the page copies its answer, such as `A · Retry once`; say so in a few words, and leave the options and
  their charts to the page. A plan's skills ask as their own steps say.

Done when the explanation is in front of the person, and for a decision, the question is asked.

## 6. Read it cold

Read the page cold once, by teaching.md's Read it cold; for explain, what is still open goes under Still open. When a
fix changes the decision (a new option, another recommendation), ask again; when the person has answered already, show
them that fix before acting on their answer.

Done when the fixes are on the page.

## 7. After an answer or a comment

Write it in by teaching.md's After an answer or a comment, then draw and show the page again.
