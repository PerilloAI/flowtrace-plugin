/* global console, process */
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Copies this repository's marketplace and its two manifests into scratch folders, at their root, with one probe skill in
// place of the plugin's own, and runs the Codex CLI on them with a throwaway CODEX_HOME each, so the author's own
// ~/.codex is neither read nor written. Codex still reads $HOME/.agents (a personal marketplace and skills), which
// is why a `personal` marketplace can appear in the lists. No command here calls a model.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const scratch = realpathSync(mkdtempSync(path.join(os.tmpdir(), "codex-plugin-")));
const clean = (text) => text.replaceAll(scratch, "<scratch>").replaceAll(os.homedir(), "<home>");
const env = { ...process.env };
for (const name of ["OPENAI_API_KEY", "CODEX_API_KEY"]) delete env[name];

const fixture = (name, { manifests = [".claude-plugin", ".codex-plugin"], versions = {}, agentsMarketplace = false } = {}) => {
  const root = path.join(scratch, name);
  cpSync(path.join(repo, ".claude-plugin/marketplace.json"), path.join(root, ".claude-plugin/marketplace.json"));
  for (const folder of manifests) {
    const manifest = JSON.parse(readFileSync(path.join(repo, folder, "plugin.json"), "utf8"));
    if (versions[folder]) manifest.version = versions[folder];
    mkdirSync(path.join(root, folder), { recursive: true });
    writeFileSync(path.join(root, folder, "plugin.json"), JSON.stringify(manifest, null, 2));
  }
  mkdirSync(path.join(root, "skills/probe-skill"), { recursive: true });
  writeFileSync(path.join(root, "skills/probe-skill/SKILL.md"),
    "---\nname: probe-skill\ndescription: A probe skill used only to see where a harness puts a plugin skill.\n---\n\nSay \"probe\".\n");
  if (agentsMarketplace) {
    mkdirSync(path.join(root, ".agents/plugins"), { recursive: true });
    writeFileSync(path.join(root, ".agents/plugins/marketplace.json"), JSON.stringify({
      name: "flowtrace-agents", interface: { displayName: "Flowtrace (agents file)" },
      plugins: [{ name: "flowtrace", source: { source: "local", path: "./" }, policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" }, category: "Developer Tools" }],
    }, null, 2));
  }
  return root;
};
const codexHome = () => mkdtempSync(path.join(scratch, "codex-home-"));
const neutral = mkdtempSync(path.join(scratch, "cwd-"));
const codex = (home, ...args) => {
  const ran = spawnSync("codex", args, { cwd: neutral, encoding: "utf8", env: { ...env, CODEX_HOME: home } });
  return { command: clean(`codex ${args.join(" ")}`), exitCode: ran.status, stdout: clean(ran.stdout).trim(), stderr: clean(ran.stderr).trim() };
};
const available = (home) => JSON.parse(codex(home, "plugin", "list", "-m", "flowtrace", "--json", "--available").stdout)
  .available.map(({ pluginId, version, source, installPolicy, authPolicy }) => ({ pluginId, version, source, installPolicy, authPolicy }));
const pluginSkillLines = (home) => {
  const input = codex(home, "debug", "prompt-input", "hello").stdout;
  return [...input.matchAll(/- flowtrace:[^\\]*/g)].map((match) => match[0]);
};
const files = (dir, base = dir) => readdirSync(dir, { withFileTypes: true })
  .flatMap((entry) => (entry.isDirectory() ? files(path.join(dir, entry.name), base) : [path.relative(base, path.join(dir, entry.name))])).sort();

const evidence = [];

const committed = fixture("committed");
const home = codexHome();
evidence.push({ step: "this repository's .claude-plugin/marketplace.json and both manifests as committed; no .agents/plugins/marketplace.json",
  marketplaceAdd: codex(home, "plugin", "marketplace", "add", committed), list: codex(home, "plugin", "list", "-m", "flowtrace"), available: available(home) });
evidence.push({ step: "install", pluginAdd: codex(home, "plugin", "add", "flowtrace@flowtrace"),
  configToml: clean(readFileSync(path.join(home, "config.toml"), "utf8")), installedFiles: files(path.join(home, "plugins/cache")),
  modelVisibleSkills: pluginSkillLines(home) });

const skill = path.join(committed, "skills/probe-skill/SKILL.md");
writeFileSync(skill, readFileSync(skill, "utf8").replace("A probe skill", "An EDITED probe skill"));
evidence.push({ step: "the source skill's description edited, before anything else is run", modelVisibleSkills: pluginSkillLines(home) });
evidence.push({ step: "after running codex plugin add flowtrace@flowtrace again", pluginAdd: codex(home, "plugin", "add", "flowtrace@flowtrace"), modelVisibleSkills: pluginSkillLines(home) });

for (const [name, options] of [
  ["claude-manifest-only", { manifests: [".claude-plugin"], versions: { ".claude-plugin": "2.0.0-claude" } }],
  ["both-manifests", { versions: { ".claude-plugin": "2.0.0-claude", ".codex-plugin": "3.0.0-codex" } }],
]) {
  const other = codexHome();
  codex(other, "plugin", "marketplace", "add", fixture(name, options));
  evidence.push({ step: `${name}: ${JSON.stringify(options)}`, available: available(other), pluginAdd: codex(other, "plugin", "add", "flowtrace@flowtrace").stdout });
}

const both = codexHome();
evidence.push({ step: "both marketplace files: this repository's .claude-plugin/marketplace.json (name flowtrace) and an .agents/plugins/marketplace.json named flowtrace-agents",
  marketplaceAdd: codex(both, "plugin", "marketplace", "add", fixture("both-marketplaces", { agentsMarketplace: true })) });

console.log(JSON.stringify(evidence, null, 2));
