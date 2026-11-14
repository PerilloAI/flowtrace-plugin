/* global process */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { observation } from "../observations/observation.mjs";
import { formatJson, readJson } from "./json.mjs";
import { readDocument } from "./read.mjs";
import { inline } from "./render.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, "page.mjs");

// A reading question's options, each charted on from the question's case to what the person gets, and a case to ask
// from, with the example drawn on its first step.
const opts = (...texts) => texts.map((text) => ({ text, steps: [{ text, kind: "start" }] }));
// with the example drawn on its first step: a picture drawn once at the top of the page's data and shown by name.
const order1042 = { html: ["<table>", "<tr><th>Order</th><td>1042</td><td>ready</td></tr>", "</table>"] };
const shown = { use: "order 1042" };
const asked = [{ text: "Ana exports order 1042", kind: "start", shows: shown }, { text: "What happens next?", kind: "question" }];

// A repository with one commit holding orders.ts, and a plan that changes exportOrder in it.
function repo() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "page-test-"));
  const git = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  writeFileSync(path.join(dir, "orders.ts"), "export function exportOrder() {}\nexport function loadOrder() {}\n");
  git("add", ".");
  git("commit", "-q", "-m", "orders");
  mkdirSync(path.join(dir, "docs/plans"), { recursive: true });
  return dir;
}

const plan = () => ({
  title: "Retry an export that times out",
  pictures: { "order 1042": order1042 },
  sections: [
    { heading: "What I'm asking", content: [{ p: "Approve the retry. No questions are open." }] },
    {
      heading: "What changes, case by case",
      content: [{
        case: {
          title: "The warehouse times out once",
          gets: "Ana gets her file after one retry",
          today: [{ text: "Ana exports order 1042", kind: "start", where: "exportOrder", shows: shown }, { text: "Load the order", where: "loadOrder" }, { text: '"Export failed"', result: "bad" }],
          after: [
            { text: "Ana exports order 1042", kind: "start", where: "exportOrder" },
            { text: "Did the warehouse time out?", kind: "question", mark: "+", answers: [{ label: "yes", steps: [{ text: "Wait 30 seconds and try once more", mark: "+" }] }] },
            { text: "Ana gets the file", result: "ok" },
          ],
        },
      }],
    },
    {
      heading: "Check your reading",
      content: [
        { question: { question: "Ana's export times out twice. What does she see?", steps: asked, options: opts("The file", '"Export failed"', "Nothing"), answer: "B", why: "It retries once." } },
        { question: { question: "Ben's order doesn't exist. What happens?", steps: asked, options: opts('"Export failed" at once', "A retry after 30 seconds, then failure", "Endless retries"), answer: "A", read: "The warehouse times out once", why: "Only a timeout is retried." } },
      ],
    },
    {
      heading: "Already settled",
      content: [{ settled: [
        { who: "Ana", how: "said", at: "2026-11-01T09:00:00-05:00", text: "Retry only a timeout" },
        { who: "Claude", how: "claude", text: "Wait 30 seconds before the retry", alternatives: ["Retry at once", "Wait a minute"] },
      ] }],
    },
  ],
});

// A plan's case as two columns of steps, Today and After, for a test to change.
const caseCols = (data) => {
  const c = data.sections[1].content[0].case;
  return [{ steps: c.today }, { steps: c.after }];
};

const write = (dir, data) => {
  const file = path.join(dir, "docs/plans/retry.json");
  writeFileSync(file, `${formatJson(data)}\n`);
  return file;
};
const draw = (dir, kind, file, ...args) => spawnSync(process.execPath, [script, kind, path.join(dir, file), ...args], { encoding: "utf8" });
const lineOf = (file, words) => readFileSync(file, "utf8").split("\n").findIndex((l) => l.includes(words)) + 1;

test("a plan that passes every check is drawn, and the page shows each of its steps", () => {
  const dir = repo();
  write(dir, plan());
  const out = path.join(dir, "page.html");
  const run = draw(dir, "plan", "docs/plans/retry.json", "--out", out);
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout);
  assert.equal(result.cases, 1);
  assert.equal(result.questions, 0);
  const html = readFileSync(out, "utf8");
  for (const words of ["Ana exports order 1042", "Did the warehouse time out?", "Wait 30 seconds and try once more", "Load the order", '<span class="pending">Not approved yet</span>', "<b>1</b> case change"]) {
    assert.ok(html.includes(words), words);
  }
  // The case: Today beside After, the After steps the change adds marked new.
  assert.ok(html.includes('<h3 id="k-the-warehouse-times-out-once">The warehouse times out once</h3><p class="desc">Ana gets her file after one retry</p>'));
  assert.ok(html.includes("<h4>Today</h4>") && html.includes("<h4>After</h4>"));
  assert.ok(html.includes('<span class="mk new">+ new</span>Did the warehouse time out?'));
  assert.match(html, /data-line="Approve plan [0-9a-f]{7}"/);
});

