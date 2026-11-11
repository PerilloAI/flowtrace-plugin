/* global process */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { observation } from "../observations/observation.mjs";
import { readJson } from "./json.mjs";
import { PageError } from "./read.mjs";
import { checkDeliverable, readDeliverable, renderDeliverable } from "./deliverable.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, "page.mjs");
const sample = () => JSON.parse(readFileSync(path.join(here, "fixtures/deliverable.json"), "utf8"));
// The data as a skill writes it, and the line each value starts on, to say where a failure should point.
const write = (data) => JSON.stringify(data, null, 2);
const lineIn = (data, at) => readJson(write(data)).lineOf(at);
const problems = (data) => {
  const { doc, lineOf } = readDeliverable(write(data));
  return checkDeliverable(doc, lineOf);
};
const draw = (data) => {
  const { doc, lineOf } = readDeliverable(write(data));
  assert.deepEqual(checkDeliverable(doc, lineOf), []);
  return renderDeliverable(doc, { name: "Test" }).html;
};
const words = (n) => Array.from({ length: n }, (_, k) => `word${k}`).join(" ");
const option = (name, more = {}) => ({ name, gives: ["something"], costs: ["something else"], ...more });

test("the sample plan draws, with its counts", (t) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "deliverable-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const out = path.join(dir, "page.html");
  const run = spawnSync(process.execPath, [script, "deliverable", path.join(here, "fixtures/deliverable.json"), "--out", out, "--whole"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), { page: out, deliverables: 2, questions: 2, edgeCases: 2 });
  const html = readFileSync(out, "utf8");
  assert.ok(html.startsWith("<!doctype html>"));
  assert.equal(html.match(/<article class="dtile">/g).length, 2);
  assert.equal(html.match(/<article class="card q">/g).length, 2);
  assert.equal(html.match(/<article class="card e">/g).length, 2);
  assert.deepEqual(html.match(/<article class="panel" data-card="(\w+)"/g).map((m) => m.match(/"(\w+)"$/)[1]), ["d1", "d2", "q1", "q2", "e1", "e2"]);
  assert.equal(html.match(/<article class="panel"[^>]* hidden>/g).length, 6);
  assert.match(html, /<section class="zoom" hidden>/);
});

test("a plan that breaks a rule writes nothing and names the line to fix", (t) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "deliverable-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const data = sample();
  data.questions[0].question = "Where do you hold it";
  const file = path.join(dir, "offsite.json");
  writeFileSync(file, write(data));
  const out = path.join(dir, "page.html");
  const run = spawnSync(process.execPath, [script, "deliverable", file, "--out", out], { encoding: "utf8", cwd: dir });
  assert.equal(run.status, 1);
  assert.equal(run.stdout, "");
  assert.equal(run.stderr.trim(), `✗ offsite.json line ${lineIn(data, ["questions", 0, "question"])}: a question ends with a question mark`);
  assert.equal(existsSync(out), false);
});

test("a key the format doesn't give is refused, with its line", () => {
  const data = sample();
  data.questions[0].owner = "Priya";
  assert.throws(() => readDeliverable(write(data)), (error) => {
    assert.ok(error instanceof PageError);
    assert.equal(error.message, `line ${lineIn(data, ["questions", 0, "owner"])}: "owner" is not a key here; questions.0 takes "question", "line", "picture", "options", "why", "more", "from"`);
    return true;
  });
});

