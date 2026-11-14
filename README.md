# Flowtrace

Flowtrace is a plugin for Claude Code and Codex, by [Perillo](https://perillo.ai). Its four skills help you understand a
change before you make it or approve it, by drawing a page you can read, answer and comment on.

| Skill | What it does |
|---|---|
| `plan-flows` | Plans a change before any code, from the code it touches. Its page draws each case the change handles differently, today beside after, asks only what you alone can decide, and lists Claude's other calls for you to flip. You answer and approve it. |
| `plan-flows-tech` | Draws a plan's technical page, for the engineer who builds it: how the pieces fit and what each runs on, the ideas behind the approach drawn on the plan's example, why each technology beats the obvious way, and how each case runs through the pieces. `plan-flows` draws it by itself when a change adds a part or connects parts; run it yourself any time you want it. |
| `plan-check` | Has a fresh subagent test what the approved plan takes as true and find the cases it leaves open, then asks you each one. |
| `explain` | Explains how something works, or asks you to choose, case by case: one chart for each situation, today beside after for a change, following one worked example drawn as you would see it. It asks only a choice that is yours to make, lists its own calls for you to flip, and records each decision with who made it and when. `plan-flows` is the same teaching with research for a better way, its questions, and a plan to approve and build from. |

In Claude Code a skill runs as `/flowtrace:plan-flows`, and in Codex as `$flowtrace:plan-flows`. Claude or Codex may also
start one by itself when your request fits it: `plan-flows` when a change adds or alters behaviour, `explain` when you
must choose or ask how something works.

## Install

Claude Code:

```bash
claude plugin marketplace add PerilloAI/flowtrace-plugin
```

```bash
claude plugin install flowtrace@flowtrace
```

Codex:

```bash
codex plugin marketplace add PerilloAI/flowtrace-plugin
```

```bash
codex plugin add flowtrace@flowtrace
```

## What it needs

- **Node 18 or later and git**, on your machine. The page script and the hook are plain Node files, with nothing to
  install.
- **Claude Code or Codex opened on the code.** `plan-flows` and `plan-check` check for what they need first, and say so
  when it is missing, as in a chat with no files or commands. `explain` goes on without them.

## Updates

A plugin added from this repository doesn't update by itself. Either turn on auto-update for the `flowtrace` marketplace
in Claude Code's `/plugin` menu, or update by hand and restart:

```bash
claude plugin marketplace update flowtrace
```

```bash
claude plugin update flowtrace@flowtrace
```

In Codex:

```bash
codex plugin marketplace upgrade flowtrace
```

```bash
codex plugin add flowtrace@flowtrace
```

## What it runs, reads and sends

Everything below happens for the person using the plugin. Nothing else in this repository runs for you.

**On your machine**

- The skills read your code, and write plans under `docs/plans` when you plan a change: the plan, the notes its research and code
  reading returned, and for a large change its technical page's data. They make no commit and switch no
  branch.
- Once you approve a plan, or run `plan-check` on it, your approval is written into the plan with the moment you gave it, and each decision the plan records says who made it, how and when. When its last question is
  answered, the skill starts building at once, changing your code under your harness's usual permissions, and shows you
  every change before anything is committed.
- `page/page.mjs` draws each page from a data file, to a temporary folder. It runs `git` to look up names and the default
  branch. It makes no network call of its own. A step's picture of the example is HTML or SVG a skill writes; the script
  refuses one that would run anything or load anything from elsewhere.
- `plan-flows`, `plan-flows-tech`, `plan-check` and `explain` share their rules on teaching a reader in `skills/teaching.md`, which each
  reads before its first step.

**A hook, in every session in the Claude app**

`hooks/explain-before-ask.mjs` runs each time Claude is about to fill the app's next-step box. When that box asks you to
choose between ways of doing something, and no page has been published or opened since your last message, the hook
refuses the call and tells Claude to draw the page with `explain` and publish it with the Artifact tool first. A plain go-ahead passes. It does this in every session where
the plugin is enabled, whichever skill is running or none. It reads that session's transcript on your machine to tell,
imports only Node's file reading, and sends nothing anywhere.

**What leaves your machine**

- **Google Fonts.** Opening a page loads its fonts from `fonts.googleapis.com` and `fonts.gstatic.com`, which see your IP
  address as for any web font. No page content goes with the request.
- **Published pages.** In Claude Code, the skills, and Claude when the hook asks, may publish a page through Claude's
  Artifact tool, private to you unless you share it. A page holds what the skill wrote about your code. In Codex, a page is shown with its visualize skill.
- **Web searches.** `plan-flows` may start subagents that search the web for how a thing is best done, in your harness's
  own web tool. They are given the design choice, your request in your words, and your stack.

Nothing else leaves your machine: the plugin names no server of its own. Perillo's general privacy policy is at
[perillo.ai/privacy](https://perillo.ai/privacy).

## For developers

`observations/` holds what outside tools were seen to do, each with the small script that captured it
(`*.probe.mjs`). Those probes are for people working on this plugin. The plugin never runs them, and each says what it
runs: `plugin-hook-deny.probe.mjs` runs one `claude -p` turn, which calls a
model; `skill-reads-teaching.probe.mjs` runs four `claude -p` turns, one per skill, which call a model;
`transcript-rows.probe.mjs` reads the transcripts you name; `plugin-marketplace-and-manifest.probe.mjs` runs the
Codex CLI on scratch folders, with no model; `import-meta-dirname.probe.mjs` prints what Node gives.

```bash
node --test hooks/*.test.mjs page/*.test.mjs scripts/*.test.mjs
```

`AGENTS.md` gives the rules for changing the plugin.

## License

[Apache-2.0](LICENSE).