test("each option of a plan's question for the author is a button giving its number and letter", () => {
  const dir = repo();
  const data = plan();
  data.sections[0].content[0].p = "Approve the retry. 1 question is open.";
  data.sections.splice(1, 0, { heading: "Questions from plan-flows", content: [
    { p: "1 question. Pick an option to answer it." },
    { choice: {
      number: 1, question: "Ana's export times out twice. Is it retried again?", today: [{ text: "Ana sees \"Export failed\" at the first timeout", kind: "start", result: "bad", shows: shown }], recommended: "No: one retry, then \"Export failed\"", alternatives: ["Yes: retry until it answers"],
      options: [
        { name: "Retry once", steps: [{ text: "Ana sees \"Export failed\" after one retry", kind: "start" }] },
        { name: "Retry until it answers", steps: [{ text: "Ana waits until the warehouse answers", kind: "start" }] },
      ],
      why: "A warehouse that is down would hold her export forever.",
    } },
  ] });
  write(dir, data);
  const out = path.join(dir, "page.html");
  const run = draw(dir, "plan", "docs/plans/retry.json", "--out", out);
  assert.equal(run.status, 0, run.stderr);
  const html = readFileSync(out, "utf8");
  assert.match(html, /<div class="pick-card"><button type="button" class="pick" aria-pressed="false" data-line="1 A"><span class="letter">A<\/span><span><span class="pick-name"><span class="tag rec">recommended<\/span> Retry once<\/span><span class="pick-says"><strong>No: one retry/);
  assert.match(html, /data-line="1 B"><span class="letter">B<\/span><span><span class="pick-name">Retry until it answers<\/span><span class="pick-says">Yes: retry until it answers<\/span>/);
  // Each option's chart is inside its card, after its button and before the next card.
  const cardB = html.slice(html.indexOf('data-line="1 B"'));
  assert.ok(cardB.indexOf("Ana waits until the warehouse answers") < cardB.indexOf("</div></div></div>") || cardB.includes("Ana waits until the warehouse answers"));
  const cardA = html.slice(html.indexOf('data-line="1 A"'), html.indexOf('data-line="1 B"'));
  assert.ok(cardA.includes("after one retry"), "option A's chart is in its card");
  assert.match(html, /<p class="ask">Pick an option on each question to copy your answers/);
});