// Each checked rule of deliverable.md, broken once on the sample: the one failure it gives, at the line it names.
const RULES = [
  ["no deliverable", (d) => { d.deliverables = []; }, ["deliverables"], "a plan names at least one deliverable: what the author will hold at the end"],
  ["seven deliverables", (d) => { d.deliverables = Array.from({ length: 7 }, (_, k) => ({ ...d.deliverables[0], name: `Agenda ${k}` })); }, ["deliverables", 6], "at most 6 deliverables: the map should fit a screen or two, so fold the rest into a deliverable or settle it in the chat"],
  ["eight questions", (d) => { d.questions = Array.from({ length: 8 }, () => d.questions[0]); }, ["questions", 7], "at most 7 questions: the map should fit a screen or two, so fold the rest into a deliverable or settle it in the chat"],
  ["six edge cases", (d) => { d.edgeCases = Array.from({ length: 6 }, () => d.edgeCases[0]); }, ["edgeCases", 5], "at most 5 edge cases: the map should fit a screen or two, so fold the rest into a deliverable or settle it in the chat"],
  ["a long title", (d) => { d.title = words(13); }, ["title"], 'the title has 13 words; keep it to 12, and put the rest in its "line"'],
  ["a long deliverable name", (d) => { d.deliverables[0].name = words(13); }, ["deliverables", 0, "name"], 'a deliverable\'s name has 13 words; keep it to 12, and put the rest in its "line"'],
  ["a long question", (d) => { d.questions[0].question = `${words(13)}?`; }, ["questions", 0, "question"], 'a question has 13 words; keep it to 12, and put the rest in its "line"'],
  ["a long edge case title", (d) => { d.edgeCases[0].title = words(13); }, ["edgeCases", 0, "title"], 'an edge case\'s title has 13 words; keep it to 12, and put the rest in its "line"'],
  ["a long line", (d) => { d.deliverables[1].line = words(31); }, ["deliverables", 1, "line"], '"line" has 31 words; keep it to 30, and put the rest in the card'],
  ["a long tldr", (d) => { d.tldr = words(61); }, ["tldr"], '"tldr" has 61 words; keep it to 60, read in ten seconds'],
  ["a question with no question mark", (d) => { d.questions[1].question = "How much of day two is planned"; }, ["questions", 1, "question"], "a question ends with a question mark"],
  ["one option", (d) => { d.questions[0].options = [option("Only this", { recommended: true })]; }, ["questions", 0, "options"], "a question has 2 to 4 options; it has 1"],
  ["five options", (d) => { d.questions[0].options = ["A", "B", "C", "D", "E"].map((n, k) => option(n, { recommended: k === 0 })); }, ["questions", 0, "options"], "a question has 2 to 4 options; it has 5"],
  ["no recommendation", (d) => { delete d.questions[0].options[0].recommended; }, ["questions", 0, "options"], 'exactly one option is "recommended": true; 0 are'],
  ["two recommendations", (d) => { d.questions[0].options[1].recommended = true; }, ["questions", 0, "options"], 'exactly one option is "recommended": true; 2 are'],
  ["two earlier choices", (d) => { d.questions[1].options[1].chosen = true; }, ["questions", 1, "options"], 'at most one option is "chosen": true, the one the author already picked'],
  ["two options of one name", (d) => { d.questions[0].options[1].name = d.questions[0].options[0].name; }, ["questions", 0, "options", 1, "name"], 'two options are named "A venue an hour away"'],
  ["an option that gives nothing", (d) => { d.questions[0].options[0].gives = []; }, ["questions", 0, "options", 0, "gives"], "an option says what it gives, at least one line"],
  ["an option that costs nothing", (d) => { d.questions[0].options[1].costs = []; }, ["questions", 0, "options", 1, "costs"], "an option says what it costs, at least one line: every choice costs something"],
  ["an empty picture", (d) => { d.deliverables[0].picture = ["  "]; }, ["deliverables", 0, "picture"], "a picture holds at least one line of HTML or SVG"],
  ["a picture that runs code", (d) => { d.deliverables[1].picture.push("<script>alert(1)</script>"); }, ["deliverables", 1, "picture", 6], "a picture holds no `<script>`: it runs code"],
  ["a fold whose picture runs code", (d) => { d.deliverables[1].more.picture = ['<p onclick="go()">Venue</p>']; }, ["deliverables", 1, "more", "picture", 0], "a picture holds no `onclick`: it runs code"],
  ["a question's picture that loads from elsewhere", (d) => { d.questions[0].picture = ['<svg><use href="#x"/></svg>']; }, ["questions", 0, "picture", 0], "a picture holds no `<use>`: it draws from elsewhere"],
];

test("the sample keeps every checked rule", () => {
  assert.deepEqual(problems(sample()), []);
});

for (const [name, breakIt, at, message] of RULES) {
  test(`a plan with ${name} fails with its line`, () => {
    const data = sample();
    breakIt(data);
    const found = problems(data);
    if (name === "a question's picture that loads from elsewhere") {
      assert.ok(found.includes(`line ${lineIn(data, at)}: ${message}`), found.join("\n"));
      return;
    }
    assert.deepEqual(found, [`line ${lineIn(data, at)}: ${message}`]);
  });
}

