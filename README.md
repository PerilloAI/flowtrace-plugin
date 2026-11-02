# Flowtrace

Flowtrace is a plugin for Claude Code and Codex, by [Perillo](https://perillo.ai). Its four skills help you understand a
change before you make it or approve it, by drawing a page you can read, answer and comment on.

| Skill | What it does |
|---|---|
| `plan-flows` | Plans a change before any code, from the code it touches. You read the plan's page, answer its questions and approve it. |
| `plan-check` | Has a fresh subagent question the approved plan for the cases it leaves open, then asks you each one. |
| `explain` | Explains how something works, or asks you to choose, with one worked example traced through before and after flowcharts. |
| `pr-review` | Reviews a pull request or merge request from a copy of its code, and checks your reading with questions a second reader has answered blind. |

In Claude Code a skill runs as `/flowtrace:plan-flows`, and in Codex as `$flowtrace:plan-flows`. Claude or Codex may also
start one by itself when your request fits it: `plan-flows` when a change adds or alters behaviour, `explain` when you
must choose or ask how something works, `pr-review` when you ask for a review.

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
- **`gh` or `glab`** are optional. pr-review uses them when they are there and signed in.
- **Claude Code or Codex opened on the code.** `plan-flows`, `plan-check` and `pr-review` check for what they need first,
  and say so when it is missing, as in a chat with no files or commands. `explain` goes on without them.

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

- The skills read your code, and write plans under `docs/plans` when you plan a change. They make no commit and switch no
  branch.
- Once you approve a plan, or run `plan-check` on it, your approval is written into the plan. When its last question is
  answered, the skill starts building at once, changing your code under your harness's usual permissions, and shows you
  every change before anything is committed.
- `page/page.mjs` draws each page from a data file, to a temporary folder. It runs `git` to look up names and the default
  branch. It makes no network call of its own.
- pr-review fetches the pull request's commits into your repository's git objects, and copies its head to a temporary
  folder outside your checkout. It runs the pull request's tests and installs what they need in that copy, where your
  harness asks before a command. For a pull request from a fork, or one whose source it can't tell, it asks you first,
  naming the author and the commands. The copy is no sandbox: those commands run with your environment, your home folder
  and your network.

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
- **Your forge.** pr-review reads the pull request the first way that works: a GitHub or GitLab tool your harness has,
  `gh` or `glab`, the forge's public address, or your git sign-in. It never reads a token from your environment.
- **Perillo.** This plugin names one MCP server, `https://app.perillo.ai/mcp`, in `.mcp.json`:
  - Claude Code contacts that address when a session opens, as it does for any plugin's MCP server, sending its own name,
    version and capabilities and nothing about your code. Perillo's server sees your IP address, as any server does. Until
    you sign in, the server answers that sign-in is needed, and Claude Code asks it where to sign in and may register
    itself as a sign-in client.
  - Only pr-review calls its tools, and only once a member of a Perillo workspace has signed in. Perillo calls no model,
    and pr-review never sends it code or a diff. With no sign-in the review goes on from the code alone, and nothing is
    sent. Its page then says what a sign-in adds, and links to `app.perillo.ai` to request a workspace.

| Tool | What it sends |
|---|---|
| `pull_request` | the pull request's link; a workspace's name, when you have more than one |
| `code_impact` | the link; the workspace; a commit id; each changed file's path, with the ranges of lines changed |
| `record_drop` | the link; the workspace; the head commit; pr-review's version; the model running it; a question pr-review dropped, its options and its answer; a random id for the run; the rule it broke, or the option a second reader picked instead |
| `record_pick` | the link; the workspace; the head commit; pr-review's version; the model running it; a page's question and options; a random id for the page load; where the answer came from; the option you picked first and whether it was right |

`pull_request` also has Perillo read that pull request's title, description and author from the forge, through the
workspace's own connection, and keep them with its review.

A question's words can describe your code, since they ask what it does. When you are signed in, a question pr-review drops
is sent during the review without asking you, so that its questions can be improved. Picks are sent only when you select
Send answers on a page. Neither carries your name. Perillo's general privacy policy is at
[perillo.ai/privacy](https://perillo.ai/privacy).

## For developers

`observations/` holds what outside tools were seen to do, each with the small script that captured it
(`*.probe.mjs`). Those probes are for people working on this plugin. The plugin never runs them, and each says what it
runs: `plugin-hook-deny.probe.mjs` and `plugin-mcp-session-open.probe.mjs` each run one `claude -p` turn, which calls a
model; `transcript-rows.probe.mjs` reads the transcripts you name; `plugin-marketplace-and-manifest.probe.mjs` runs the
Codex CLI on scratch folders, with no model; `import-meta-dirname.probe.mjs` prints what Node gives.

```bash
node --test hooks/*.test.mjs page/*.test.mjs scripts/*.test.mjs
```

`AGENTS.md` gives the rules for changing the plugin.

## License

[Apache-2.0](LICENSE).
