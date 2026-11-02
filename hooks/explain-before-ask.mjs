/* global console, process */
// A PreToolUse hook on mcp__ccd_turn__wrap_up, the next-step box the Claude app shows at the end of a turn.
//
// explain asks every choice between ways of doing something on a page (its step 1). So a question with two or more
// reply buttons is refused until a page has been published, or opened again, since the person's last message. Any
// page counts: the hook can't tell what a page is about. A go-ahead passes: a question whose buttons are the app's own
// actions (commit, open a pull request) and at most one reply. So does a wrap-up with no question, which is only a
// recap. AskUserQuestion is left alone: skills ask with it one question after another, and each answer would call for
// a new page. If this script fails, Claude Code lets the question through.
import { readFileSync } from "node:fs";

const REASON =
  "A choice between ways waits for its page. Draw it with the explain skill (flowtrace:explain), publish the page " +
  "with the Artifact tool, then ask again. For a page drawn before their last message, open it again (the Artifact " +
  "tool's open action). A go-ahead, a yes on a step the person already knows, passes with one reply button. A step " +
  "only they can take, such as restarting Claude in a terminal tab, is no decision: say it in your message.";

const event = JSON.parse(readFileSync(0, "utf8"));
const { ask, actions = [] } = event.tool_input ?? {};
if (!ask || actions.filter((button) => !button.action).length <= 1) process.exit(0);

let pages = new Set(); // Artifact publishes and opens since the person's last message, by tool_use id
let shown = false;
for (const line of readFileSync(event.transcript_path, "utf8").split("\n")) {
  if (!line) continue;
  const row = JSON.parse(line);
  if (row.type === "user" && row.origin?.kind === "human") {
    pages = new Set();
    shown = false;
  }
  const content = row.message?.content;
  if (!Array.isArray(content)) continue;
  for (const block of content) {
    if (block?.type === "tool_use" && block.name === "Artifact") {
      if (["publish", "open"].includes(block.input?.action ?? "publish")) pages.add(block.id);
    } else if (block?.type === "tool_result" && pages.has(block.tool_use_id) && !block.is_error) {
      shown = true;
    }
  }
}

if (!shown) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: REASON },
    }),
  );
}