test("a question for the author shows how its case runs today right under the question, before its options", () => {
  const dir = repo();
  const data = plan();
  data.sections[0].content[0].p = "Approve the retry. 1 question is open.";
  const choice = {
    number: 1, question: "Ana's export times out twice. Is it retried again?", today: [{ text: "Ana sees \"Export failed\" at the first timeout", kind: "start", result: "bad", shows: shown }], recommended: "No", alternatives: ["Yes"],
    options: [{ name: "Retry once", steps: [{ text: "One retry", kind: "start" }] }, { name: "Keep retrying", steps: [{ text: "Many retries", kind: "start" }] }],
    why: "A warehouse that is down would hold her export forever.",
  };
  data.sections.splice(1, 0, { heading: "Questions from plan-flows", content: [{ p: "1 question." }, { choice }] });

  write(dir, data);
  const out = path.join(dir, "page.html");
  const run = draw(dir, "plan", "docs/plans/retry.json", "--out", out);
  assert.equal(run.status, 0, run.stderr);
  const html = readFileSync(out, "utf8");
  const order = ["Is it retried again?</h3>", "How it works today", "at the first timeout", 'class="picks"', "One retry"].map((words) => html.indexOf(words));
  assert.ok(order.every((at) => at >= 0), `each part is drawn: ${order}`);
  assert.deepEqual(order, [...order].sort((a, b) => a - b));

  const refused = (change, message) => {
    const broken = structuredClone(data);
    change(broken.sections[1].content[1].choice);
    write(dir, broken);
    const again = draw(dir, "plan", "docs/plans/retry.json", "--out", path.join(dir, "refused.html"));
    assert.equal(again.status, 1);
    assert.match(again.stderr, message);
  };
  refused((c) => { delete c.today; }, /a plan's question for the author needs "today"/);
  refused((c) => { c.today = []; }, /today needs at least one step/);
  refused((c) => { c.today[0].mark = "+"; }, /a step of "today" shows what happens now/);
});

test("an explanation's choice takes no today", () => {
  const dir = repo();
  const data = JSON.parse(readFileSync(path.join(here, "fixtures/explain.json"), "utf8"));
  const choice = data.sections.flatMap((s) => s.content).find((n) => n.choice).choice;
  writeFileSync(path.join(dir, "explain.json"), `${formatJson(data)}\n`);
  const out = path.join(dir, "page.html");
  const run = draw(dir, "explain", "explain.json", "--out", out);
  assert.equal(run.status, 0, run.stderr);
  assert.ok(!readFileSync(out, "utf8").includes("How it works today"));

  choice.today = [{ text: "Ana sees \"Export failed\"", kind: "start" }];
  writeFileSync(path.join(dir, "explain.json"), `${formatJson(data)}\n`);
  const refused = draw(dir, "explain", "explain.json", "--out", out);
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /only a plan's question for the author takes "today"/);
});

test("a case's step that exists today, whose name the code doesn't have, stops the drawing, naming its line", () => {
  const dir = repo();
  const data = plan();
  caseCols(data)[0].steps[1].where = "loadOrders";
  const file = write(dir, data);
  const out = path.join(dir, "page.html");
  const run = draw(dir, "plan", "docs/plans/retry.json", "--out", out);
  assert.equal(run.status, 1);
  assert.match(run.stderr, new RegExp(`line ${lineOf(file, '"loadOrders"')}: "where": "loadOrders" is on a step that exists today`));
  assert.equal(existsSync(out), false);
});

test("every broken rule is reported at once, each with its line", () => {
  const dir = repo();
  const data = plan();
  caseCols(data)[0].steps[1].mark = "~";
  delete data.sections[3].content[0].settled[1].alternatives;
  data.sections[2].content[0].question.options[2] = opts("The file")[0];
  const file = write(dir, data);
  const run = draw(dir, "plan", "docs/plans/retry.json", "--out", path.join(dir, "page.html"));
  assert.equal(run.status, 1);
  assert.match(run.stderr, new RegExp(`line ${lineOf(file, '"today": [')}: a case's "today" is how it runs now, so its steps take no "mark"`));
  assert.match(run.stderr, /Claude's call lists in "alternatives" what else the author could pick/);
  assert.match(run.stderr, /three different options/);
});

test("the fingerprint leaves out approved, reviewPage and spacing, and a plan approved at it shows Approved", () => {
  const dir = repo();
  write(dir, plan());
  const fp = draw(dir, "fingerprint", "docs/plans/retry.json").stdout.trim();
  assert.match(fp, /^[0-9a-f]{7}$/);
  const file = path.join(dir, "docs/plans/retry.json");
  writeFileSync(file, JSON.stringify({ ...plan(), approved: `Ana · 2026-11-01T09:30:00-05:00 · ${fp}`, reviewPage: "https://example.com/p" }));
  assert.equal(draw(dir, "fingerprint", "docs/plans/retry.json").stdout.trim(), fp);
  const out = path.join(dir, "page.html");
  const run = draw(dir, "plan", "docs/plans/retry.json", "--out", out);
  assert.equal(JSON.parse(run.stdout).approved, true);
  const html = readFileSync(out, "utf8");
  assert.ok(html.includes('<span class="approved">Approved</span>'));
  assert.ok(!html.includes('class="approve-btn"'));
  assert.ok(!html.includes("https://example.com/p"));
  // Claude's calls are accepted with the plan, at the moment it was approved, and can no longer be flipped.
  assert.ok(html.includes("Accepted with the plan, 2026-11-01 09:30:00 -05:00"));
  assert.ok(!html.includes('class="flip"'));

  // An approval says the moment, not only the day.
  writeFileSync(file, JSON.stringify({ ...plan(), approved: `Ana · 2026-11-01 · ${fp}` }));
  const dated = draw(dir, "plan", "docs/plans/retry.json", "--out", out);
  assert.equal(dated.status, 1);
  assert.match(dated.stderr, /"approved" is "<who> · <YYYY-MM-DDTHH:MM:SS±HH:MM> · <fingerprint>"/);
});

test("a drawing outlines only what changed since the author last read the plan, and nothing before they have", () => {
  const dir = repo();
  write(dir, plan());
  const out = path.join(dir, "page.html");
  assert.equal(JSON.parse(draw(dir, "plan", "docs/plans/retry.json", "--out", out).stdout).outlined, 0);
  draw(dir, "seen", "docs/plans/retry.json");
  const data = plan();
  caseCols(data)[0].steps[1].text = "Load the order and its lines";
  data.sections[2].content[0].question.answer = "C";
  data.sections[2].content[0].question.options = opts("Nothing", "The file", '"Export failed"');
  write(dir, data);
  const run = draw(dir, "plan", "docs/plans/retry.json", "--out", out);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout).outlined, 2);
  const html = readFileSync(out, "utf8");
  assert.match(html, /class="n since">Load the order and its lines/);
  assert.match(html, /Outlined: changed since the page you last read/);
});

// The page drawn once `change` has edited what the plan holds under What changes, case by case, or anywhere else in it.
const drawnPlan = (change) => {
  const dir = repo();
  const data = plan();
  change(data.sections[1].content, data);
  write(dir, data);
  const out = path.join(dir, "page.html");
  const run = draw(dir, "plan", "docs/plans/retry.json", "--out", out);
  assert.equal(run.status, 0, run.stderr);
  return readFileSync(out, "utf8");
};

test("in each browser tried, a click on a name shows its line beside it, and neither the page nor the modal moves", () => {
  const seen = observation("browsers/closed-row").evidence;
  assert.ok(seen.length >= 2);
  for (const browser of seen) {
    assert.deepEqual(browser.nameClick, { pageStays: true, tipShown: true, lineInTip: true, backStaysHidden: true, keysMoveIntoTip: true, focusBackOnName: true, clickElsewhereCloses: true }, browser.name);
    assert.deepEqual(browser.nameClickInModal, { modalStays: true, flowStays: true, tipShown: true }, browser.name);
  }
});

test("with a real click and a real tap in Chrome, a name shows its line, the page stays, and anywhere else closes it", () => {
  const { nameClick, clickElsewhere, nameTap, tapElsewhere } = observation("browsers/closed-row").evidence.find((browser) => browser.realInput).realInput;
  assert.deepEqual({ nameClick, clickElsewhere, nameTap, tapElsewhere }, {
    nameClick: { pageStays: true, tipShown: true, backStaysHidden: true },
    clickElsewhere: { tipHidden: true },
    nameTap: { pageStays: true, tipShown: true },
    tapElsewhere: { tipHidden: true },
  });
});

