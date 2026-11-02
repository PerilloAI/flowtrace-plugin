import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { observation } from "../observations/observation.mjs";

const hook = path.join(path.dirname(fileURLToPath(import.meta.url)), "explain-before-ask.mjs");
const seen = observation("claude-code/plugin-hook-deny").evidence;
const rows = Object.fromEntries(observation("claude-code/transcript-rows").evidence.map(({ kind, row }) => [kind, row]));

const person = rows["a person's own message"];
const peer = rows["another session's or a subagent's report"];
const notice = rows["a background task's notice"];
const publish = rows["an Artifact publish, its action left out"];
const namedPublish = rows["an Artifact publish naming its action"];
const open = rows["an Artifact open"];
const succeeded = rows["the publish's result"];
const failed = rows["a call that failed"];
const ask = rows["a next-step box with a question"];
const inputOf = (kind) => rows[kind].message.content[0].input;
const choice = inputOf("a next-step box asking with two reply buttons");
const oneReply = inputOf("a next-step box asking with one reply button");
const appAction = inputOf("a next-step box asking with an app action and one reply");

const callId = (row) => row.message.content[0].id;
const resultOf = (call, result) => ({
  ...result,
  message: { ...result.message, content: [{ ...result.message.content[0], tool_use_id: callId(call) }] },
});

// Runs the hook on a wrap-up whose transcript holds these rows, with the event keys Claude Code was seen to send.
function run(transcript, toolInput) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "explain-before-ask-"));
  const file = path.join(dir, "transcript.jsonl");
  writeFileSync(file, transcript.map((row) => JSON.stringify(row)).join("\n") + "\n");
  const event = Object.fromEntries(seen["what the hook read on stdin"][0].keys.map((key) => [key, `<${key}>`]));
  Object.assign(event, { transcript_path: file, hook_event_name: "PreToolUse", tool_name: ask.message.content[0].name, tool_input: toolInput });
  const ran = spawnSync("node", [hook], { input: JSON.stringify(event), encoding: "utf8" });
  assert.equal(ran.status, 0, ran.stderr);
  return ran.stdout.trim() === "" ? "passes" : JSON.parse(ran.stdout);
}


function assertRefused(answer) {
  const { hookEventName, permissionDecision } = seen["the hook's output"].hookSpecificOutput;
  assert.deepEqual(Object.keys(answer.hookSpecificOutput), Object.keys(seen["the hook's output"].hookSpecificOutput));
  assert.equal(answer.hookSpecificOutput.hookEventName, hookEventName);
  assert.equal(answer.hookSpecificOutput.permissionDecision, permissionDecision);
  assert.match(answer.hookSpecificOutput.permissionDecisionReason, /explain/);
}

test("a wrap-up with no question passes with no page", () => {
  assert.equal(run([person], { recap: "Recap." }), "passes");
});

test("a choice between ways, with no page since the person's message, is refused", () => {
  assertRefused(run([person], choice));
});

test("a go-ahead passes with no page: one reply button, or the app's own action and one reply", () => {
  assert.equal(run([person], oneReply), "passes");
  assert.equal(run([person], appAction), "passes");
});

test("a choice passes after a page is published, with or without the publish action named", () => {
  assert.equal(run([person, publish, succeeded], choice), "passes");
  assert.equal(run([person, namedPublish, resultOf(namedPublish, succeeded)], choice), "passes");
});

test("a choice passes after a page drawn earlier is opened again", () => {
  assert.equal(run([person, open, resultOf(open, succeeded)], choice), "passes");
});

test("a publish that failed or was refused shows no page", () => {
  assertRefused(run([person, publish, resultOf(publish, failed)], choice));
});

test("a page published before the person's last message no longer counts", () => {
  assertRefused(run([person, publish, succeeded, person], choice));
});

test("a session's report or a task's notice is not the person's message, so the page still counts", () => {
  assert.equal(run([person, publish, succeeded, peer, notice], choice), "passes");
});
