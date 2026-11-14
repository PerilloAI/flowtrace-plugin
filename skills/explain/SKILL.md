---
name: explain
description: Ask the person to choose, or explain how code, a change or a piece of work fits together, so that someone who has never seen it understands it. Every case it handles, one chart each, today beside after for a change, following one worked example drawn as a person would see it; only a choice that is the person's to make, Claude's other calls listed to flip, and two questions that check the reading. In the chat for one or two cases; on a page for more, or when a choice waits. Use whenever the person must choose between ways of doing something, large or small, and when they ask how something works, what a change did or why a bug happened.
---

# explain

explain teaches someone a thing they haven't seen, so they can decide or act on it. Read
[teaching.md](../teaching.md) in full before step 1: it holds the rules explain shares with the other skills (the
reader, the page and its cases, the worked example, charts, questions, asking the person and recording each decision,
showing the page, the cold read). explain is that core and nothing more.

explain only reads: it writes nothing in the repository. A page's data goes in a temporary directory outside the
repository.

## 1. Choose the chat or a page

- **A go-ahead**, a yes on a step the person already knows (commit, push, open a pull request, act on what was just
  explained or found): ask it in one sentence, your recommendation first, and stop here. In the Claude app it is the
  next-step box's question with one reply button, or the app's own buttons and at most one reply.
- **An explanation** with nothing to choose (how something works, what a change did, why a bug happened): the chat,
  by steps 2, 3 and 5, when it has one or two cases. It becomes a page when it has more, runs past about 40 lines, or
  the person asks for one.
- **A choice** between ways of doing something: first decide whether it is the person's to make, by teaching.md's
  Asking the person. When it is your call, say in the chat what you'll do and what else they could pick, in a line or
  two, and go ahead unless they say otherwise. When it is theirs: a page, by every step. In the Claude app, the plugin's hook
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

## 3. List the cases, and pick the worked example

List the cases by teaching.md's Cases: for a change, each situation that ends differently after it; for how something
works, each situation that takes a different path, every way in included, so a reader who thinks of one finds it.
Then pick one example by teaching.md's The worked example and follow it through every case, varied only as far as each
case needs.

Done when every situation is in a case, those that end alike grouped, and you can draw each one on the example.

## 4. Write the page

Write the page's data as one JSON file, as [blocks.md](../../page/blocks.md) shows: its `title` (what is explained or
asked), `about` (the repository, and the pull request, branch, plan or files, linked), then teaching.md's The page, its
sections named:

1. `What I'm asking`, or `In short` when there is nothing to decide.
2. `The question`: one `choice`, standing on its own by teaching.md's Asking the person. Under it, `{ "h3": "Still
   open" }` and a list of the decisions it leaves open, saying who answers each and when. A page asks one decision:
   when the work holds several, ask the one that comes first and list the others there.
3. `How the pieces fit`, only when the change calls for it or the person asks how it will be built (teaching.md).
4. `What changes, case by case` for a change, or `What happens, case by case` for how something works: one `case`
   each.
5. `Check your reading`: two `question`s.
6. `Already settled`: your calls the page rests on, for the person to flip, and what they or a rule settled.
7. `Names on this page`.

Done when every case draws the example, the question and each reading question draw it in their own charts, and each
name in a box has its line under Names on this page.

## 5. Show it

- **In the chat**: under about 40 lines, with one or two cases. Each chart goes in its own fenced block under its heading,
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

Write it in by teaching.md's After an answer or a comment: the choice they answered, and each call they flipped,
becomes a `"chose"` item under Already settled with the moment `node <page.mjs> now` prints. Then draw and show the
page again.