test("with real input in Chrome, a name's line stays for the pointer to reach, and a link in it can be followed by mouse and keys", () => {
  const { tip } = observation("browsers/closed-row").evidence.find((browser) => browser.realInput).realInput;
  assert.deepEqual(tip, {
    clickKeepsItAsPointerLeaves: true,
    clickElsewhereClosesIt: true,
    pointerCrossesToIt: true,
    pointingAtNameInItKeepsIt: true,
    clickingNameInItShowsThatLine: true,
    linkInItFollowedByMouse: true,
    followingItClosesIt: true,
    enterMovesIntoIt: true,
    linkInItFollowedByKeys: true,
    escClosesItAndFocusReturns: true,
    escInModalClosesItFirst: true,
  });
});

test("a flow's modal is the script's, so a page where the script doesn't run has none", () => {
  const html = drawnPlan(() => {});
  assert.doesNotMatch(html.slice(0, html.indexOf("<script>")), /<dialog/);
});

test("an explanation's flows stay drawn in full", () => {
  const { run, html } = drawn(JSON.stringify({
    title: "A page",
    sections: [{ heading: "How it works", content: [{ flow: { name: "Export an order", steps: [{ keyword: "Starts", text: "Ana presses Export", mark: "+" }] } }] }],
  }));
  assert.equal(run.status, 0, run.stderr);
  assert.ok(html.includes('<section class="flowbox" id="f-export-an-order"><h3>Export an order</h3><figure>'));
  assert.ok(html.includes("Starts: Ana presses Export"));
  assert.doesNotMatch(html, /<details/);
});

test("an explanation is drawn without a repository, its names linked by the page", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "page-test-"));
  const out = path.join(dir, "page.html");
  const run = spawnSync(process.execPath, [script, "explain", path.join(here, "fixtures/explain.json"), "--out", out, "--whole"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  const html = readFileSync(out, "utf8");
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<dt id="n-warehouse-service" data-also="warehouse">/);
  assert.match(html, /class="n here">A timed-out export is retried/);
  assert.match(html, /<p class="ask">Should an export that times out be retried\? Pick an option to copy your answer, or answer in the chat\.<\/p>/);
  assert.match(html, /<button type="button" class="pick" aria-pressed="false" data-line="A · Retry once">/);
  assert.ok(!html.includes('class="cmt"'), "an explanation has no Comment buttons");
});

test("an explanation's question must name a part of the page", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "page-test-"));
  const file = path.join(dir, "e.json");
  const data = JSON.parse(readFileSync(path.join(here, "fixtures/explain.json"), "utf8"));
  data.sections.find((s) => s.heading === "Check your reading").content[1].question.read = "Nowhere";
  writeFileSync(file, formatJson(data));
  const run = spawnSync(process.execPath, [script, "explain", file, "--out", path.join(dir, "p.html")], { encoding: "utf8" });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /"read": "Nowhere" names no chart/);
});

test("an explanation records each decision the way a plan does, and Claude's call stands until it is flipped", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "page-test-"));
  const file = path.join(dir, "e.json");
  const run = (settled) => {
    const data = JSON.parse(readFileSync(path.join(here, "fixtures/explain.json"), "utf8"));
    data.sections.push({ heading: "Already settled", content: [{ settled }] });
    writeFileSync(file, formatJson(data));
    return spawnSync(process.execPath, [script, "explain", file, "--out", path.join(dir, "p.html")], { encoding: "utf8" });
  };
  const refused = run([{ who: "Ana", text: "Retry only a timeout" }]);
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /a settled item says "how" it was decided/);
  const drawnOk = run([
    { who: "Ana", how: "said", at: "2026-11-01T09:00:00-05:00", text: "Retry only a timeout" },
    { who: "Claude", how: "claude", text: "Wait 30 seconds before the retry", alternatives: ["Retry at once"] },
  ]);
  assert.equal(drawnOk.status, 0, drawnOk.stderr);
  const html = readFileSync(path.join(dir, "p.html"), "utf8");
  assert.ok(html.includes("Stands unless you flip it"));
  assert.ok(!html.includes("Accepted when you approve"));
  assert.ok(html.includes('data-line="call 1 B"'));
});

test("an explanation draws how something works as cases of one chart, each picturing its example, with no marks", () => {
  const page = (kase, questions = 0) => {
    const data = JSON.parse(readFileSync(path.join(here, "fixtures/explain.json"), "utf8"));
    const reading = data.sections.find((s) => s.heading === "Check your reading").content;
    while (reading.length < questions) reading.push(structuredClone(reading[reading.length - 1]));
    data.sections.splice(1, 0, { heading: "What happens, case by case", content: [{ case: kase }] });
    return drawn(formatJson(data));
  };
  const steps = [{ text: "Ana exports order 1042", kind: "start", shows: { html: ["<b>order 1042</b>"] } }, { text: "The file downloads", result: "ok" }];
  const ok = page({ title: "The warehouse answers at once", gets: "Ana gets her file", steps });
  assert.equal(ok.run.status, 0, ok.run.stderr);
  assert.ok(ok.html.includes("The warehouse answers at once"));
  assert.match(page({ title: "t", gets: "g", steps: [{ ...steps[0], mark: "+" }] }).run.stderr, /"steps" show how it works now, so they take no "mark"/);
  assert.match(page({ title: "t", gets: "g", steps: [{ text: "Ana exports", kind: "start" }] }).run.stderr, /a case draws its example as a picture/);
  assert.match(page({ title: "t", gets: "g", today: steps }).run.stderr, /a case has "today" and "after", for a change, or "steps" alone/);
  assert.match(page({ title: "t", gets: "g", steps }, 3).run.stderr, /a page asks 2 reading questions; this one asks 3/);
});

