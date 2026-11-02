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
