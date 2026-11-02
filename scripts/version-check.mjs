/* global console, process */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Compares two versions of the form 1.2.3, a suffix after a hyphen or plus left out: below 0 when a is lower.
const compare = (a, b) => {
  const parts = (v) => v.split(/[-+]/)[0].split(".").map(Number);
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const diff = (x[i] ?? 0) - (y[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
};

// What is wrong with a pull request's versions: both manifests must agree, and a change outside .github/ must raise
// them above the default branch's, since installed copies compare versions. `base` is null before the first release.
export function versionProblems({ claude, codex, base, changed }) {
  if (claude !== codex) return [`.claude-plugin/plugin.json says ${claude} and .codex-plugin/plugin.json says ${codex}: they must agree.`];
  if (base === null || changed.every((file) => file.startsWith(".github/"))) return [];
  if (compare(claude, base) > 0) return [];
  return [`The version is ${claude}, and the default branch is at ${base}: raise it in both manifests, or people keep the copy they have.`];
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
const version = (text) => JSON.parse(text).version;

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const baseRef = process.argv[2];
  if (!baseRef) throw new Error("usage: node scripts/version-check.mjs <default branch's ref>");
  const baseManifest = (() => {
    try {
      return git("show", `${baseRef}:.claude-plugin/plugin.json`);
    } catch {
      return null;
    }
  })();
  const problems = versionProblems({
    claude: version(readFileSync(".claude-plugin/plugin.json", "utf8")),
    codex: version(readFileSync(".codex-plugin/plugin.json", "utf8")),
    base: baseManifest === null ? null : version(baseManifest),
    changed: git("diff", "--name-only", `${baseRef}...HEAD`).split("\n").filter(Boolean)
  });
  for (const problem of problems) console.error(problem);
  process.exit(problems.length === 0 ? 0 : 1);
}