test("a step names the part of the system it runs in, drawn above its words", () => {
  const dir = repo();
  const data = plan();
  const [, after] = caseCols(data);
  after.steps[1].part = "the export worker (new)";
  write(dir, data);
  const out = path.join(dir, "page.html");
  const run = draw(dir, "plan", "docs/plans/retry.json", "--out", out);
  assert.equal(run.status, 0, run.stderr);
  assert.ok(readFileSync(out, "utf8").includes('<span class="part">the export worker (new)</span>'));
});

test("a plan's case is a change, today beside after", () => {
  const dir = repo();
  const data = plan();
  const kase = data.sections.find((s) => s.heading === "What changes, case by case").content[0].case;
  kase.steps = kase.after;
  delete kase.today;
  delete kase.after;
  write(dir, data);
  const run = draw(dir, "plan", "docs/plans/retry.json", "--out", path.join(dir, "page.html"));
  assert.equal(run.status, 1);
  assert.match(run.stderr, /a plan's case is a change: it has "today" and "after"/);
});

test("a JSON mistake names its line and what was expected there", () => {
  const cases = [
    ['{\n  "title": "t"\n  "sections": []\n}', /line 3: expected , or } after the value of "title"/],
    ['{\n  "title": "t",\n  "sections": [],\n}', /line 4: expected a "key" in quotes, found "}" \(a comma before } is not allowed\)/],
    ['{\n  "title": "a\nb",\n  "sections": []\n}', /line 2: a string runs past the end of its line/],
    ['{\n  "title": "t",\n  "title": "u",\n  "sections": []\n}', /line 3: "title" appears twice/],
    ['{\n  "title": "t",\n  "sections": [1, 2,]\n}', /line 3: a comma before \] is not allowed/],
  ];
  for (const [text, message] of cases) assert.throws(() => readJson(text), message);
});

test("a key the format doesn't give, or answers on a step that asks nothing, is refused at its line", () => {
  const unknown = '{\n  "title": "t",\n  "sections": [\n    { "heading": "s", "content": [ { "p": "x", "colour": "red" } ] }\n  ]\n}';
  assert.throws(() => readDocument(unknown), /line 4: each item of "content" is one object with one key/);
  const typo = '{\n  "title": "t",\n  "sectons": []\n}';
  assert.throws(() => readDocument(typo), /line 3: "sectons" is not a key here/);
  const answers = formatJson({ title: "t", sections: [{ heading: "s", content: [{ chart: { steps: [{ text: "A step", answers: [{ label: "yes", steps: [{ text: "x" }] }] }] } }] }] });
  assert.throws(() => readDocument(answers), /only a step of "kind": "question" has answers/);
});

test("answers under a question fan out, one answer sits beside it, and inner steps go in a box of their own", () => {
  const { doc } = readDocument(formatJson({
    title: "t",
    sections: [{ heading: "s", content: [{ chart: { steps: [
      { text: "Many?", kind: "question", answers: [{ label: "yes", steps: [{ text: "one" }] }, { label: "no", steps: [{ text: "two" }] }] },
      { text: "One?", kind: "question", answers: [{ label: "yes", steps: [{ text: "only" }] }] },
      { text: "A step", inner: [{ text: "under it" }] },
    ] } }] }],
  }));
  const [many, one, step] = doc.sections[0].nodes[0].chart.items;
  assert.deepEqual(many.lanes.map((l) => [l.label, l.items[0].text]), [["yes", "one"], ["no", "two"]]);
  assert.equal(one.lanes.length, 1);
  assert.equal(step.inner[0].text, "under it");
});

test("a link goes only to the web, mail or the page itself", () => {
  assert.equal(inline("[x](javascript:alert(1))"), "x)");
  assert.equal(inline("(*a [l](http://h/x*y)"), '(*a <a href="http://h/x*y">l</a>');
  assert.equal(inline("[see](#s-names) **it**"), '<a href="#s-names">see</a> <strong>it</strong>');
});

const drawn = (data) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "page-review-"));
  const file = path.join(dir, "review.json");
  writeFileSync(file, data);
  const run = spawnSync(process.execPath, [script, "explain", file, "--out", path.join(dir, "page.html")], { encoding: "utf8" });
  return { run, html: run.status === 0 ? readFileSync(path.join(dir, "page.html"), "utf8") : "" };
};

