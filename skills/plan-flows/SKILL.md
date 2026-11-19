---
name: plan-flows
description: Plan a change before any code, as a storyboard its author can follow and steer, even in a field they are new to - the whole thing first, then every step in the order it is built, each with a picture of the example, the gist, how it works, the trade-off made there and what you will see when it works. Research into how the change is best done reaches the author as a question at the step it belongs to. During the build the page shows each step's result beside what was promised and stops for the author when they differ, and when it is done the author explains it back. Use whenever a change adds or alters behaviour, before any code, whenever an approved plan changes, and when someone wants to build something while learning how it works.
---

# Plan flows, as a storyboard

The plan is a JSON file, `docs/plans/<change>.json`, written as [plan-format.md](plan-format.md) describes, with its
fingerprint and approval. The plan file is the page's data: `page.mjs`, in the plugin's `page` folder
(`../../page/page.mjs` from this skill's folder), checks it and draws its page, so you write the plan and never the
page. The author reads the page, answers its questions, flips any of Claude's calls they'd make differently, and
comments and approves in the chat. The plan's steps and cases are the contract the code is written to: what gets
built, in what order, and what each person gets.

The page is for an author who must understand the change well enough to steer it and to explain it afterwards, and
who may be new to the field it is in: someone who has never built a search index, a parser or a model, and wants to
learn it by building one. So the plan tells everything that will happen, in the order it happens. Each step shows
the example as a picture, says the gist in a sentence or two, then how it works, then the trade-off made there. A
reader who goes from top to bottom once has the whole of it.

Read [teaching.md](../teaching.md) in full before step 1. It holds how every Flowtrace page teaches, the same as
explain's: the reader, cases today beside after, the worked example and its pictures, asking the person and recording
each decision, showing the page, the cold read. plan-flows adds four things to it, and this file is about those:

- **Research for a better way** (step 1): subagents look for how the problem is best solved, and a better way than the
  one asked for reaches the author as a question, before the plan is written around it.
- **A storyboard** (step 2): every step in the order it is built, each with its picture, its gist, how it works, its
  trade-off and what the author will see.
- **A plan to build from** (steps 5 and 6): the plan file, its approval with the exact moment, plan-check.
- **A build the author can follow and steer** (steps 7 and 8): step by step, each step's result written onto the page
  beside what the plan promised, stopping for the author when the two differ, and ending with the author explaining
  what was built, in their own words.

Then check the session by teaching.md's Before reading the code.

While planning, write the plan file, its notes and the learning record (step 1), and nothing else. The author commits the plan when they choose, on the branch
they're on.

## 1. Read the code, and find how the change is best done

The author says what they need, and may not know the way that is known to work best. A plan that builds exactly what
they asked reads well to them even when a better way exists, so research it, while the code is read.

Research and reading run at once, and both start in the first minute: the research from the request and the manifests
alone, the readers from a few searches for what the change touches. Start them all in one message, so they run
together even where the harness waits for each result, and work on while they run. A plan that waits for its reading
to finish before its research starts takes minutes longer, and is no better for it.

**Start the research first**, before reading any code. Start from the problem behind the author's request: what they want someone to be able to do,
stop or fix. Their words and the code show one way to solve it, and a specialist may know a far better one, so the
first choice to research is the problem itself (a request for a cache asks how to make this page fast). Then list the
design choices the change makes that many projects have made before and written about: what to build a new part on (a search index, a queue, a
scheduler, a store), how to retry an outside call,
sign people in, page through a list, cache, migrate a database, show a form's errors, make a screen accessible, or
shape a command's output. Keep at most three in all, the ones whose answer changes most what someone gets. When the
request shows the change makes none (a rename, a bug with one obvious fix, a change that lets no one do anything new),
research nothing. When the code read later shows a researched choice is already settled by a pattern the code uses
throughout, weigh its findings against that pattern like any other.

A recorded decision of the repository's takes no choice off this list. Whoever recorded it chose without what the
research may find now, so research the choice as if the decision weren't there, and weigh the two below.

Read the stack from the repository's manifests (such as `package.json`, `pyproject.toml`, a `.csproj`, `go.mod`): its
languages, frameworks and their versions. Then start one fresh subagent per choice, all at once, by
teaching.md's A fresh subagent (when the harness lets fewer run at once, start the rest as each returns) (in Claude Code it runs in the background and can search the web), with this brief:

> Find how this is best done: `<the choice, in a sentence>`. The author asked for: `<their request, in their words>`.
> The problem behind it: `<what they want someone to be able to do, stop or fix>`. The stack, which is what exists today
> and no limit on the answer: `<languages, frameworks, versions>`. Read only, and change nothing in the repository.
> Search the web, and prefer the framework's or library's own docs for these versions, standards and specifications,
> and guides from teams known for the subject; use a blog post or forum answer only where those say nothing.
>
> Return, in under 300 words:
>
> - **Established way**: what a specialist in this would reach for today, even when neither the request nor the stack
>   suggests it, in two or three sentences, and what it gives the people using the code.
> - **The obvious way, and what it costs**: what someone who doesn't know the practice would build, and what goes wrong
>   with it, on one concrete case.
> - **Alternatives**: other sound ways, each with when it fits better.
> - **Pitfalls**: the mistakes the sources warn about.
> - **Sources**: each a link and the claim it supports, with the versions or modes it holds for. Mark a claim
>   "unsourced" when no source says it.
>
> Return "No established way" when the sources disagree or say nothing, and say what they disagree about.

Where the harness can't start a subagent that searches the web, research nothing, and say so in the chat and in What
I'm asking, so the author knows no better way was looked for. A premise about an outside thing is still proved from
its own docs, read yourself (below): that checks what the plan rests on, and looks for no better way.

**Read the author too.** From what they said of themselves and how they wrote the request, settle what they already
know of this field: `whole`'s `assumes`, your call, for them to flip. Read `docs/plans/learned.md` when it is there:
the **learning record**, which holds what this author explained on earlier plans, in their own words, and what their
account missed (step 8 writes it). What they explained there, they know: it moves the `assumes` line up, and this
plan doesn't explain it again. What their account missed is explained with more care this time. Pitch every step at
that line: a thing past it is explained, on the example, at the step that first needs it, and a thing before it is
left out, since an explanation of what the reader already knows costs them as much as a missing one.

**Start the readers** in the same message as the research. First find what the change touches, in a few searches and
no more: the functions or files it edits or removes, and the ways in that reach them (routes, pages, commands, jobs,
tool handlers, a library's public functions), found by searching for each one's name. Then start one fresh subagent
per way in, by teaching.md's A fresh subagent, grouping small ways in so no more than four run; each traces its way in
so you don't have to read it all yourself. The brief:

> Trace how `<the way in>` runs today in this repository, for this change: `<the request, in a sentence>`. It reaches
> `<the functions or files the change touches>`. Read only, and change nothing. Read each function on its path, every
> caller of the ones the change touches that this way in uses, and the tests that run them.
>
> Return, in under 500 words, quoting no more than a line of code anywhere:
>
> - **Path**: the steps an ordinary call takes, in order, each a plain sentence with the function or file it runs in
>   and its `file:line`, and the values it hands on.
> - **Situations**: how each of these ends today, with the `file:line` that decides it, or "can't arise" and why: the
>   usual input, empty, missing, duplicate, too large, another person's, in another state, twice at once, stopped
>   half-way, an outside call that fails.
> - **Tests**: each test that pins what this path does, and what it checks.
> - **Surprises**: whatever doesn't do what its name says, a bug, a check that's missing.

While they run, do what needs no trace: read the repository's instruction files and recorded decisions, prove the
premises about outside things from their own docs (below), and pick the example. When the readers return, list the
cases from their Situations, as teaching.md's Cases says: keep each that ends differently after the change, and note
which of them the request and the code don't yet settle: each is a decision, asked or Claude's call (teaching.md, Asking the person). Read the code yourself only where a trace is unclear, two traces disagree, or a case rests on a
step no trace gave. A reader that fails, or a harness that can't start one, leaves its way in for you to read the same
way: each function on the path, its callers and its tests.

**Weigh what the research returns** against the code you read. The established way fits when the code and its
framework can take it. A recorded decision of the repository's (an entry in its decisions file or an ADR, a rule in
its instruction files or docs) doesn't settle that by itself: it is a choice someone made before this research, and
only the author can say whether it still holds. Use no claim marked "unsourced", and nothing from "No established
way". Then each finding goes one of four ways:

- **It agrees with the author's request, or adds a detail they wouldn't decide differently**: the plan builds it. When
  it is something the author would notice, it is your call under Already settled, its source linked in its `text`.
- **It differs from the request in what someone gets, or costs something the author would weigh** (a dependency, a
  migration, more work), and they could reasonably want either: a question at the step it belongs to. The established way comes first unless the code
  speaks against it, the author's request is one of the options, the case is charted as it runs today and under each
  option, and `why` links the sources. Never swap the request for it silently: the author decides, and the page shows
  them there was a better way. The way that would change most what people get is question 1, unless a recorded
  decision's question takes that place (next), and The whole thing says so. Another way gets an option only when it
  gives people something clearly different.
- **A recorded decision stands in its way**: the code could take the finding, it would give the people using the code
  something better, and a recorded decision forbids it. Never drop it, and never plan around the decision in silence.
  The decision was made without this finding, so the author may not know what keeping it now costs, and a plan that
  quietly obeys it hides the better way from the one person who can change it. Do both of these:
  - **Tell the author at once, in the chat**, as soon as the finding is weighed and before the plan is written: the
    decision in its own words and where it is recorded, the better way in a sentence, what it would give people that
    the decision keeps from them, and that the page will ask it as its first question. Then go on planning without
    waiting. An author who already knows the decision is out of date can say so now, which saves writing the plan
    twice.
  - **Ask it on the page** as question 1. The question quotes the decision and says where it is recorded. `today`
    charts the plan's case as it runs under the decision, and the options chart the same case with the decision kept
    and with the better way, so the author sees before and after side by side. `why` says what makes the better way
    better, with its sources, then what the decision was protecting, from its own recorded reason when it gives one,
    and whether that reason still holds against the finding. Put the better way first when the decision's reason
    doesn't reach this case or the finding answers it, and keeping the decision first when its reason still holds.
    The whole thing names the decision and the better way.

  A plan that takes the better way changes the record too: one of its changes rewrites or retires the decision where
  it is recorded, so the repository's docs never contradict what gets built.
- **It doesn't fit this code**: leave it out. The code has to rule it out, such as a framework that can't do it. A
  recorded decision doesn't (above), and neither does its cost, since that is for the author to weigh.

When a research subagent fails, plan without it, and say in the chat which choice wasn't researched.

**Keep what they return.** Write each research subagent's and reader's return, as it came back, into
`docs/plans/<change>.notes.md`, under a heading naming its choice or its way in. Each step's how it works and its
trade-off are written from these: the established way and the obvious way it beats, each part and what it runs on.
Once the plan is drawn, put its fingerprint on the notes' first line: `Plan fingerprint: <fp>`.

**Name what nobody knows yet.** Of everything the plan rests on, find what neither the code, the docs nor the research
can settle before something is built and run: whether an approach holds on this data, at this size, with this outside
thing. A change in a field the author is new to always has one. It goes in `whole` as `unknown`, and the step that
tests it comes as early in the order as it can (step 2), so as little as possible is built on it untested. A plan
with none says nothing.

**Prove the plan's premises**, as [premises.md](../premises.md) says, before you write anything: which path the
example takes today, what each outside thing does there, and each research finding the plan will use. A premise found
false changes the plan you are about to write, so read again from there. A premise nothing here can prove is a
question at the step it belongs to, the author being the one who can answer it.

Done when every step of `today` and every unmarked or changed step of `after` names a function or file you have read
or a reader traced, you know which tests pin what each one does today, every subagent you started has returned and its findings
are weighed, the author has been told in the chat of each recorded decision that stands in a better way's path, and
every premise is proved from its source or is a question.

## 2. Write the plan

Read [plan-format.md](plan-format.md) first: it gives the storyboard, the sections in order, each item's keys, and the
rules every drawing checks; [blocks.md](../../page/blocks.md) gives the items a plan shares with any page. Name the
file after the change, never the branch (`docs/plans/<change>.json`): a branch is gone once it merges, and the plan
stays. Pick one example by teaching.md's The worked example and follow it through every step, so the reader meets the
same person and values throughout.

**Lay out the steps first**, before writing any of them: everything that will be built, in the order it is built.
The first step is the least that runs from one end to the other on the example, however little it does. Each later
step adds one thing. The step that tests what nobody knows yet comes as early as it can. Give each a name of a few
words, then read the names in order: they should tell the whole story to someone who reads nothing else. When they
don't, a step is missing, or two steps are one.

**Then write each step**, every one with the same shape:

- **The picture.** The example as it is at this step, drawn as a person would see it (teaching.md, The worked
  example). Draw every step: a reader who looks only at the pictures, in order, should follow what happens.
- **The gist.** What happens at this step and why it is there, in one or two plain sentences, with no code name and
  no word the reader would have to look up.
- **How it works.** The technical part, for the engineer who will build it and explain it, from the notes and the
  code, in enough detail to build from. Draw it: it holds no paragraph, since a block of text is where a reader stops
  reading. Follow the example through the step in frames, one for each moment, in order. Each frame is a picture of
  the example as it is right then, as the program holds it or as a person sees it (the bytes at the end of the file,
  the request as it is sent, the row in the table, the reply), with a caption saying what happened to get there and
  up to three notes holding the detail that belongs to that moment. Keep all of the detail and lose none of it to
  the drawing: what a command means, the exact field, the reason, each on the frame where it applies. Then the
  numbers that decide what happens and what each decides, and where the step goes wrong first. When the step
  branches, or its parts answer each other, draw a chart in place of the frames. An engineer who reads it should
  learn something they could not have guessed from the gist. Name a thing by what it does ("the font's letter
  table"), and give the field's own name once, where the thing first appears, and under Names (`usual`).
- **The trade-off.** When the step could sensibly have been built another way: what was chosen, what it was chosen
  over, why, and what the choice costs, from the research (the established way and the obvious way it beats) and the
  code. Say the cost plainly, in terms of what someone gets or has to do. A cost you can't name means the other way
  isn't understood yet: read again. Never invent a trade-off for a step that has none.
- **The cases.** Each situation the step changes for a person using the code, today beside after, in the step that
  makes it come true (teaching.md, Cases).
- **What you will see.** What the author can look at when the step works, in the example's own values.

**Asking.** For each decision you noted, decide whether to ask it, by teaching.md's Asking the person. Most aren't
the author's to make: each is your call, told as the trade-off at its step and listed under Already settled for the
author to flip. Of your calls, say what would make the one or two most likely to be wrong wrong. A decision that is
the author's is a question in the `choices` of the step it belongs to, in place of that step's trade-off, saying what
decides it: the facts about the author's situation that make each option the right one.

**The whole thing.** Write `whole` last and put it first: the problem today, on the example, then what the change
gives, in a sentence the author could repeat, drawn on the example, who it is for, what it covers and what it leaves
out.

While a question is open, write the steps as if its recommended option were taken, and say so in `whole`'s `asking`:
the author reads one plan, and an answer that differs rewrites it by step 4.

**Tell all of it, in short steps.** A gist is fifty words or fewer, and the drawing refuses a longer one. There is no
limit on how many steps a plan has: a hard subject has more steps, never longer ones. A step whose how it works
needs more than eight frames is two steps. What is another change goes on the `map` as a plan of its own.

Done when all of these hold:

- The steps' names, read in order, tell everything that will happen.
- Every step has its picture, and the pictures, in order, tell the story.
- A reader of The whole thing, the pictures, the gists and the trade-offs alone has a true account, and a reader of
  how it works could build it and explain it.
- Every step's how it works is drawn: a reader who looks only at its frames' pictures, in order, sees the example
  change, and no frame's picture is its caption in a box.
- Every choice that could sensibly have gone another way is a trade-off at its step, with its cost, or a question
  there.
- Every situation the change handles differently is a case, in the step that makes it come true, those that end alike
  grouped, and none that ends as it does today is drawn.
- Every question is one teaching.md's Asking the person sends to the author, stands on its own, and says what decides
  it.
- Every other decision is under Already settled: the author's own words as `said`, rules as `rule`, your calls as
  `claude` with their alternatives.
- Every design choice the research covered is built the established way with its source linked, asked as a question,
  or left out because the code rules it out. None is left out because a recorded decision forbids it.
- A reader of The whole thing alone knows what is wrong today, what they get, what is left out and what nobody knows yet, and learns of
  the best way the research found, when it isn't what they asked for, and of any recorded decision that stands in its
  way.
- No word past `assumes` is used before it is explained.
- Every number about something outside the repository (a price, a limit, a size, a measured result) links the source
  it was read from, or says it is an estimate and from what. A number from memory is neither.

## 3. Draw the page

Every drawing goes through these steps, whatever asked for it: a new plan, a comment, an answer, a plan change, or
plan-check. Each time a message from the author arrives, run `node <page.mjs> seen docs/plans/<change>.json` before you
edit the plan, so the drawings after it outline what changed since they read it.

1. **Draw.** From the repository's root, run `node <page.mjs> plan docs/plans/<change>.json`. It checks every rule
   plan-format.md marks **checked** (the steps and their pictures, the cases' names at the merge base with the default branch and their
   marks, the choice rules, the settled items, the section order) and prints each
   failure with its line. Fix the plan and run it again. Done when it prints its line of JSON: the page's path and the
   fingerprint.
2. **Show the page** at the path it printed, by teaching.md's Show the page.
3. **Write the review page's link** after the first publish that gives one: `"reviewPage": "<link>"`, after `title`
   (and `approved`, if there is one). It is not part of the fingerprint, so nothing is drawn again.
4. **Read it cold**, only when the plan has new words of its own: a new plan, or plan-check's findings. An answer, an
   approval or a comment's small fix is the author's own and needs none. Start it once the page is shown, by
   teaching.md's Read it cold, giving the subagent the plan file's path.
5. **Ask at once** after a new plan's first drawing, while the cold read runs: the author reads the page, answers its
   questions by picking an option on each and flips any of your calls under Already settled (the page copies them
   all as one line, such as `1 A, 3 B, call 2 B`, to paste into the chat) or types their numbers and letters, comments
   in the chat, and approves, either with Approve's line or by saying approve. In the chat, say how many questions are
   open and that they are answered on the page; don't restate them or their recommendations there, since the page
   charts each one and two copies drift apart. plan-check asks as its own steps say.
6. **When the cold read returns**, a fix only makes the plan's words clearer, and goes into the plan file; a gap whose
   answer would change what the plan does is a decision, asked or your call by teaching.md's Asking the person. On a plan approved at its current fingerprint, propose the fixes in the chat,
   and make them by step 6 of this skill only on the author's OK. Write them in together with any message from the
   author that has arrived, then draw and show the page again, at the same link, and say in a line what changed. Its
   fixes start no new cold read.

Done when the page, at the current fingerprint, is in front of the author, with the cold read's fixes on it.

## 4. Answer each comment and answer

A comment arrives in the author's own words, or as the line Comment gives: a box's words and where the box sits. Reply
in the chat with what changes in the plan, or why it stays.

An answer to a question arrives as its number and letter (`3 A`, or several at once,
`1 A, 3 B`, as the page copies the options picked), in Comment on its box, or in the author's own words. A flip of one
of your calls arrives as `call <n> <letter>`, the call's number on the page and the alternative picked (B the first).
Write it in:

1. Run `node <page.mjs> now`, and under Already settled add `{ "who": "<the author's name>", "how": "chose", "at":
   "<that moment>", "text": "<the behaviour, in the plan's terms>" }`. A flip replaces the call it flips with that
   item, its `text` the alternative picked.
2. Change each step and case the answer decides, write the step's `trade` from the option taken (what was chosen,
   over what, why, and what it costs), and remove the question from the step.
3. Sweep the whole plan by teaching.md's After an answer or a comment: no part may still say what the answer replaced.

Write in everything one message from the author brings, comments included, sweep, then draw the page once (step 3).
On an approved plan, the edit is a plan change (step 6).

## 5. Approve

The author gives Approve's line, `Approve plan <fingerprint>`, or says approve, which means the fingerprint of the page
this session last showed. In a session that drew no page, the plan is the file in `docs/plans` whose fingerprint that
is, or the one the author names. Running /plan-check approves the plan too: plan-check carries any question still open
and writes `approved` itself, with no need to come back here.

1. When the plan is already approved at its current fingerprint and plan-check has run on it, build it (step 7).
   When plan-check hasn't run, start it (step 5 below).
2. When that fingerprint isn't the plan's fingerprint now, or this session drew no page, draw the page (step 3) and ask
   the author to approve what's there now. Stop here until they do.
3. When questions are still open, name each by its number and question in the chat, and ask the author to answer them
   on the page, by picking an option on each, or by number and letter; their charts are on the page. Write each answer
   in as step 4 does, and draw the page again. The whole thing then says no questions are open. Done when no question
   is left open.
4. Write `approved` (plan-format.md), replacing any older one, with the moment `node <page.mjs> now` prints and the
   fingerprint `page.mjs` prints. Your calls still under Already settled are accepted with it. Draw nothing:
   plan-check's drawing shows "Approved".
5. Start the plan-check skill on the plan. Once its questions are answered, it builds the plan by step 7 without
   asking again.

## 6. When an approved plan changes

A comment on an approved plan, code that departs from it, or a drawing's refusal that makes you edit it, changes the
plan with no new approval and no new plan-check: the author sees each change with the code (step 7), so nothing they
approved changes unseen.

1. Edit each step and case the change touches, and put a numbered entry at the top of Plan changes, as
   plan-format.md shows it: what changed, why, and who.
2. Put the new fingerprint (`node <page.mjs> fingerprint`) in `approved`, with the tail ` · after plan change <n>`,
   then draw the page (step 3).

Done when the page shows the change outlined under its entry at the top, and `approved` matches the plan.

## 7. Build to the plan, step by step

The approved plan answered the author's questions before the build began, so the build asks them nothing the plan
answers. Before asking the author anything while building, look for the answer in the plan's steps and Already
settled, and when it's there, build that. The build's progress goes in the plan's `build` (plan-format.md, The build),
which is no part of the fingerprint, so writing it changes nothing they approved.

Build the plan's steps in order, one at a time. For each step:

1. **Build it**, with `"state": "now"` on its item, so each case in it ends as its `after` says, with tests that run
   the case's example. How the code gets there (which functions, in what order) is yours: it changes nothing anyone
   gets.
2. **Look at what it shows.** Run it on the example and write what you see into `saw`, in the same terms as the
   step's `see`: the line printed, the count, the picture as it came out. What you didn't run, you didn't see: never
   write `saw` from what the code should do.
3. **When it shows what the plan promised**, the step is `"done"`. Write into `found` anything it taught that the plan
   didn't know: the unknown's answer on its step, a surprise on any. Write into `code` where the step's code is: each
   file, the function or class that holds the step's work, and what it does there, in the step's own words, so the
   author can open the code that carries the idea they just read.
4. **When it shows something else**, the step is `"stopped"`. Don't build on it, and don't quietly make it pass. Write
   the possible `causes`, the cheapest to check first, each with the check that would settle it, and name any
   trade-off or call of yours that this puts in doubt. Draw the page and tell the author in a line that step `<n>`
   stopped, with what it promised and what it showed. Their words arrive as `step <n>: <their words>`, or in the chat:
   run the check they pick, or the first when they say go on, and show what it found. A fix that changes what someone
   gets, a case, a trade-off or a step is a plan change (step 6, its first step); a fix that doesn't is the build's
   own.

Draw the page (step 6, its second step) each time a step stops, and when the last step is done. When the code must
settle something that changes what someone gets and the plan leaves it open, make the call the plan's reasons and the
code support, and write it into the plan as a plan change. A premise the build finds false is such a change: say what
the plan believed and what the step showed.

Ask the author during the build only at a stopped step, and for what needs their own hands, such as signing in to
something. When the code is done, show the author every plan change with the code's changes, before anything is
committed.

Done when every step is `done` with what it showed beside what was promised, every case ends as its `after` says, its
example run by a test, and every call the build made is a plan change the author has seen. Then step 8.

## 8. Have the author tell it back

The plan was for an author who can say what was built, how, and what was traded for what. So once the last step is
done, draw the page, which now asks them to tell it back, and ask in a line for their account: what it does, how it
is built, what was chosen over what and why, what that cost, and what they would do differently. It arrives as
`told: <their words>`, or in the chat.

1. **Compare it with the plan's own record**, never with how you would have said it: each step's how it works and
   its trade-off, each decision under Already settled with the option not taken, what each step `found`, and every
   plan change.
2. **Write `told`** (plan-format.md, Telling it back): the moment (`node <page.mjs> now`), their words as given, in
   `right` what the account has, and in `missed` at most three things it lacks or gets wrong, the one that matters
   most first. A trade-off they didn't name is the commonest: what the chosen way costs, and when the way not taken
   would have been the better one.
3. **Reply in the chat**, in a few lines: what they have, then each thing missed, said plainly and with the step that
   shows it. Never grade it, and never say it back for them in full: an account they could only read is one they
   still can't give. When they send another, replace `told` with it.
4. **Write the learning record**, `docs/plans/learned.md`, making it when it isn't there: one entry for each thing
   the author explained.

   ```markdown
   ## <the idea or trade-off, as a sentence>

   - Plan: <change> · <moment>
   - In their words: "<what they said>"
   - Missed: <what their account lacked, or "nothing">
   ```

   A thing already there gets a new line of each under its heading, the newest last, so the record shows the account
   getting fuller. The next plan reads it (step 1). It holds the author's own words, so it is theirs: say in the chat
   that it was written, and where.

An author may not want to: ask once, and when they pass, write nothing and say the page keeps the question open. Draw
the page once `told` is written.

Done when `told` holds the author's account and what it missed, the learning record has each thing they explained,
and the page shows both; or the author has passed.
