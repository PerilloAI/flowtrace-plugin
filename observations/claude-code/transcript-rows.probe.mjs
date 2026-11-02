/* global console, process */
import { readFileSync } from "node:fs";

// Reads Claude app session transcripts (~/.claude/projects/<project>/<session>.jsonl, the file a hook's transcript_path
// names) and prints the first row of each kind hooks/explain-before-ask.mjs reads, trimmed to the keys it
// reads. What a person or a model wrote is <redacted>; ids are kept so a tool_result can be matched to its tool_use; replace them with placeholders before saving.
//   node observations/claude-code/transcript-rows.probe.mjs <transcript.jsonl>...
const rows = process.argv.slice(2)
  .flatMap((file) => readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line)));
const blocks = (row) => (Array.isArray(row.message?.content) ? row.message.content : []);
const trimBlock = (block) => {
  if (block.type === "tool_use") {
    const input = {};
    if ("action" in block.input) input.action = block.input.action;
    if ("ask" in block.input) input.ask = "<redacted>";
    if ("actions" in block.input) {
      input.actions = block.input.actions.map((button) => ("action" in button ? { action: button.action } : { label: "<redacted>" }));
    }
    return { type: block.type, id: block.id, name: block.name, input };
  }
  if (block.type === "tool_result") {
    const kept = { type: block.type, tool_use_id: block.tool_use_id };
    if ("is_error" in block) kept.is_error = block.is_error;
    return kept;
  }
  return { type: block.type };
};
const trim = (row, keep = () => true) => ({
  type: row.type,
  version: row.version,
  ...("origin" in row ? { origin: { kind: row.origin.kind } } : {}),
  message: {
    role: row.message.role,
    content: typeof row.message.content === "string" ? "<redacted>" : blocks(row).filter(keep).map(trimBlock),
  },
});
const first = (test) => rows.find(test);
const kinds = [];
const add = (kind, row, keep) => { if (row) kinds.push({ kind, row: trim(row, keep) }); };

add("a person's own message", first((row) => row.type === "user" && row.origin?.kind === "human"));
add("another session's or a subagent's report", first((row) => row.type === "user" && row.origin?.kind === "peer"));
add("a background task's notice", first((row) => row.type === "user" && row.origin?.kind === "task-notification"));
const isPublish = (block) => block.type === "tool_use" && block.name === "Artifact" && !("action" in block.input);
const publish = first((row) => row.type === "assistant" && blocks(row).some(isPublish));
add("an Artifact publish, its action left out", publish, isPublish);
const isNamedPublish = (block) => block.type === "tool_use" && block.name === "Artifact" && block.input.action === "publish";
add("an Artifact publish naming its action", first((row) => row.type === "assistant" && blocks(row).some(isNamedPublish)),
  isNamedPublish);
const publishId = publish && blocks(publish).find(isPublish).id;
add("the publish's result", first((row) => blocks(row).some((block) => block.tool_use_id === publishId)),
  (block) => block.tool_use_id === publishId);
const isOpen = (block) => block.type === "tool_use" && block.name === "Artifact" && block.input.action === "open";
add("an Artifact open", first((row) => row.type === "assistant" && blocks(row).some(isOpen)), isOpen);
const isFailed = (block) => block.type === "tool_result" && block.is_error === true;
add("a call that failed", first((row) => blocks(row).some(isFailed)), isFailed);
const isAsk = (block) => block.type === "tool_use" && block.name === "mcp__ccd_turn__wrap_up" && "ask" in block.input;
add("a next-step box with a question", first((row) => row.type === "assistant" && blocks(row).some(isAsk)), isAsk);
const replies = (block) => (block.input.actions ?? []).filter((button) => !("action" in button)).length;
const asks = (test) => (block) => isAsk(block) && test(block);
const kindsOfAsk = [
  ["a next-step box asking with two reply buttons", (block) => replies(block) >= 2],
  ["a next-step box asking with one reply button", (block) => replies(block) === 1 && block.input.actions.length === 1],
  ["a next-step box asking with an app action and one reply", (block) => replies(block) === 1 && block.input.actions.some((button) => "action" in button)],
];
for (const [kind, test] of kindsOfAsk) add(kind, first((row) => row.type === "assistant" && blocks(row).some(asks(test))), asks(test));

console.log(JSON.stringify(kinds, null, 2));
