import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set([".git", "docs"]);
const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  if (SKIP.has(entry.name)) return [];
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? files(full) : [full];
});

test("the plugin's one MCP server is Perillo's production address", () => {
  const { mcpServers } = JSON.parse(readFileSync(path.join(root, ".mcp.json"), "utf8"));
  assert.deepEqual(mcpServers, { perillo: { type: "http", url: "https://app.perillo.ai/mcp" } });
});

test("no file names a temporary tunnel's address", () => {
  const named = files(root).filter((file) => /ngrok(-free)?\.(app|dev|io)/.test(readFileSync(file, "latin1")));
  assert.deepEqual(named.map((file) => path.relative(root, file)), []);
});

test("the two manifests name the same version, repository and license", () => {
  const manifest = (folder) => JSON.parse(readFileSync(path.join(root, folder, "plugin.json"), "utf8"));
  const facts = ({ version, repository, license }) => ({ version, repository, license });
  assert.deepEqual(facts(manifest(".claude-plugin")), facts(manifest(".codex-plugin")));
});

// plan-deliverable writes for someone who knows their field, not a newcomer to code, so it reads only teaching.md's Show
// the page.
const OWN_READER = ["plan-deliverable"];

test("every skill but plan-deliverable reads the shared teaching file, and each shared rule is written only there", () => {
  const skills = readdirSync(path.join(root, "skills"), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  assert.ok(skills.length >= 5);
  for (const skill of skills) {
    const text = readFileSync(path.join(root, "skills", skill, "SKILL.md"), "utf8");
    if (OWN_READER.includes(skill)) assert.match(text, /\[teaching\.md\]\(\.\.\/teaching\.md\)'s\s+Show\s+the\s+page/, skill);
    else assert.match(text, /Read\s+\[teaching\.md\]\(\.\.\/teaching\.md\)\s+in\s+full\s+before\s+step\s+1/, skill);
  }
  const shared = ["the way this harness starts one", "with the Artifact tool, the same path", "| 64 or more | 8 |", "You have never seen this project or this conversation"];
  const markdown = files(path.join(root, "skills")).filter((file) => file.endsWith(".md") && !file.endsWith("teaching.md"));
  for (const words of shared) {
    assert.ok(readFileSync(path.join(root, "skills/teaching.md"), "utf8").includes(words), words);
    assert.deepEqual(markdown.filter((file) => readFileSync(file, "utf8").includes(words)).map((file) => path.relative(root, file)), [], words);
  }
});

test("in a recorded Claude Code run, each skill's first call reads the shared teaching file", () => {
  const record = JSON.parse(readFileSync(path.join(root, "observations/claude-code/skill-reads-teaching.json"), "utf8"));
  const skills = readdirSync(path.join(root, "skills"), { withFileTypes: true }).filter((d) => d.isDirectory() && !OWN_READER.includes(d.name)).map((d) => d.name).sort();
  assert.deepEqual(record.evidence.map((run) => run.skill).sort(), skills);
  for (const run of record.evidence) assert.deepEqual(run.toolCalls[0], { tool: "Read", file: "<plugin>/skills/teaching.md", refused: false }, run.skill);
});
