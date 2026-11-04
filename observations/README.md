# Observations

What things outside this repository were seen to do, recorded once so tests rest on real behaviour instead of a guess
(`AGENTS.md`, "Tests rest on observed behaviour, never a guess").

These are for people working on the plugin. The plugin never runs anything in this folder.

## A record

One JSON file per behaviour, at `observations/<source>/<behaviour>.json`. `<source>` names the outside thing, such as
`claude-code`, `codex` or `node`.

```json
{
  "claim": "What was seen, in a sentence or two.",
  "source": "The thing and its version.",
  "observed": "2026-10-20",
  "how": "The command or steps that captured it, so anyone can run it again.",
  "recheckWhen": "The change that makes it stale.",
  "evidence": "What came back, as it came back: text, or the JSON returned."
}
```

- `evidence` is the capture itself, trimmed to what the claim needs but never reworded. A large capture goes in a file
  beside the record, `<behaviour>.evidence.<ext>`, named by `"evidenceFile"` in place of `"evidence"`.
- A capture that takes more than a command is a probe committed beside its record, `<behaviour>.probe.mjs`, which `how`
  names and which prints the record's evidence when run again.
- Remove secrets and anything personal before saving: keys, tokens, cookies, account ids, email addresses, home folders.
  Put `<redacted>` in their place. This repository is public.
- Capture from the thing itself: a real call, or a run of the real tool at the version in use.

## Using a record in a test

```js
import { observation } from "../observations/observation.mjs";

const rows = observation("claude-code/transcript-rows");
```

`observation()` refuses a record that lacks any field, so no test rests on a record without its provenance.

## When a record goes stale

When the thing in `recheckWhen` changes, run `how` again. If the answer is the same, update `observed`. If it differs,
replace `evidence`, then fix the code and the tests that read the record.

CI does this for one record. On every pull request, `node observations/browsers/closed-row.probe.mjs --check` runs
`page/page.js` in Chrome and fails when any answer differs from the record's, a missing or new one included, leaving out
the browser's name and version and the record's date. A change that means to alter an answer captures the record again in
the same pull request.
