#!/usr/bin/env node
/* global console, process */
// Checks a page's data file and draws its page. The data is the only thing a skill writes; this draws the rest.
//
//   node page.mjs plan <docs/plans/change.json> [--out <page.html>] [--since <copy.json>] [--whole] [--name "<words>"]
//   node page.mjs explain <explanation.json> [--out <page.html>] [--whole] [--name "<words>"]
//   node page.mjs fingerprint <docs/plans/change.json>
//   node page.mjs seen <docs/plans/change.json>
//   node page.mjs now
//
// The data is JSON, as blocks.md gives it. A plan is checked by every rule plan-format.md marks checked, its cases' existing steps' names looked up at the merge base
// with the default branch. On any failure it prints each, naming its line, and exits 1 with nothing written. Otherwise
// it writes the page (an HTML fragment, or with --whole a whole document) and prints one line of JSON: the page's
// path, the fingerprint, and the counts: its cases, its questions, the minutes the whole page and the gist alone take to
// read, and its steps. `seen` keeps a copy of the file as the author has read it, and every drawing after
// outlines what differs from that copy (--since names another copy).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { formatJson } from "./json.mjs";
import { PageError, readDocument } from "./read.mjs";
import { blocks, cases, chartBoxes, check, minutes, reading, targets } from "./check.mjs";
import { esc, inline, render } from "./render.mjs";

const [command, file, ...rest] = process.argv.slice(2);

// This moment as a plan writes it, in "at" and "approved": the local date and time with its offset from UTC.
if (command === "now") {
  const d = new Date();
  const two = (n) => String(Math.abs(n)).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  console.log(`${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}T${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}${off < 0 ? "-" : "+"}${two(Math.trunc(off / 60))}:${two(off % 60)}`);
  process.exit(0);
}
const flag = (name) => {
  const k = rest.indexOf(name);
  return k < 0 ? null : rest[k + 1];
};
if (!["plan", "explain", "fingerprint", "seen"].includes(command) || !file) {
  console.error("usage: page.mjs plan|explain|fingerprint|seen <file.json> [--out <page.html>] [--since <copy.json>] [--whole] [--name <words>], or page.mjs now");
  process.exit(2);
}

const source = realpathSync(path.resolve(file));
const text = readFileSync(source, "utf8");
const git = (dir, ...args) => execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"], maxBuffer: 1 << 28 });
const tried = (dir, ...args) => {
  try {
    return git(dir, ...args).trim();
  } catch {
    return null;
  }
};

const fail = (errors) => {
  console.error(errors.map((e) => `✗ ${path.relative(process.cwd(), source)} ${e}`).join("\n"));
  process.exit(1);
};
// Where a page goes: one folder for each data file, kept between drawings.
const home = path.join(os.tmpdir(), "flowtrace-pages", `${path.basename(source, ".json")}-${createHash("sha1").update(source).digest("hex").slice(0, 6)}`);

let doc;
let data;
try {
  ({ doc, value: data } = readDocument(text));
} catch (error) {
  if (error instanceof PageError) fail([error.message]);
  throw error;
}

// The fingerprint: the plan's data without "approved", "reviewPage", "build" and "told", one item a line, hashed as git
// hashes a file. So it names the plan's words, whatever their spacing, and writing the build's progress or the author's
// account of it changes nothing approved.
const fingerprint = () => {
  const kept = formatJson({ ...data, approved: undefined, reviewPage: undefined, build: undefined, told: undefined });
  return execFileSync("git", ["hash-object", "--stdin"], { input: kept, encoding: "utf8" }).trim().slice(0, 7);
};
if (command === "fingerprint") {
  console.log(fingerprint());
  process.exit(0);
}

// The copy of the data as the author last read it.
const copy = path.join(home, "last.json");
if (command === "seen") {
  mkdirSync(home, { recursive: true });
  copyFileSync(source, copy);
  console.log(JSON.stringify({ seen: copy }));
  process.exit(0);
}