test("a step's picture is drawn inside its card under its words, saying where it came from or that it was drawn for the page", () => {
  const dir = repo();
  const data = plan();
  const [today, after] = caseCols(data);
  today.steps[0].shows = { html: ["<table>", "<tr><th>Order</th><td>1042</td></tr>", "</table>"], from: "the warehouse's answer" };
  after.steps[0].shows = { html: ['<svg viewBox="0 0 40 10"><rect width="40" height="10" fill="#ccc"/><text x="2" y="8">1042</text></svg>'] };
  write(dir, data);
  const out = path.join(dir, "page.html");
  const run = draw(dir, "plan", "docs/plans/retry.json", "--out", out);
  assert.equal(run.status, 0, run.stderr);
  const html = readFileSync(out, "utf8");
  assert.ok(html.includes('Ana exports order 1042<span class="where">exportOrder</span><div class="pic"><table>\n<tr><th>Order</th><td>1042</td></tr>\n</table></div><div class="pic-src">the warehouse\'s answer</div>'));
  assert.ok(html.includes('<text x="2" y="8">1042</text></svg></div><div class="pic-src">Drawn for this page</div>'));
});

test("a picture drawn once at the top of the file is shown by each step that names it, and is checked once", () => {
  const dir = repo();
  const named = () => {
    const data = plan();
    const [today, after] = caseCols(data);
    today.steps[0].shows = { use: "order 1042, ready" };
    after.steps[0].shows = { use: "order 1042, ready" };
    data.pictures["order 1042, ready"] = { html: ["<table>", "<tr><th>Order</th><td>1042</td></tr>", "</table>"], from: "the warehouse's answer" };
    return data;
  };
  write(dir, named());
  const out = path.join(dir, "page.html");
  const run = draw(dir, "plan", "docs/plans/retry.json", "--out", out);
  assert.equal(run.status, 0, run.stderr);
  const drawnOnce = 'Ana exports order 1042<span class="where">exportOrder</span><div class="pic"><table>\n<tr><th>Order</th><td>1042</td></tr>\n</table></div><div class="pic-src">the warehouse\'s answer</div>';
  assert.equal(readFileSync(out, "utf8").split(drawnOnce).length - 1, 2, "both steps hold the picture");

  // A step showing a named picture changes when the picture does, so a drawing can outline it.
  const sources = (data) => readDocument(formatJson(data)).doc.sections[1].nodes[0].chart.columns.map((c) => c.items[0].source);
  const changed = named();
  changed.pictures["order 1042, ready"].html[1] = "<tr><th>Order</th><td>1043</td></tr>";
  assert.notDeepEqual(sources(changed), sources(named()));

  const refused = (change, message) => {
    const data = named();
    change(data);
    const file = write(dir, data);
    const again = draw(dir, "plan", "docs/plans/retry.json", "--out", path.join(dir, "refused.html"));
    assert.equal(again.status, 1);
    const said = message(file);
    assert.match(again.stderr, said);
    return again.stderr;
  };
  const steps = (data) => caseCols(data).map((c) => c.steps[0]);
  refused((d) => { steps(d)[0].shows.use = "order 7"; }, (file) => new RegExp(`line ${lineOf(file, '"use": "order 7"')}: "use": "order 7" names no picture under "pictures"`));
  refused((d) => { for (const s of steps(d)) delete s.shows; }, () => /the picture "order 1042, ready" is shown by no step/);
  refused((d) => { steps(d)[0].shows.html = ["<b>1042</b>"]; }, () => /a "shows" naming a picture with "use" takes no "html" or "from"/);
  const unsafe = refused((d) => { d.pictures["order 1042, ready"].html[1] = '<tr><td onclick="go()">1042</td></tr>'; }, (file) => new RegExp(`line ${lineOf(file, "onclick")}: a picture holds no \`onclick\``));
  assert.equal(unsafe.split("a picture holds no `onclick`").length - 1, 1, "a named picture's problem is reported once, though two steps show it");
  const copied = (d) => { steps(d)[1].shows = { html: [...d.pictures["order 1042, ready"].html] }; };
  refused(copied, (file) => new RegExp(`this picture is written out at line ${lineOf(file, '"order 1042, ready": {')} too: draw it once under "pictures"`));
});

test("a picture that runs, loads or styles anything, holds an id, or leaves a tag open is refused at its line", () => {
  const dir = repo();
  const data = plan();
  caseCols(data)[0].steps[0].shows = { html: [
    '<img src="https://tracker.example.com/open.gif">',
    "<style>table{display:none}</style>",
    '<div id="w-exportorder" onclick="go()">',
    "<span>left open",
  ] };
  const file = write(dir, data);
  const run = draw(dir, "plan", "docs/plans/retry.json", "--out", path.join(dir, "page.html"));
  assert.equal(run.status, 1);
  assert.match(run.stderr, new RegExp(`line ${lineOf(file, "open.gif")}: a picture holds no \`<img>\``));
  assert.match(run.stderr, new RegExp(`line ${lineOf(file, "open.gif")}: a picture holds no \`src\``));
  assert.match(run.stderr, new RegExp(`line ${lineOf(file, "<style>")}: a picture holds no \`<style>\``));
  assert.match(run.stderr, new RegExp(`line ${lineOf(file, "onclick")}: a picture holds no \`id\``));
  assert.match(run.stderr, new RegExp(`line ${lineOf(file, "onclick")}: a picture holds no \`onclick\``));
  assert.match(run.stderr, new RegExp(`line ${lineOf(file, "left open")}: \`<span>\` is never closed`));
});

