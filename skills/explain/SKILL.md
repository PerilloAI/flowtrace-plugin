---
name: explain
description: Ask the person to choose, or explain how code, a change or a piece of work fits together, so that someone who has never seen it understands it. In the chat when nothing waits on a choice; on a page when one does, with the whole picture first, one worked example with real values traced through before and after flowcharts, and questions that check the reading. Use whenever the person must choose between ways of doing something, large or small, and when they ask how something works, what a change did or why a bug happened.
---

# explain

explain teaches someone a thing they haven't seen, so they can decide or act on it. Write for a **newcomer**: a person
who knows software but has never read this code, this branch or this conversation, and who may read the explanation a
week from now. Everything they need is in it.

It teaches the way people learn from explanations ([research.md](research.md) gives the sources, for whoever changes
this skill; a run needn't open it):

- **The whole before the parts**: the bigger goal this belongs to, its pieces in order, which are done, and where this
  one sits, before any detail.
- **Every name explained wherever it appears**, in plain words saying what the thing does for someone: on a page,
  under Names on this page; in the chat, a few words where it first appears. A name that doesn't help the reader is
  replaced by what it does. A step number, a branch, a tool or an error code always comes with what it is.
- **One worked example** with real values, followed through before and after charts side by side.
- **Where each fact comes from** (`file:line`, a test, a record, a document, a person, or your own reading), so
  checking it costs a click.
- **Short and focused**: a chart holds only the steps the example needs, one idea a box; what matters most comes
  first.
- **Questions that check the reading**, each answer saying why: reading an explanation feels like understanding even
  when it isn't.

explain only reads: it writes nothing in the repository and makes no commit. A page's data goes in a temporary
directory outside the repository.

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

Done when you can say in two sentences, that a newcomer would follow, what this is and why it matters to the reader,
and each name you will use has a plain description.

## 3. Pick the worked example

Pick the one case that shows the problem most plainly: a person doing one thing with real values, such as an export of
order 1042, a request that gets 403, a run with its counts. Take every value from the code, a test or the data, and
check it before you draw it.

Done when the problem shows in the example alone.

## 4. Write the page

Write the page's data as one JSON file, as [blocks.md](../../page/blocks.md) shows: its `title` (what is explained or
asked), `about` (the repository, and the pull request, branch, plan or files, linked), then these sections in this
order, so that a reader who stops after any section has had the most important part. Leave out a section the page
doesn't need.

1. **What I'm asking** (or **In short**, when there is nothing to decide): one or two plain sentences, your
   recommendation first.
2. **The big picture**: two or three sentences, and a chart of the goal's pieces in order, each done, this one
   (`"kind": "here"`) or still to come, with the related work beside its piece.
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

**Charts**: each step holds the example's own values in plain words, with `where` on a step of code; mark what works
✓ and what never runs or is refused ✗ (`result`), and put the one thing to notice beside its step as `note`. A fact no
chart carries cites its source where it is said.

**Questions** ask what a person gets in a case, what happens next, which piece does what; a name, a path, a count or a
date is never the answer. Each is complete on its own, naming the person, the values and the situation, and its wrong
options are what a reader who skimmed would believe.

Done when every case has a chart, every box shows the example's value or state, and each name in a box has its line
under Names on this page.

## 5. Show it

- **In the chat**: under about 40 lines, with one case. Each chart goes in its own fenced block under its heading,
  drawn with `│` and `▼`, a branch fanning out as `┌──┴──┐`. Before sending, read it yourself with step 6's brief and
  close what it finds.
- **As a page**: draw it with `node <page.mjs> explain <the data file>` (`../../page/page.mjs` from this skill's
  folder); it prints each failure with its line, so fix the file and run it again. Show the page at the path it prints
  the way this harness shows a page best: in Claude Code, publish that file with the Artifact tool, the same path each
  time; in Codex, with its visualize skill; elsewhere, draw with `--whole` and give the file's path.

  Then, at once: start the cold read (step 6), and ask the page's decision in the chat, your recommendation first (in
  the Claude app, as the next-step box's question), so the person reads and answers while the cold read runs. Picking
  an option on the page copies its answer, such as `A · Retry once`, to paste into the chat; say so in a few words,
  and leave the options and their charts to the page. A plan's
  skills ask as their own steps say.

Done when the explanation is in front of the person, and for a decision, the question is asked.

## 6. Read it cold

The writer knows the context and can't see what is missing; a reader with none can. Other skills read their pages cold
by this step; for them, the decision is what the page asks its reader to do. Read it cold once, after the page is
shown: start a fresh subagent the way this harness starts one (in Claude Code, the Agent tool with a general-purpose
agent, which runs in the background), on a faster model where the harness lets you choose one, with nothing from this
chat, and give it the data file's path with this brief:

> You have never seen this project or this conversation. Read the explanation in `<path>`. List, under two headings:
> "Can't follow": every name, number, step or claim you can't understand from it alone; "Before deciding": every
> question you would have to ask before you could decide or act on it, which the explanation neither answers nor lists
> under Still open. Quote the words each is about, and mark an item "changes the decision" when its answer could change
> what you would decide or do. Reply "Clear" when both are empty.

Fix only what is wrong: a false or contradictory claim, a name missing from Names on this page or meaning two things,
and an item marked "changes the decision", answered on the page when the code, the plan, the pull request or the
records answer it, and otherwise put under Still open. Close each gap in the fewest words that close it: a long answer
raises new questions. Check every new fact as in step 3. Make all the fixes at once, draw and show the page again at
the same link, and say in a line what changed. When a fix changes the decision (a new option, another
recommendation), ask again; when the person has answered already, show them that fix before acting on their answer.

Done when the fixes are on the page. One round is enough: its fixes start no new cold read.