const plan = command === "plan";
let eyebrow = doc.about ? inline(doc.about) : "";
let nameFound = () => true;
let codeFound = () => true;
let fp = null;
if (plan) {
  const root = tried(path.dirname(source), "rev-parse", "--show-toplevel");
  if (!root) fail(["line 1: a plan is drawn inside its repository"]);
  const branch = ["origin/HEAD", "origin/main", "origin/master"].find((r) => tried(root, "rev-parse", "--verify", "-q", r) !== null);
  const base = (branch && tried(root, "merge-base", "HEAD", branch)) ?? tried(root, "rev-parse", "HEAD");
  const shown = branch === "origin/HEAD" ? tried(root, "rev-parse", "--abbrev-ref", "origin/HEAD") : branch;
  const label = (shown ?? "HEAD").replace(/^origin\//, "");
  const rel = path.relative(root, source);
  eyebrow = `Plan · <code>${esc(rel)}</code> · marks compare with <code>${esc(label)}</code> at <code>${base ? base.slice(0, 7) : "no commit"}</code>`;

  // Every step's "where" in the cases (each in the plan step that makes it come true), looked up in two git calls: the files at the merge base, and one grep for the names.
  const wheres = cases(doc).flatMap((c) => chartBoxes(c.chart)).map((b) => b.where).filter(Boolean);
  const isFile = (w) => w.includes("/") || /\.(c|cc|cjs|cpp|cs|csproj|css|go|h|html|java|js|json|jsx|kt|md|mjs|php|py|rb|rs|scss|sh|sql|swift|tf|toml|ts|tsx|txt|vue|xml|ya?ml)$/i.test(w);
  const files = new Set(base ? git(root, "ls-tree", "-r", "--name-only", base).split("\n").filter((f) => f && !f.startsWith("docs/plans/")) : []);
  const words = [...new Set(wheres.filter((w) => !isFile(w)).map((w) => w.split(".").pop()))];
  const found = new Set();
  if (base && words.length) {
    const out = tried(root, "grep", "-o", "-h", "-w", "-F", ...words.flatMap((w) => ["-e", w]), base, "--", ".", ":(exclude)docs/plans") ?? "";
    for (const line of out.split("\n")) found.add(line.slice(line.lastIndexOf(":") + 1));
  }
  nameFound = (w) => (isFile(w) ? files.has(w) : found.has(w.split(".").pop()));
  // Where a built step's code is, looked up in the repository as it stands now: the file, then the name inside it.
  codeFound = (where, name) => {
    const file = path.resolve(root, where);
    const rel = path.relative(root, file);
    if (rel.startsWith("..") || path.isAbsolute(rel) || rel.startsWith(`docs${path.sep}plans${path.sep}`) || !existsSync(file) || !statSync(file).isFile()) return "file";
    if (name) {
      const word = name.split(".").pop();
      const text = readFileSync(file, "utf8");
      const inWord = /[\p{L}\p{N}_$]/u;
      let at = text.indexOf(word);
      while (at >= 0 && (inWord.test(text[at - 1] ?? "") || inWord.test(text[at + word.length] ?? ""))) at = text.indexOf(word, at + 1);
      if (at < 0) return "name";
    }
    return true;
  };
  fp = fingerprint();
}

const errors = check(doc, { plan, nameFound, codeFound });
if (errors.length) fail(errors);

mkdirSync(home, { recursive: true });
const out = path.resolve(flag("--out") ?? path.join(home, "page.html"));
const sincePath = flag("--since") ?? (existsSync(copy) ? copy : null);
let previous = null;
if (sincePath) {
  try {
    const { doc: before } = readDocument(readFileSync(sincePath, "utf8"));
    previous = render(before, { plan, eyebrow: "", name: "", targets: targets(before), fingerprint: "" }).keys;
  } catch {
    previous = null;
  }
}

const approvedNow = Boolean(fp && doc.approved && doc.approved.split(" · ")[2] === fp);
const words = plan ? path.basename(source, ".json").split(/[-_]+/).filter(Boolean) : doc.title.replace(/[^\p{L}\p{N}' ]+/gu, " ").split(/\s+/).filter(Boolean);
const name = flag("--name") ?? words.slice(0, 4).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const page = render(doc, { plan, eyebrow, name, fingerprint: fp, approvedNow, previous, targets: targets(doc), whole: rest.includes("--whole") });
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, page.html);
console.log(JSON.stringify({
  page: out,
  ...(plan ? { fingerprint: fp, approved: approvedNow, cases: cases(doc).length, questions: blocks(doc, "choice").length, minutes: minutes(reading(doc).total), gist: minutes(reading(doc).gist), steps: blocks(doc, "step").length } : {}),
  outlined: page.outlined,
}));
