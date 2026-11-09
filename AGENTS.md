# Project instructions

This repository is the Flowtrace plugin, at its root, for Claude Code and Codex. `README.md` says what each skill does and
everything the plugin runs, reads and sends: when a change alters any of that, change the README with it. The directory's
review reads it against the code.

Check with `node --test hooks/*.test.mjs page/*.test.mjs scripts/*.test.mjs` and
`claude plugin validate . --strict --profile directory`. On a Mac with Chrome,
`node observations/browsers/closed-row.probe.mjs --check` runs the page's script and compares what it does with the record.
There is no `package.json` and nothing to install.

## Each release raises the version

Raise `version` in `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` together, in every pull request that
changes anything outside `.github/`. Installed copies compare versions, so an unchanged one keeps people on the copy they
have. CI fails a pull request that doesn't.

## Every prompt is for any codebase

The skills explain codebases they have never seen: any repository, framework, language or shape (web servers, libraries,
CLIs, workers, frontends, tool servers, pipelines). Prompts name no repository, product, framework or domain from a test
repository, and their examples span kinds of code base ("routes, pages, CLI commands, jobs, tool handlers, a library's
public functions"), never only servers.

## Tests rest on observed behaviour, never a guess

A test that depends on how something outside this repository behaves (Claude Code, Codex, Node, a forge) reads what that
thing was seen to do from a record in `observations/`. It never restates a shape from memory. `observations/README.md`
says how to capture one.

- Before writing such a test, look in `observations/`. If no record has the behaviour, make the smallest real call that
  shows it and record what came back.
- The test loads the record instead of copying it, so the two cannot drift apart.
- A record is captured again when its source changes. When the new capture differs, fix the code and the tests together.
- Behaviour that cannot be observed is not claimed.

## No backward compatibility

Add no compatibility shims, legacy aliases, dual configuration paths, or fallbacks to deprecated behaviour. Update
callers, tests and documentation together, and remove what a change replaces.

## This repository is public

No commit names a person's folder, a customer, a key or a token, and nothing here comes from Perillo's server code.
Plans go in `docs/plans`, which git ignores, so they never install. A plan that spans the server too stays in the server's
repository.
