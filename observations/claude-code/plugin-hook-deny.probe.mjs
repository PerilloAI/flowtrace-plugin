/* global console, process */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// Builds a throwaway plugin whose only part is a PreToolUse hook on Bash, written the way hooks/hooks.json
// writes its own (exec form, ${CLAUDE_PLUGIN_ROOT} in args). The hook saves the keys of the event it reads on stdin and
// refuses the call. Then it runs one `claude -p` turn with the plugin loaded by --plugin-dir, asking Claude to run a
// shell command, and prints what the hook saw and what Claude answered. The turn calls a model, so Claude Code must be
// signed in; the person's own configuration is used as it is.
const scratch = realpathSync(mkdtempSync(path.join(os.tmpdir(), "claude-plugin-hook-")));
const plugin = path.join(scratch, "plugin");
mkdirSync(path.join(plugin, ".claude-plugin"), { recursive: true });
mkdirSync(path.join(plugin, "hooks"));
writeFileSync(path.join(plugin, ".claude-plugin/plugin.json"), JSON.stringify({ name: "hook-probe", version: "0.0.0" }));
const hooks = {
  hooks: {
    PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "node", args: ["${CLAUDE_PLUGIN_ROOT}/hooks/deny.mjs"], timeout: 10 }] }],
  },
};
writeFileSync(path.join(plugin, "hooks/hooks.json"), JSON.stringify(hooks, null, 2));
const reason = "Refused by hook-probe: draw the page first, then ask again.";
const deny = { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } };
writeFileSync(path.join(plugin, "hooks/deny.mjs"), [
  'import { appendFileSync, readFileSync } from "node:fs";',
  'const event = JSON.parse(readFileSync(0, "utf8"));',
  'appendFileSync(new URL("./seen.jsonl", import.meta.url), JSON.stringify({ tool_name: event.tool_name, keys: Object.keys(event) }) + "\\n");',
  `console.log(${JSON.stringify(JSON.stringify(deny))});`,
].join("\n"));

const prompt = "Run the shell command `echo hi` with the Bash tool. If it is refused, reply with REFUSED: and the reason you were given, word for word.";
const ran = spawnSync("claude", ["-p", "--plugin-dir", plugin, "--model", "haiku", "--output-format", "json", "--max-turns", "3"], {
  cwd: scratch, input: prompt, encoding: "utf8",
});
if (ran.status !== 0) {
  console.error(ran.stdout, ran.stderr);
  process.exit(1);
}
const events = JSON.parse(ran.stdout);
const result = events.find((event) => event.type === "result");
const refused = events.flatMap((event) => (event.type === "user" ? event.message.content : []))
  .filter((block) => block.type === "tool_result");
const seen = readFileSync(path.join(plugin, "hooks/seen.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
console.log(JSON.stringify({
  "hooks/hooks.json": hooks,
  "the hook's output": deny,
  prompt,
  "what the hook read on stdin": seen,
  "the refused call's tool_result": refused.map(({ type, content, is_error }) => ({ type, content, is_error })),
  "Claude's reply": result.result,
  "permission_denials": result.permission_denials.map(({ tool_name, tool_input }) => ({ tool_name, tool_input })),
}, null, 2));