test("words from the plan are escaped, and no link sits inside a button", () => {
  const data = sample();
  data.title = 'An offsite <img src=x onerror="alert(1)">';
  data.questions[0].question = "Where do you hold [it](https://example.com)?";
  data.questions[0].options[0].name = "A [venue](https://example.com) away";
  data.questions[0].options[0].gives = ["Dinner [booked](javascript:void0) early"];
  data.edgeCases[0].title = 'The "travel" day slips';
  const html = draw(data);
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("An offsite &lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
  assert.ok(!html.includes("javascript:"));
  assert.ok(html.includes("<li>Dinner booked early</li>"));
  for (const button of html.match(/<button[^>]*>[\s\S]*?<\/button>/g)) assert.ok(!/<a[\s>]/.test(button), button);
  assert.ok(html.includes('<button class="open" data-open="q1">Where do you hold it?</button>'));
  assert.ok(html.includes('<span class="name">A venue away</span>'));
  assert.ok(html.includes('data-title="The &quot;travel&quot; day slips"'));
});

test("a question's status names the author's earlier choice, or else the recommendation", () => {
  const html = draw(sample());
  assert.equal(html.match(/<span class="st st-rec" data-status="q1">Recommended: A, A venue an hour away<\/span>/g).length, 2);
  assert.equal(html.match(/<span class="st st-you" data-status="q2">You chose A, Every hour set<\/span>/g).length, 2);
  assert.match(html, /<article class="panel" data-card="q1" data-n="1" data-rec="A" hidden>/);
  assert.match(html, /<article class="panel" data-card="q2" data-n="2" data-rec="B" data-chosen="A" hidden>/);
  assert.match(html, /data-k="A" aria-pressed="false"><span class="letter">A<\/span><span class="name">Every hour set<\/span><span class="badges"><span class="rec">You chose this<\/span><\/span>/);
  assert.match(html, /data-k="B" aria-pressed="false"><span class="letter">B<\/span><span class="name">Afternoon left open<\/span><span class="badges"><span class="rec">Recommended<\/span><\/span>/);
  assert.match(html, /<span class="pip st-rec" data-pip="q1"><\/span>/);
  assert.match(html, /<span class="pip st-you" data-pip="q2"><\/span>/);
});

test("an edge case says whether the plan covers it, and what's settled folds under the map", () => {
  const html = draw(sample());
  assert.match(html, /<article class="panel" data-card="e1"[^>]*>.*?<span class="st st-gap">Not covered yet<\/span>/s);
  assert.match(html, /<article class="panel" data-card="e2"[^>]*>.*?<span class="st st-plan">The plan covers it<\/span>/s);
  assert.match(html, /<summary>Already settled \(1\)<\/summary>/);
  const none = sample();
  delete none.settled;
  assert.ok(!draw(none).includes("Already settled"));
});

// What Chrome and WebKit did on the sample's page, wide with no sendPrompt and narrow with one
// (observations/browsers/deliverable-page).
const browsers = observation("browsers/deliverable-page").evidence;
const engine = (b) => (b.name.startsWith("WebKit") ? "WebKit" : "Chrome");

test("the record holds Chrome and WebKit, wide and copying, narrow and sending, and a phone's width", () => {
  assert.deepEqual(browsers.map((b) => [engine(b), b.width > 900, b.sends]), [["Chrome", true, false], ["Chrome", false, true], ["WebKit", true, false], ["WebKit", false, true]]);
  assert.ok(browsers.some((b) => b.width <= 480));
});

test("a card opens from its title, from anywhere on its card and from its tile's picture, alone, its heading focused", () => {
  for (const b of browsers) {
    assert.deepEqual(b.atLoad, { map: true, zoomHidden: true, panelsShown: 0, button: b.sends ? "Send answers" : "Copy answers", buttonDisabled: true, picks: "1 – · 2 –", fits: true }, b.name);
    assert.deepEqual(b.cardBodyHit, { isTitleButton: true }, b.name);
    assert.deepEqual(b.tileThumbHit, { isTitleButton: true }, b.name);
    assert.deepEqual(b.openQuestion, { mapHidden: true, zoom: true, panels: ["q1"], focus: "H2 Where do you hold it?", current: ["q1"], top: 0, fits: true }, b.name);
    assert.deepEqual(b.openFromStrip, { panels: ["e1"], fits: true }, b.name);
    assert.deepEqual(b.openDeliverable, { panels: ["d1"], fits: true }, b.name);
  }
});

test("Escape, Back to all cards and the page's name go back to the map, and Escape focuses the card that was open", () => {
  for (const b of browsers) {
    assert.deepEqual(b.escape, { map: true, zoomHidden: true, panels: 0, focus: "Three people can't travel" }, b.name);
    assert.deepEqual(b.backToMap, { map: true, zoomHidden: true }, b.name);
    assert.deepEqual(b.homeToMap, { map: true, zoomHidden: true }, b.name);
  }
});

test("a pick changes the card's status, the strip's dot and the answers bar, and a second click unpicks it", () => {
  for (const b of browsers) {
    assert.deepEqual(b.pick, { pressed: ["A false", "B true"], statuses: Array(2).fill("st st-you You picked B, The office, doors shut"), pip: "pip st-you", picks: "1 B · 2 –", buttonDisabled: false }, b.name);
    assert.deepEqual(b.pickAgain, { pressed: ["false", "false"], statuses: Array(2).fill("st st-rec Recommended: A, A venue an hour away"), picks: "1 – · 2 –", buttonDisabled: true }, b.name);
  }
});

test("Let's discuss shows on the edge case's map card and in the answers bar", () => {
  for (const b of browsers) assert.deepEqual(b.verdict, { pressed: ["ok false", "discuss true"], onMap: "You: let's discuss", picks: "1 A · 2 – · discuss 1" }, b.name);
});

test("an option's title starts on its letter's line", () => {
  for (const b of browsers) assert.deepEqual(b.optionTitles, [{ k: "A", onLettersLine: true }, { k: "B", onLettersLine: true }], b.name);
});

test("the answers line is sent where the page can send, and shown to paste where the clipboard refuses", () => {
  const line = "1 A. Let's discuss edge case 1 (Three people can't travel)";
  for (const b of browsers) {
    if (b.sends) assert.deepEqual(b.answer, { button: "Sent", sent: [line], fallbackShown: false, fallbackValue: "" }, b.name);
    else assert.deepEqual(b.answer, { button: "Copy answers", sent: null, fallbackShown: true, fallbackValue: line }, b.name);
  }
});
