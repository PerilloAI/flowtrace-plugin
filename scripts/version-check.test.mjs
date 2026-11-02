import { test } from "node:test";
import assert from "node:assert/strict";
import { versionProblems } from "./version-check.mjs";

const pullRequest = (over) => ({ claude: "0.6.1", codex: "0.6.1", base: "0.6.0", changed: ["skills/explain/SKILL.md"], ...over });

test("a change with both manifests raised passes", () => {
  assert.deepEqual(versionProblems(pullRequest({})), []);
});

test("manifests that disagree fail, whatever changed", () => {
  assert.match(versionProblems(pullRequest({ codex: "0.6.2" }))[0], /must agree/);
  assert.match(versionProblems(pullRequest({ codex: "0.6.2", changed: [".github/workflows/ci.yml"] }))[0], /must agree/);
});

test("a change that leaves the version where it is, or lowers it, fails", () => {
  assert.match(versionProblems(pullRequest({ claude: "0.6.0", codex: "0.6.0" }))[0], /raise it/);
  assert.match(versionProblems(pullRequest({ claude: "0.5.9", codex: "0.5.9" }))[0], /raise it/);
});

test("versions compare as numbers, not as text", () => {
  assert.deepEqual(versionProblems(pullRequest({ claude: "0.10.0", codex: "0.10.0", base: "0.9.0" })), []);
});

test("a change only under .github/ needs no new version", () => {
  assert.deepEqual(versionProblems(pullRequest({ claude: "0.6.0", codex: "0.6.0", changed: [".github/workflows/ci.yml"] })), []);
});

test("the first release has no version to be above", () => {
  assert.deepEqual(versionProblems(pullRequest({ claude: "0.6.0", codex: "0.6.0", base: null })), []);
});