test("a flow's step takes no picture", () => {
  const { run } = drawn(JSON.stringify({ title: "A page", sections: [{ heading: "How it works", content: [{ flow: { name: "Export", steps: [{ keyword: "Starts", text: "Ana presses Export", shows: { html: ["<b>order 1042</b>"] } }] } }] }] }));
  assert.equal(run.status, 1);
  assert.match(run.stderr, /a flow's step takes no picture/);
});

test("a reading question draws its case above its options, each a card holding its own chart", () => {
  const html = drawnPlan((_, data) => {
    const q = data.sections[2].content[0].question;
    q.steps = [{ text: "Ana exports order 1042", kind: "start" }, { text: "It times out twice", kind: "question", shows: shown }];
    q.options = [
      { text: "The file", steps: [{ text: "A third try starts", kind: "start" }] },
      { text: '"Export failed"', steps: [{ text: "No third try", kind: "start" }] },
      { text: "Nothing", steps: [{ text: "The page waits", kind: "start" }] },
    ];
  });
  const quiz = html.slice(html.indexOf('<div class="qz'), html.indexOf('<div class="fb"'));
  assert.ok(quiz.indexOf("It times out twice") < quiz.indexOf('class="opts"'), "the case comes before the options");
  const cardB = quiz.slice(quiz.indexOf('<div class="opt-card" data-letter="B">'), quiz.indexOf('<div class="opt-card" data-letter="C">'));
  assert.match(cardB, /^<div class="opt-card" data-letter="B"><button type="button" class="opt" data-letter="B"><span class="letter">B<\/span><span>&quot;Export failed&quot;<\/span><\/button><div class="chart">/);
  assert.ok(cardB.includes("No third try"));
});

test("a reading question needs its case's chart, and each option its chart with no ✓ or ✗", () => {
  const dir = repo();
  const refused = (change, message) => {
    const data = plan();
    change(data.sections[2].content[0].question);
    const file = write(dir, data);
    const run = draw(dir, "plan", "docs/plans/retry.json", "--out", path.join(dir, "page.html"));
    assert.equal(run.status, 1);
    assert.match(run.stderr, message(file));
  };
  refused((q) => { delete q.steps; }, () => /question needs "steps"/);
  refused((q) => { q.options[1] = q.options[1].text; }, () => /options\.1 must be an object/);
  refused((q) => { q.options[0].steps = [{ text: "A third try is made", kind: "start", result: "ok" }]; }, (file) => new RegExp(`line ${lineOf(file, "A third try is made")}: an option's chart carries no ✓ or ✗`));
});

test("a reading question draws the example in its case, and in every option's chart or in none", () => {
  const dir = repo();
  const drawWith = (change) => {
    const data = plan();
    change(data.sections[2].content[0].question);
    const file = write(dir, data);
    return { file, run: draw(dir, "plan", "docs/plans/retry.json", "--out", path.join(dir, "page.html")) };
  };
  const bare = drawWith((q) => { q.steps = [{ text: "Ana exports order 1042 again", kind: "start" }]; });
  assert.equal(bare.run.status, 1);
  assert.match(bare.run.stderr, new RegExp(`line ${lineOf(bare.file, "times out twice. What does she see") - 2}: a question draws its case as a picture`));

  const one = drawWith((q) => { q.options[1].steps[0].shows = shown; });
  assert.equal(one.run.status, 1);
  assert.match(one.run.stderr, /either every option's chart holds a picture or none does/);

  const each = drawWith((q) => { for (const o of q.options) o.steps[0].shows = shown; });
  assert.equal(each.run.status, 0, each.run.stderr);
  const html = readFileSync(path.join(dir, "page.html"), "utf8");
  const quiz = html.slice(html.indexOf('<div class="qz'), html.indexOf('<div class="fb"'));
  const picture = `<div class="pic">${order1042.html.join("\n")}</div><div class="pic-src">Drawn for this page</div>`;
  assert.ok(quiz.slice(0, quiz.indexOf('class="opts"')).includes(picture), "the case holds its picture");
  for (const letter of "ABC") {
    const card = quiz.slice(quiz.indexOf(`<div class="opt-card" data-letter="${letter}">`));
    assert.ok(card.slice(0, card.indexOf("</div></div></div></div>")).includes(picture), `option ${letter} holds its picture`);
  }
});

test("a question for the author draws the example: on a step of today in a plan, of an option in an explanation", () => {
  const dir = repo();
  const data = plan();
  data.sections[0].content[0].p = "Approve the retry. 1 question is open.";
  const choice = {
    number: 1, question: "Ana's export times out twice. Is it retried again?", today: [{ text: "Ana sees the export fail", kind: "start" }], recommended: "No", alternatives: ["Yes"],
    options: [{ name: "Retry once", steps: [{ text: "One retry", kind: "start", shows: shown }] }, { name: "Keep retrying", steps: [{ text: "Many retries", kind: "start" }] }],
    why: "A warehouse that is down would hold her export forever.",
  };
  data.sections.splice(1, 0, { heading: "Questions from plan-flows", content: [{ p: "1 question." }, { choice }] });
  const file = write(dir, data);
  const out = path.join(dir, "page.html");
  const bare = draw(dir, "plan", "docs/plans/retry.json", "--out", out);
  assert.equal(bare.status, 1);
  assert.match(bare.stderr, new RegExp(`line ${lineOf(file, '"choice": {') - 1}: a question for the author draws its case as a picture \\("shows"\\) on a step of "today"`));

  choice.today[0].shows = shown;
  write(dir, data);
  const run = draw(dir, "plan", "docs/plans/retry.json", "--out", out);
  assert.equal(run.status, 0, run.stderr);
  const html = readFileSync(out, "utf8");
  const today = html.slice(html.indexOf("How it works today"), html.indexOf('class="picks"'));
  assert.ok(today.includes('Ana sees the export fail<div class="pic"><table>'), "today holds its picture");

  const explained = JSON.parse(readFileSync(path.join(here, "fixtures/explain.json"), "utf8"));
  for (const o of explained.sections.flatMap((s) => s.content).find((n) => n.choice).choice.options) for (const step of o.steps) delete step.shows;
  writeFileSync(path.join(dir, "explain.json"), `${formatJson(explained)}\n`);
  const refused = draw(dir, "explain", "explain.json", "--out", out);
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /a choice draws its case as a picture \("shows"\) on a step of an option's chart/);
});

test("in each browser tried, a click on a name inside an option's card picks nothing, a click elsewhere on it picks it, and a picture's words stay as written", () => {
  const seen = observation("browsers/closed-row").evidence;
  assert.ok(seen.length >= 2);
  for (const browser of seen) {
    const { nameInCard, cardClick, pictureWords } = browser;
    assert.deepEqual({ nameInCard, cardClick, pictureWords }, {
      nameInCard: { tipShown: true, notPicked: true },
      cardClick: { picked: true, feedbackShown: true },
      pictureWords: { namesLinked: 0, drawn: true, inFull: true },
    }, browser.name);
  }
});

test("each of Claude's calls under Already settled can be flipped to one of its alternatives, which adds its call to the answers", () => {
  const html = drawnPlan(() => {});
  assert.ok(html.includes('<table class="decided">'));
  assert.ok(html.includes('<span class="by said">Ana said</span>'));
  assert.ok(html.includes("2026-11-01 09:00:00 -05:00"));
  assert.ok(html.includes('<span class="by claude">Claude\'s call 1</span>'));
  assert.ok(html.includes("Accepted when you approve"));
  assert.ok(html.includes('data-line="call 1 B"><span class="letter">B</span><span>Retry at once</span>'));
  assert.ok(html.includes('data-line="call 1 C"><span class="letter">C</span><span>Wait a minute</span>'));
  assert.ok(html.includes('<div class="flipped-line">'));
});

test("a plan's settled item says how it was decided, and when unless it is Claude's call", () => {
  const refused = (change, message) => {
    const dir = repo();
    const data = plan();
    change(data.sections[3].content[0].settled);
    write(dir, data);
    const run = draw(dir, "plan", "docs/plans/retry.json", "--out", path.join(dir, "page.html"));
    assert.equal(run.status, 1);
    assert.match(run.stderr, message);
  };
  refused((rows) => { delete rows[0].how; }, /says "how" it was decided/);
  refused((rows) => { rows[0].how = "guessed"; }, /"how" is one of "chose", "said", "rule", "claude"/);
  refused((rows) => { rows[0].at = "2026-11-01"; }, /says when, in "at": YYYY-MM-DDTHH:MM:SS±HH:MM/);
  refused((rows) => { rows[1].at = "2026-11-01T09:00:00-05:00"; }, /Claude's call takes no "at"/);
  refused((rows) => { rows[0].alternatives = ["Retry everything"]; }, /only Claude's call lists "alternatives"/);
});

test("a plan has its cases, each drawing its example and marking what changes after, and no flows", () => {
  const refused = (change, message) => {
    const dir = repo();
    const data = plan();
    change(data);
    write(dir, data);
    const run = draw(dir, "plan", "docs/plans/retry.json", "--out", path.join(dir, "page.html"));
    assert.equal(run.status, 1);
    assert.match(run.stderr, message);
  };
  refused((d) => d.sections.splice(1, 1), /a plan has a "What changes, case by case" section/);
  refused((d) => { delete caseCols(d)[0].steps[0].shows; }, /a case draws its example as a picture/);
  refused((d) => { for (const s of caseCols(d)[1].steps) delete s.mark; delete caseCols(d)[1].steps[1].answers[0].steps[0].mark; }, /mark the steps of "after" that are new/);
  refused((d) => { d.sections[1].content.push({ flow: { name: "Export", steps: [{ keyword: "Starts", text: "Ana presses Export" }] } }); }, /it has no flows/);
  refused((d) => { d.sections.push({ heading: "How it's built", content: [{ p: "Code." }] }); }, /"How it's built" is not a plan section/);
  refused((d) => { d.sections[2].content.pop(); }, /a plan asks 2 reading questions; this one asks 1/);
});

test("in a plan, a reading question needs no Where to look, and shows none without one", () => {
  const html = drawnPlan(() => {});
  assert.equal(html.split("Where to look:").length - 1, 1);
  assert.ok(html.includes('Where to look: <a href="#k-the-warehouse-times-out-once">'));
});
