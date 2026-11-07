/* global console, process */
// Runs each of the plugin's four skills once in `claude -p`, with this repository loaded by --plugin-dir, in a throwaway
// repository holding one small file and one plan, and prints which files Claude read, in order, before its turns ran
// out. `--tools` leaves Claude only Read, Glob and Grep, and anything that would ask permission is refused, so nothing is
// written, run or published (`--allowedTools` alone only approves tools ahead and leaves the others in reach). Each turn
// calls a model, so Claude Code must be signed in.
//   node observations/claude-code/skill-reads-teaching.probe.mjs
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const scratch = realpathSync(mkdtempSync(path.join(os.tmpdir(), "skill-reads-teaching-")));
const git = (...args) => execFileSync("git", ["-C", scratch, ...args], { encoding: "utf8" });
git("init", "-q", "-b", "main");
git("config", "user.email", "probe@example.com");
git("config", "user.name", "Probe");
writeFileSync(path.join(scratch, "orders.ts"), "export function exportOrder(id: number) {\n  return fetch(`/warehouse/${id}`);\n}\n");
mkdirSync(path.join(scratch, "docs/plans"), { recursive: true });
writeFileSync(path.join(scratch, "docs/plans/retry.json"), JSON.stringify({ title: "Retry an export that times out", sections: [] }));
git("add", ".");
git("commit", "-q", "-m", "orders");

const prompts = {
  explain: "/flowtrace:explain how does exportOrder in orders.ts reach the warehouse?",
  "plan-flows": "/flowtrace:plan-flows retry exportOrder in orders.ts once when the warehouse times out",
  "plan-check": "/flowtrace:plan-check docs/plans/retry.json",
  "pr-review": "/flowtrace:pr-review https://github.com/PerilloAI/flowtrace-plugin/pull/10",
};
const seen = [];
for (const [skill, prompt] of Object.entries(prompts)) {
  const ran = spawnSync("claude", ["-p", "--plugin-dir", plugin, "--model", "sonnet", "--output-format", "stream-json", "--verbose", "--max-turns", "4", "--tools", "Read,Glob,Grep", "--permission-mode", "default", "--permission-prompts", "none"], {
    cwd: scratch, input: prompt, encoding: "utf8", maxBuffer: 1 << 26,
  });
  const events = ran.stdout.split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const results = new Map(events.filter((e) => e.type === "user").flatMap((e) => (Array.isArray(e.message.content) ? e.message.content : []))
    .filter((c) => c.type === "tool_result").map((c) => [c.tool_use_id, Boolean(c.is_error)]));
  const reads = events.filter((e) => e.type === "assistant").flatMap((e) => e.message.content).filter((c) => c.type === "tool_use")
    .map((c) => ({ tool: c.name, file: (c.input.file_path ?? c.input.path ?? c.input.pattern ?? "").replace(plugin, "<plugin>").replace(scratch, "<scratch>"), refused: results.get(c.id) ?? null }));
  const init = events.find((e) => e.type === "system" && e.subtype === "init");
  seen.push({ skill, prompt, model: init?.model ?? null, claudeCode: init?.claude_code_version ?? null, toolCalls: reads });
}
console.log(JSON.stringify(seen, null, 2));
if (!seen.every((s) => s.toolCalls.length)) process.exitCode = 1;
