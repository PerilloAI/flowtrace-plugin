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

// A plan of one step, whose two cases it makes come true.
const plan = () => ({
  title: "Retry an export that times out",
  pictures: { "order 1042": order1042 },
  sections: [
    { heading: "The whole thing", content: [{ whole: {
      problem: "When the warehouse is slow for a moment, Ana's export of order 1042 fails and she starts it again by hand.",
      gets: "Ana's export of order 1042 is tried once more when the warehouse is slow, so she gets her file.",
      shows: { html: ["<b>order-1042.csv</b> downloaded"] },
      for: "Shop owners who export orders.", in: "An export that times out once.", out: "Exports that fail for any other reason.",
      assumes: "You have exported an order.", asking: "Approve the one step. No questions are open.",
    } }] },
    { heading: "What will happen, in order", content: [{ step: {
      title: "Retry a timed-out export once", label: "Retry",
      shows: { html: ["<b>order 1042</b> · timed out at 30 s"] }, caption: "Ana's export, waiting on the warehouse.",
      gist: "When the warehouse doesn't answer in 30 seconds, the export waits and asks once more, so a slow minute doesn't cost Ana her file.",
      how: {
        frames: [
          { part: "The export", shows: { html: ["<b>order 1042</b> · asked at 09:00:00"] }, text: "The export asks for order 1042 and waits." },
          { part: "The export", shows: { html: ["<b>order 1042</b> · no answer at 09:00:30"] }, text: "With no answer after 30 seconds, it waits 30 more and asks once again.", notes: ["Any other failure is reported at once."] },
        ],
        decides: [{ number: "30 seconds", decides: "How long it waits before it asks again" }],
        breaks: "A slow spell longer than a minute: the one retry fails too.",
      },
      trade: { chose: "One retry after 30 seconds", over: "Retrying until it answers", because: "A warehouse that is down would hold the export forever", costs: "An export that times out twice still fails" },
      cases: [
        {
          title: "The warehouse times out once",
          gets: "Ana gets her file after one retry",
          today: [{ text: "Ana exports order 1042", kind: "start", where: "exportOrder", shows: shown }, { text: "Load the order", where: "loadOrder" }, { text: '"Export failed"', result: "bad" }],
          after: [
            { text: "Ana exports order 1042", kind: "start", where: "exportOrder" },
            { text: "Did the warehouse time out?", kind: "question", mark: "+", answers: [{ label: "yes", steps: [{ text: "Wait 30 seconds and try once more", mark: "+" }] }] },
            { text: "Ana gets the file", result: "ok" },
          ],
        },
        {
          title: "The warehouse times out twice",
          gets: "Ana sees \"Export failed\" after the one retry",
          today: [{ text: "Ana sees \"Export failed\" at once", kind: "start", shows: shown }],
          after: [{ text: "One retry, then \"Export failed\"", kind: "start", mark: "+", result: "bad" }],
        },
      ],
      see: "order-1042.csv after one retry",
    } }] },
    {
      heading: "Already settled",
      content: [{ settled: [
        { who: "Ana", how: "said", at: "2026-11-01T09:00:00-05:00", text: "Retry only a timeout" },
        { who: "Claude", how: "claude", text: "Wait 30 seconds before the retry", alternatives: ["Retry at once", "Wait a minute"], wrongIf: "The warehouse is slow for longer than a minute" },
      ] }],
    },
  ],
});

// The parts of the plan a test changes: its steps, its first step's cases, its decisions, and where a question goes.
const steps = (data) => data.sections.find((s) => s.heading === "What will happen, in order").content;
const step = (data, k = 0) => steps(data)[k].step;
const settledOf = (data) => data.sections.find((s) => s.heading === "Already settled").content[0].settled;
const section = (data, heading) => data.sections.find((s) => s.heading === heading);
const askAuthor = (data, ...choices) => { step(data).choices = [...(step(data).choices ?? []), ...choices]; };
const choiceOf = (data, k = 0) => step(data).choices[k];

// A plan's case as two columns of steps, Today and After, for a test to change.
const caseCols = (data) => {
  const c = step(data).cases[0];
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
  assert.equal(result.cases, 2);
  assert.equal(result.questions, 0);
  assert.equal(result.steps, 1);
  assert.ok(Number.isInteger(result.minutes) && result.minutes >= 1 && result.gist >= 1 && result.gist <= result.minutes, `minutes: ${result.minutes}, gist: ${result.gist}`);
  assert.ok(!("lessons" in result) && !("rungs" in result));
  const html = readFileSync(out, "utf8");
  for (const words of ["Ana exports order 1042", "Did the warehouse time out?", "Wait 30 seconds and try once more", "Load the order", '<span class="pending">Not approved yet</span>', "<b>2</b> cases change"]) {
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
  askAuthor(data,
    {
      number: 1, question: "Ana's export times out twice. Is it retried again?", today: [{ text: "Ana sees \"Export failed\" at the first timeout", kind: "start", result: "bad", shows: shown }], recommended: "No: one retry, then \"Export failed\"", alternatives: ["Yes: retry until it answers"],
      options: [
        { name: "Retry once", steps: [{ text: "Ana sees \"Export failed\" after one retry", kind: "start" }] },
        { name: "Retry until it answers", steps: [{ text: "Ana waits until the warehouse answers", kind: "start" }] },
      ],
      why: "A warehouse that is down would hold her export forever.",
      decides: "Whether a warehouse that is down for long happens to you.",
    },
  );
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
  assert.match(html, /<p class="ask">Pick an option to copy your answer, such as "1 A"/);
});

test("a question for the author shows how its case runs today right under the question, before its options", () => {
  const dir = repo();
  const data = plan();
  const choice = {
    number: 1, question: "Ana's export times out twice. Is it retried again?", today: [{ text: "Ana sees \"Export failed\" at the first timeout", kind: "start", result: "bad", shows: shown }], recommended: "No", alternatives: ["Yes"],
    options: [{ name: "Retry once", steps: [{ text: "One retry", kind: "start" }] }, { name: "Keep retrying", steps: [{ text: "Many retries", kind: "start" }] }],
    why: "A warehouse that is down would hold her export forever.",
    decides: "Whether the warehouse is ever down for long.",
  };
  askAuthor(data, choice);

  write(dir, data);
  const out = path.join(dir, "page.html");
  const run = draw(dir, "plan", "docs/plans/retry.json", "--out", out);
  assert.equal(run.status, 0, run.stderr);
  const html = readFileSync(out, "utf8");
  const order = ["Is it retried again?</h3>", "How it works today", "at the first timeout", "What decides it", 'class="picks"', "Many retries"].map((words) => html.indexOf(words));
  assert.ok(order.every((at) => at >= 0), `each part is drawn: ${order}`);
  assert.deepEqual(order, [...order].sort((a, b) => a - b));

  const refused = (change, message) => {
    const broken = structuredClone(data);
    change(choiceOf(broken));
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
  delete settledOf(data)[1].alternatives;
  step(data).gist = Array.from({ length: 60 }, () => "word").join(" ");
  const file = write(dir, data);
  const run = draw(dir, "plan", "docs/plans/retry.json", "--out", path.join(dir, "page.html"));
  assert.equal(run.status, 1);
  assert.match(run.stderr, new RegExp(`line ${lineOf(file, '"today": [')}: a case's "today" is how it runs now, so its steps take no "mark"`));
  assert.match(run.stderr, /Claude's call lists in "alternatives" what else the author could pick/);
  assert.match(run.stderr, /a step's "gist" is 50 words or fewer, a sentence or two; this one is 60/);
});

test("the fingerprint leaves out approved, reviewPage, build and spacing, and a plan approved at it shows Approved", () => {
  const dir = repo();
  write(dir, plan());
  const fp = draw(dir, "fingerprint", "docs/plans/retry.json").stdout.trim();
  assert.match(fp, /^[0-9a-f]{7}$/);
  const file = path.join(dir, "docs/plans/retry.json");
  writeFileSync(file, JSON.stringify({ ...plan(), approved: `Ana · 2026-11-01T09:30:00-05:00 · ${fp}`, reviewPage: "https://example.com/p", build: [{ state: "now" }] }));
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
  settledOf(data)[0].text = "Retry only a timeout, never a refusal";
  write(dir, data);
  const run = draw(dir, "plan", "docs/plans/retry.json", "--out", out);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout).outlined, 2);
  const html = readFileSync(out, "utf8");
  assert.match(html, /class="n since">Load the order and its lines/);
  assert.match(html, /Outlined: changed since the page you last read/);
});

// The page drawn once `change` has edited the plan's steps, or anything else in it.
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
  const kase = step(data).cases[0];
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
  const sources = (data) => readDocument(formatJson(data)).doc.sections[1].nodes[0].cases[0].chart.columns.map((c) => c.items[0].source);
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

// An explanation whose first reading question `change` has edited, drawn: its file, the run, and the page.
const explainedQuiz = (change) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "page-test-"));
  const data = JSON.parse(readFileSync(path.join(here, "fixtures/explain.json"), "utf8"));
  change(data.sections.flatMap((s) => s.content).find((n) => n.question).question);
  const file = path.join(dir, "explain.json");
  writeFileSync(file, `${formatJson(data)}\n`);
  const out = path.join(dir, "page.html");
  const run = spawnSync(process.execPath, [script, "explain", file, "--out", out], { encoding: "utf8" });
  return { file, run, html: run.status === 0 ? readFileSync(out, "utf8") : "" };
};

test("a reading question draws its case above its options, each a card holding its own chart", () => {
  const { run, html } = explainedQuiz((q) => {
    q.steps = [{ text: "Ana exports order 1042", kind: "start" }, { text: "It times out twice", kind: "question", shows: { use: "order 1042, ready" } }];
    q.options = [
      { text: "The file", steps: [{ text: "A third try starts", kind: "start" }] },
      { text: '"Export failed"', steps: [{ text: "No third try", kind: "start" }] },
      { text: "Nothing", steps: [{ text: "The page waits", kind: "start" }] },
    ];
  });
  assert.equal(run.status, 0, run.stderr);
  const qz = html.slice(html.indexOf('<div class="qz'), html.indexOf('<div class="fb"'));
  assert.ok(qz.indexOf("It times out twice") < qz.indexOf('class="opts"'), "the case comes before the options");
  const cardB = qz.slice(qz.indexOf('<div class="opt-card" data-letter="B">'), qz.indexOf('<div class="opt-card" data-letter="C">'));
  assert.match(cardB, /^<div class="opt-card" data-letter="B"><button type="button" class="opt" data-letter="B"><span class="letter">B<\/span><span>&quot;Export failed&quot;<\/span><\/button><div class="chart">/);
  assert.ok(cardB.includes("No third try"));
});

test("a reading question needs its case's chart, and each option its chart with no ✓ or ✗", () => {
  const refused = (change, message) => {
    const { file, run } = explainedQuiz(change);
    assert.equal(run.status, 1);
    assert.match(run.stderr, message(file));
  };
  refused((q) => { delete q.steps; }, () => /question needs "steps"/);
  refused((q) => { q.options[1] = q.options[1].text; }, () => /options\.1 must be an object/);
  refused((q) => { q.options[0].steps = [{ text: "A third try is made", kind: "start", result: "ok" }]; }, (file) => new RegExp(`line ${lineOf(file, "A third try is made")}: an option's chart carries no ✓ or ✗`));
});

test("a reading question draws the example in its case, and in every option's chart or in none", () => {
  const drawWith = explainedQuiz;
  const bare = drawWith((q) => { q.steps = [{ text: "Ana exports order 1042 again", kind: "start" }]; });
  assert.equal(bare.run.status, 1);
  assert.match(bare.run.stderr, new RegExp(`line ${lineOf(bare.file, "times out twice in a row. What does she see") - 2}: a question draws its case as a picture`));

  const one = drawWith((q) => { q.options[1].steps[0].shows = { use: "order 1042, ready" }; });
  assert.equal(one.run.status, 1);
  assert.match(one.run.stderr, /either every option's chart holds a picture or none does/);

  const each = drawWith((q) => { for (const o of q.options) o.steps[0].shows = { use: "order 1042, ready" }; });
  assert.equal(each.run.status, 0, each.run.stderr);
  const qz = each.html.slice(each.html.indexOf('<div class="qz'), each.html.indexOf('<div class="fb"'));
  const casePicture = '<td>no answer after 30 s</td></tr>\n</table></div><div class="pic-src">Drawn for this page</div>';
  const picture = '<td>Ready to export</td></tr>\n</table></div><div class="pic-src">the warehouse\'s answer for order 1042</div>';
  assert.ok(qz.slice(0, qz.indexOf('class="opts"')).includes(casePicture), "the case holds its picture");
  for (const letter of "ABC") {
    const from = qz.indexOf(`<div class="opt-card" data-letter="${letter}">`);
    const next = qz.indexOf('<div class="opt-card"', from + 1);
    assert.ok(qz.slice(from, next < 0 ? undefined : next).includes(picture), `option ${letter} holds its picture`);
  }
});

test("a question for the author draws the example: on a step of today in a plan, of an option in an explanation", () => {
  const dir = repo();
  const data = plan();
  const choice = {
    number: 1, question: "Ana's export times out twice. Is it retried again?", today: [{ text: "Ana sees the export fail", kind: "start" }], recommended: "No", alternatives: ["Yes"],
    options: [{ name: "Retry once", steps: [{ text: "One retry", kind: "start", shows: shown }] }, { name: "Keep retrying", steps: [{ text: "Many retries", kind: "start" }] }],
    why: "A warehouse that is down would hold her export forever.",
    decides: "Whether the warehouse is ever down for long.",
  };
  askAuthor(data, choice);
  const file = write(dir, data);
  const out = path.join(dir, "page.html");
  const bare = draw(dir, "plan", "docs/plans/retry.json", "--out", out);
  assert.equal(bare.status, 1);
  assert.match(bare.stderr, new RegExp(`line ${lineOf(file, '"choices": [') + 1}: a question for the author draws its case as a picture \\("shows"\\) on a step of "today"`));

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
    change(settledOf(data));
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

test("a plan's cases sit in its steps, each drawing its example and marking what changes after, and it has no flows or reading questions", () => {
  const refused = (change, message) => {
    const dir = repo();
    const data = plan();
    change(data);
    write(dir, data);
    const run = draw(dir, "plan", "docs/plans/retry.json", "--out", path.join(dir, "page.html"));
    assert.equal(run.status, 1);
    assert.match(run.stderr, message);
  };
  refused((d) => d.sections.splice(1, 1), /a plan has a "What will happen, in order" section/);
  refused((d) => { delete caseCols(d)[0].steps[0].shows; }, /a case draws its example as a picture/);
  refused((d) => { for (const s of caseCols(d)[1].steps) delete s.mark; delete caseCols(d)[1].steps[1].answers[0].steps[0].mark; }, /mark the steps of "after" that are new/);
  refused((d) => { step(d).how.more = [{ flow: { name: "Export", steps: [{ keyword: "Starts", text: "Ana presses Export" }] } }]; }, /each item of a step's "more" is one of \{ "list": … \}, \{ "numbered": … \}, \{ "table": … \}, \{ "chart": … \}/);
  refused((d) => { d.sections[1].content.push({ flow: { name: "Export", steps: [{ keyword: "Starts", text: "Ana presses Export" }] } }); }, /a plan has no "flow"/);
  refused((d) => { d.sections[1].content.push({ case: structuredClone(step(d).cases[1]) }); }, /a plan's case sits in the "cases" of the step that makes its "after" come true/);
  refused((d) => { d.sections.push({ heading: "How it's built", content: [{ p: "Code." }] }); }, /"How it's built" is not a plan section/);
  refused((d) => { d.sections.splice(2, 0, { heading: "Check your reading", content: [{ p: "x" }] }); }, /"Check your reading" is not a plan section/);
  refused((d) => { step(d).how.more = [{ question: { question: "q?", steps: asked, options: opts("a", "b", "c"), answer: "A", why: "w" } }]; }, /each item of a step's "more" is one of/);
});

// A plan changed by `change`, drawn, refused with every message given: each a pattern, or one made from the file for its line.
const refusedPlan = (change, ...messages) => {
  const dir = repo();
  const data = plan();
  change(data);
  const file = write(dir, data);
  const run = draw(dir, "plan", "docs/plans/retry.json", "--out", path.join(dir, "page.html"));
  assert.equal(run.status, 1, `drawn though it should be refused: ${messages.join(", ")}`);
  for (const message of messages) assert.match(run.stderr, typeof message === "function" ? message(file) : message);
  return run.stderr;
};

// The fixture plan, drawn in a repository holding the code its cases name.
function drawnFixture(change = () => {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "page-test-"));
  const git = (...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  mkdirSync(path.join(dir, "invoices"));
  writeFileSync(path.join(dir, "invoices/upload.py"), "def upload(path):\n    pass\n");
  writeFileSync(path.join(dir, "invoices/read.py"), "def read_invoice(path):\n    return None\n\n\ndef read_letters(page):\n    return []\n\n\ndef lines_of(letters):\n    return []\n");
  git("add", ".");
  git("commit", "-q", "-m", "invoices");
  mkdirSync(path.join(dir, "docs/plans"), { recursive: true });
  const data = JSON.parse(readFileSync(path.join(here, "fixtures/plan.json"), "utf8"));
  change(data);
  const file = path.join(dir, "docs/plans/read-invoice-words.json");
  writeFileSync(file, `${formatJson(data)}\n`);
  const out = path.join(dir, "page.html");
  const run = spawnSync(process.execPath, [script, "plan", file, "--out", out], { encoding: "utf8" });
  return { run, file, html: run.status === 0 ? readFileSync(out, "utf8") : "" };
}

test("the fixture plan passes every check and draws as a storyboard, its counts giving its steps and the minutes of the gist and the whole", () => {
  const { run, html } = drawnFixture();
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout);
  assert.deepEqual(Object.keys(result), ["page", "fingerprint", "approved", "cases", "questions", "minutes", "gist", "steps", "outlined"]);
  assert.deepEqual([result.cases, result.questions, result.steps], [4, 1, 5]);
  assert.ok(result.gist >= 1 && result.gist < result.minutes, `gist ${result.gist}, whole ${result.minutes}`);
  const said = (m) => (m === 1 ? "one minute" : `${m} minutes`);
  // In reading order: the switch, the whole thing, the line of every step, the parts, each step, every trade-off.
  const order = [
    '<div class="seg" role="group" aria-label="How much to show"><button type="button" data-show="all" aria-pressed="true">The gist and the technical parts</button><button type="button" data-show="gist" aria-pressed="false">The gist only</button></div>',
    '<p class="problem"><span class="lbl">The problem today</span>Sam drops invoice-1042.pdf in',
    '<p class="gets"><span class="lbl">With this plan</span>Drop a PDF in.',
    '<ol class="storyline"><li><a href="#step-1"><span class="n">1</span> Pages</a></li>',
    '<li class="mine"><a href="#step-5"><span class="n">5</span> Unnamed letters</a></li></ol>',
    `5 steps, each ending in something you can look at. Step 5 holds a question for you, shaded. The gist alone reads in about ${said(result.gist)}; the whole page, with how each step works, in about ${said(result.minutes)}.`,
    '<h3 id="h-the-parts">The parts</h3>',
    '<li class="step done" id="step-1"><div class="num">1</div><div class="step-pic"><div class="pic">',
    '<p class="cap">Invoice 1042 as Sam sees it: one page.</p>',
    '<div class="step-head"><h3>Open the file and find its pages <span class="state done">Done</span></h3><p class="gist">A PDF keeps an index',
    '<div class="step-body"><div class="tech"><h4>How it works</h4><ol class="frames"><li class="frame cell"><div class="fhead"><span class="fn">1</span><span class="part">The file\'s last lines</span></div><div class="fpic"><div class="pic">',
    '<p class="fcap">The file\'s last lines say where the index starts: byte 48,210.</p><ul class="fnotes"><li>A program reads a PDF from its end, because the index is written last.</li></ul>',
    '<div class="pic-src">Pictures drawn for this page</div>',
    '<p class="breaks"><strong>Where it goes wrong first:</strong> A damaged index.',
    '<div class="more-how"><h5>More detail</h5><div class="tablewrap"><table><thead><tr><th>What the library also handles</th>',
    '<div class="trade"><h4>The trade-off</h4><dl><dt>Chose</dt><dd>An established PDF library to open the file</dd><dt>Over</dt><dd>Reading the file\'s parts by hand</dd><dt>Because</dt>',
    '<div class="seesaw"><div><span class="lbl">Promised</span>invoice-1042.pdf · 1 page</div><div><span class="lbl">Showed</span>invoice-1042.pdf · 1 page</div></div>',
    '<div class="tech built"><h4>Where it is in the code</h4><ul><li><code>invoices/read.py</code> · <code>read_invoice</code> <span class="does">',
    '<span class="tag unk">Tests what nobody knows yet</span>',
    '<p class="found"><strong>Found:</strong> Two invoices in a hundred',
    '<li class="step stopped" id="step-3">',
    '<div class="causes"><h4>What may have caused it, the cheapest to check first</h4><ol><li>Letters on one line sit a hair apart',
    '<div class="step-say" data-prefix="step 3">',
    '<li class="step not" id="step-4">',
    '<p class="see"><strong>You will see:</strong> The newsletter\'s left column, then its right, each story whole</p>',
    '<li class="step not mine" id="step-5">',
    '<span class="tag mine">Your call · question 1</span>',
    "<h4 class=\"today\">What decides it</h4>",
    '<h3 id="h-every-trade-off">Every trade-off, in the order it is made</h3>',
    '<tr><td>4</td><td>Finding columns by the empty strip down the page</td><td>Reading in the order the file draws</td><td>A quote set across both columns is split in two</td></tr>',
    '<tr class="mine"><td>5</td><td colspan="3"><a href="#step-5">Your call: question 1</a></td></tr>',
    '<h4 class="sub">Calls most likely to be wrong</h4>',
    '<span class="usual">The field calls it <b>ToUnicode map</b></span>',
  ].map((w) => [w, html.indexOf(w)]);
  for (const [w, at] of order) assert.ok(at >= 0, w);
  assert.deepEqual(order.map(([, at]) => at), order.map(([, at]) => at).sort((a, b) => a - b), "drawn in reading order");
  assert.ok(!html.includes('data-prefix="told"'), "the build isn't done");
  // The switch hides each step's How it works, and nothing else.
  const script = html.slice(html.indexOf("<script>"));
  assert.ok(script.includes('classList.toggle("gist-only", button.dataset.show === "gist")'));
  assert.ok(html.includes(".gist-only .tech { display: none; }"));
});

test("a plan's sections stand in their order, The whole thing first and What will happen, in order always there", () => {
  refusedPlan((d) => { d.sections.splice(1, 0, { heading: "Plan changes", content: [{ p: "Nothing yet." }] }); d.sections.reverse(); }, /The whole thing comes first/, /out of order/);
  refusedPlan((d) => { d.sections.push({ heading: "How it is built", content: [{ p: "x" }] }); }, /"How it is built" is not a plan section/);
  refusedPlan((d) => { d.sections.push({ heading: "What a person gets", content: [{ p: "x" }] }); }, /"What a person gets" is not a plan section/);
  refusedPlan((d) => { steps(d).push({ p: "Then it ships." }); }, /What will happen, in order holds only steps, in the order they are built/);
  refusedPlan((d) => { section(d, "The whole thing").content.push({ step: structuredClone(step(d)) }); }, /a "step" stands under What will happen, in order/);
  // Plan changes sits second, so a returning author meets what changed first; the whole thing may draw its parts.
  const dir = repo();
  const data = plan();
  data.sections.splice(1, 0, { heading: "Plan changes", content: [{ h3: "1. One retry, not two (2026-11-02T10:00:00-05:00, Ana)" }, { p: "Why: Ana's call." }] });
  data.sections[0].content.push({ chart: { title: "The parts", steps: [{ text: "Export worker: asks the warehouse, and once more on a timeout", kind: "start", mark: "~" }] } });
  write(dir, data);
  const run = draw(dir, "plan", "docs/plans/retry.json", "--out", path.join(dir, "page.html"));
  assert.equal(run.status, 0, run.stderr);
  refusedPlan((d) => { d.sections[0].content.push({ p: "More." }); }, /The whole thing holds its "whole" and, when the change adds or connects parts, one "chart" of the parts, and nothing else/);
});

test("a plan has one whole, first, with the keys it requires and one plan here on its map", () => {
  const whole = (d) => d.sections[0].content[0].whole;
  refusedPlan((d) => { delete whole(d).out; }, /whole needs "out"/);
  refusedPlan((d) => { delete whole(d).problem; }, /whole needs "problem"/);
  refusedPlan((d) => { whole(d).pace = "build"; }, /"pace" is not a key here/);
  refusedPlan((d) => { whole(d).learn = ["a"]; }, /"learn" is not a key here/);
  refusedPlan((d) => { whole(d).map = [{ text: "This plan" }, { text: "The next" }]; }, /"map" marks exactly one plan, this one, with "here": true/);
  refusedPlan((d) => { d.sections[0].content.unshift({ chart: { steps: [{ text: "A part", kind: "start" }] } }); }, /"whole" is the first item of The whole thing/);
  refusedPlan((d) => { d.sections[0].content.splice(0, 1, { p: "No whole." }); }, /a plan has one "whole"; this one has 0/);
});

test("a step has its picture, gist, how and see; a short gist; a full trade-off that costs something; and the unknown on one step", () => {
  refusedPlan((d) => { delete step(d).shows; }, /step needs "shows"/);
  refusedPlan((d) => { delete step(d).how; }, /step needs "how"/);
  refusedPlan((d) => { delete step(d).see; }, /step needs "see"/);
  refusedPlan((d) => { delete step(d).trade.costs; }, /trade needs "costs"/);
  refusedPlan((d) => { step(d).trade.costs = "Nothing"; }, (file) => new RegExp(`line ${lineOf(file, '"costs": "Nothing"')}: a trade-off's "costs" says what the choice costs`));
  refusedPlan((d) => { step(d).gist = Array.from({ length: 51 }, () => "word").join(" "); }, /a step's "gist" is 50 words or fewer, a sentence or two; this one is 51/);
  refusedPlan((d) => { step(d).how.more = [{ h3: "A subheading" }]; }, /each item of a step's "more" is one of/);
  refusedPlan((d) => { step(d).cases.push({ case: step(d).cases[1] }); }, /"case" is not a key here; sections\.1\.content\.0\.step\.cases\.2 takes "title"/);
  refusedPlan((d) => { d.sections[1].content = []; }, /a plan has at least one "step"/);
  refusedPlan((d) => { step(d).unknown = true; }, /"unknown": true marks the step that tests "whole"'s "unknown", and "whole" has none/);
  refusedPlan((d) => { d.sections[0].content[0].whole.unknown = "Whether the warehouse answers a retry. Step 1 tests it."; }, /exactly one step carries "unknown": true; 0 do/);
  // A step without a label is named by its title on the line of all steps, and one without a trade-off has no row for one.
  const html = drawnPlan((_, d) => { delete step(d).label; delete step(d).trade; delete step(d).caption; });
  assert.ok(html.includes('<ol class="storyline"><li><a href="#step-1"><span class="n">1</span> Retry a timed-out export once</a></li></ol>'));
  assert.ok(!html.includes('id="h-every-trade-off"'));
  assert.ok(!html.includes('class="cap"'));
});

test("how a step works is drawn: frames that each hold a picture, a short caption and a few notes, or a chart; then what decides and where it goes wrong", () => {
  const how = (d) => step(d).how;
  const words = (n) => Array.from({ length: n }, () => "word").join(" ");
  const frame = (text = "A moment.") => ({ shows: { html: ["<b>x</b>"] }, text });
  const charted = { steps: [{ text: "The export asks for order 1042", kind: "start", shows: { html: ["<b>order 1042</b>"] } }, { text: "It asks once more", result: "ok" }] };
  refusedPlan((d) => { how(d).chart = charted; }, /"how" draws how the step works: as "frames", or as a "chart" when it branches, and never both/);
  refusedPlan((d) => { delete how(d).frames; }, /"how" draws how the step works: as "frames", or as a "chart"/);
  refusedPlan((d) => { how(d).frames = [frame()]; }, /"frames" holds 2 to 8 frames, the example at each moment of the step; this one holds 1/);
  refusedPlan((d) => { how(d).frames = Array.from({ length: 9 }, () => frame()); }, /this one holds 9\. A step that needs more is two steps/);
  refusedPlan((d) => { delete how(d).frames[0].shows; }, /needs "shows"/);
  refusedPlan((d) => { how(d).frames[0].text = words(26); }, /a frame's caption is 25 words or fewer: the picture carries the rest; this one is 26/);
  refusedPlan((d) => { how(d).frames[0].notes = ["a", "b", "c", "d"]; }, /a frame carries at most 3 notes; this one carries 4/);
  refusedPlan((d) => { how(d).frames[0].notes = [words(26)]; }, /a frame's note is 25 words or fewer; one here is 26/);
  refusedPlan((d) => { delete how(d).breaks; }, /how needs "breaks"/);
  refusedPlan((d) => { how(d).breaks = words(41); }, /"breaks" says where the step goes wrong first in 40 words or fewer; this one is 41/);
  refusedPlan((d) => { how(d).decides[0].decides = words(21); }, /each text of "decides" is 20 words or fewer/);
  // No paragraph: what one would say goes on the frame it belongs to, and what is left is a list, a table or a chart.
  refusedPlan((d) => { how(d).more = [{ p: "A paragraph." }]; }, /what a paragraph would say goes on the frame it belongs to, as its "notes"/);
  refusedPlan((d) => { how(d).more = [{ list: [words(31)] }]; }, /each item of a list and each cell of a table under "more" is 30 words or fewer; one here is 31/);
  refusedPlan((d) => { how(d).more = [{ table: { head: ["A"], rows: [[words(31)]] } }]; }, /under "more" is 30 words or fewer/);
  // A step that branches draws a chart, the example pictured on it.
  refusedPlan((d) => { delete how(d).frames; how(d).chart = { steps: charted.steps.map(({ shows, ...rest }) => rest) }; }, /a "how" drawn as a chart shows the example on at least one of its steps, as a picture/);
  refusedPlan((d) => { delete how(d).frames; how(d).chart = { steps: [{ ...charted.steps[0], text: words(26) }] }; }, /a step of a "how" chart is 25 words or fewer/);
  const chart = drawnPlan((_, d) => { delete how(d).frames; how(d).chart = charted; });
  assert.ok(chart.includes('<div class="tech"><h4>How it works</h4><figure><div class="chart">'));
  const html = drawnPlan((_, d) => { how(d).more = [{ list: ["One more thing."] }]; });
  const tech = html.slice(html.indexOf('<div class="tech">'), html.indexOf('<div class="step-cases">'));
  for (const part of [
    '<h4>How it works</h4><ol class="frames"><li class="frame cell"><div class="fhead"><span class="fn">1</span><span class="part">The export</span></div><div class="fpic"><div class="pic"><b>order 1042</b> · asked at 09:00:00</div></div><div class="fwords"><p class="fcap">The export asks for order 1042 and waits.</p></div>',
    '<li class="frame cell"><div class="fhead"><span class="fn">2</span>',
    '<ul class="fnotes"><li>Any other failure is reported at once.</li></ul></div>',
    '</ol><div class="pic-src">Pictures drawn for this page</div><div class="tablewrap decides"><table><thead><tr><th>The number</th><th>What it decides</th></tr></thead><tbody><tr><td>30 seconds</td><td>How long it waits before it asks again</td></tr></tbody></table></div>',
    '<p class="breaks"><strong>Where it goes wrong first:</strong> A slow spell longer than a minute: the one retry fails too.</p><div class="more-how"><h5>More detail</h5><ul class="prose"><li>One more thing.</li></ul></div>',
  ]) assert.ok(tech.includes(part), part);
  assert.ok(!tech.includes("<p class=\"prose\""), "how it works holds no paragraph");
});

test("the gist alone and the whole page are timed at 230 words a minute, leaving out pictures, Names and Claude's folded calls", () => {
  const long = (n) => Array.from({ length: n }, () => "word").join(" ");
  const counts = (change) => {
    const dir = repo();
    const data = plan();
    change(data);
    write(dir, data);
    const run = draw(dir, "plan", "docs/plans/retry.json", "--out", path.join(dir, "page.html"));
    assert.equal(run.status, 0, run.stderr);
    return JSON.parse(run.stdout);
  };
  const base = counts(() => {});
  // How a step works counts toward the whole page, not the gist; there is no limit on either.
  const technical = counts((d) => { step(d).how.more = [{ list: Array.from({ length: 92 }, () => long(25)) }]; });
  assert.equal(technical.gist, base.gist);
  assert.equal(technical.minutes, base.minutes + 10);
  // Names, a picture's words and a folded call of Claude's are not read through, so they count for nothing.
  const left = counts((d) => {
    d.sections.push({ heading: "Names", content: [{ names: [{ name: "export", text: long(5000) }] }] });
    caseCols(d)[1].steps[2].shows = { html: [`<p>${long(5000)}</p>`] };
    settledOf(d).push({ who: "Claude", how: "claude", text: long(5000), alternatives: ["Another"] });
  });
  assert.deepEqual([left.gist, left.minutes], [base.gist, base.minutes]);
});

test("each question for the author sits in its step, says what decides it, and makes its step's trade-off the author's", () => {
  const choice = (number) => ({
    number, question: `Question ${number}: is a timed-out export retried?`, today: [{ text: `Ana's export ${number} times out`, kind: "start", shows: shown }], recommended: "Once", alternatives: ["Never"],
    options: [{ name: "Retry once", steps: [{ text: "One retry", kind: "start" }] }, { name: "Don't retry", steps: [{ text: "No retry", kind: "start" }] }],
    why: "One retry catches most timeouts.", decides: "How long the warehouse stays slow.",
  });
  refusedPlan((d) => { askAuthor(d, choice(1)); delete choiceOf(d).decides; }, /a plan's question for the author says in "decides" what about the author's situation makes each option the right one/);
  refusedPlan((d) => { askAuthor(d, choice(1), choice(1)); }, /two questions are numbered 1/);
  refusedPlan((d) => { askAuthor(d, { ...choice(1), hold: true }); }, /"hold" is not a key here/);
  refusedPlan((d) => { d.sections[1].content.push({ choice: choice(2) }); }, /a plan's question for the author sits in the "choices" of the step it belongs to/);
  const html = drawnPlan((_, d) => { askAuthor(d, choice(1)); delete step(d).trade; });
  assert.ok(html.includes('<li class="mine"><a href="#step-1">'));
  assert.ok(html.includes('<span class="tag mine">Your call · question 1</span>'));
  const card = html.slice(html.indexOf('id="q-1"'));
  assert.ok(card.indexOf("What decides it") < card.indexOf('class="picks"'));
  assert.ok(card.includes('<span class="tag rec">recommended</span> Retry once'));
  assert.ok(html.includes('<tr class="mine"><td>1</td><td colspan="3"><a href="#step-1">Your call: question 1</a></td></tr>'));
});

test("on a plan, one or two of Claude's calls say what would make them wrong, drawn first, and its other calls fold under a line counting them", () => {
  refusedPlan((d) => { delete settledOf(d)[1].wrongIf; }, /one or two of Claude's calls, those most likely to be wrong, say in "wrongIf" what would make them wrong/);
  const call = (text) => ({ who: "Claude", how: "claude", text, alternatives: ["Not so"], wrongIf: "Ana says otherwise" });
  refusedPlan((d) => { settledOf(d).push(call("Two"), call("Three")); }, /one or two of Claude's calls carry "wrongIf"; 3 do/);
  refusedPlan((d) => { settledOf(d)[0].wrongIf = "Never"; }, /only Claude's call takes "wrongIf"/);
  const html = drawnPlan((_, d) => { settledOf(d).push({ who: "Claude", how: "claude", text: "Log each retry", alternatives: ["Log nothing"] }, { who: "Claude", how: "claude", text: "Name the file by its order", alternatives: ["Name it by the day"] }); });
  const settled = html.slice(html.indexOf("Calls most likely to be wrong"));
  const order = ["Wait 30 seconds before the retry", "<summary>Claude's other 2 calls, each yours to flip</summary>", "Log each retry", "Retry only a timeout"].map((w) => settled.indexOf(w));
  assert.ok(order.every((at) => at >= 0), `each is drawn: ${order}`);
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.ok(settled.includes('<p class="wrong-if"><strong>Wrong if:</strong> The warehouse is slow for longer than a minute</p>'));
  // The calls keep the numbers the file gives them, however the page groups them.
  assert.ok(settled.includes('data-line="call 2 B"><span class="letter">B</span><span>Log nothing</span>'));
  assert.equal(html.split('<div class="flipped-line">').length - 1, 1);
});

const WHERE = { where: "orders.ts", name: "exportOrder", does: "Catches the timeout and asks once more" };
test("the build holds one item a step started, every one done but the last, and each step draws where the build stands at it", () => {
  const second = (d) => steps(d).push({ step: { title: "Say how many tries it took", shows: { html: ["<b>2 tries</b>"] }, gist: "The file's name says how many tries it took.", how: { frames: [{ shows: { html: ["<b>1 try</b>"] }, text: "Count each try." }, { shows: { html: ["order-1042 (2 tries).csv"] }, text: "Put the count in the file's name." }], breaks: "A try that never ends is never counted." }, see: "Exported after 2 tries" } });
  refusedPlan((d) => { d.build = [{ state: "done", saw: "x", code: [WHERE] }, { state: "now" }]; }, /"build" has 2 items and the plan 1 steps/);
  refusedPlan((d) => { second(d); d.build = [{ state: "now" }, { state: "now" }]; }, /every step of "build" but the last is "done"/);
  refusedPlan((d) => { d.build = [{ state: "done" }]; }, /a done step says in "saw" what it showed/);
  refusedPlan((d) => { d.build = [{ state: "done", saw: "x", code: [WHERE], causes: [{ text: "a", check: "b" }] }]; }, /only a stopped step has "causes"/);
  refusedPlan((d) => { d.build = [{ state: "stopped", saw: "x", guess: "The clock" }]; }, /"guess" is not a key here/);
  refusedPlan((d) => { d.build = [{ state: "done", saw: "x", said: "s" }]; }, /"said" is not a key here/);
  // A done step points to its code: a file of the repository as it stands now, and a name inside it.
  refusedPlan((d) => { d.build = [{ state: "done", saw: "x" }]; }, /a done step says in "code" where its code is/);
  refusedPlan((d) => { d.build = [{ state: "done", saw: "x", code: [] }]; }, /a done step says in "code" where its code is/);
  refusedPlan((d) => { d.build = [{ state: "done", saw: "x", code: [{ where: "orders.ts" }] }]; }, /needs "does"/);
  refusedPlan((d) => { d.build = [{ state: "done", saw: "x", code: [{ ...WHERE, where: "exports.ts" }] }]; }, /there is no exports\.ts/);
  refusedPlan((d) => { d.build = [{ state: "done", saw: "x", code: [{ ...WHERE, where: "../orders.ts" }] }]; }, /there is no \.\.\/orders\.ts/);
  refusedPlan((d) => { d.build = [{ state: "done", saw: "x", code: [{ ...WHERE, where: "docs/plans/retry.json", name: undefined }] }]; }, /outside docs\/plans/);
  refusedPlan((d) => { d.build = [{ state: "done", saw: "x", code: [{ ...WHERE, name: "retryExport" }] }]; }, /orders\.ts holds no retryExport/);
  refusedPlan((d) => { d.build = [{ state: "done", saw: "x", code: [{ ...WHERE, name: "Order" }] }]; }, /orders\.ts holds no Order: "name" is a function or class in that file/);
  refusedPlan((d) => { d.build = [{ state: "waiting" }]; }, /"state" is "now", "done", "stopped"/);
  const html = drawnPlan((_, d) => {
    second(d);
    d.build = [{ state: "done", saw: "order-1042.csv after one retry", found: "The warehouse answers within 40 seconds", code: [WHERE, { where: "orders.ts", does: "Holds the export" }] }, { state: "stopped", saw: "Exported, with no count of tries", causes: [{ text: "The count is not kept", check: "Print the count after the retry" }] }];
  });
  assert.ok(!html.includes("buildband") && !html.includes("The build so far"), "the build is drawn on the steps, not in a band of its own");
  assert.ok(html.includes('<h3>Retry a timed-out export once <span class="state done">Done</span></h3>'));
  assert.ok(html.includes('<div class="seesaw"><div><span class="lbl">Promised</span>order-1042.csv after one retry</div><div><span class="lbl">Showed</span>order-1042.csv after one retry</div></div><p class="found"><strong>Found:</strong> The warehouse answers within 40 seconds</p><div class="tech built"><h4>Where it is in the code</h4><ul><li><code>orders.ts</code> · <code>exportOrder</code> <span class="does">Catches the timeout and asks once more</span></li><li><code>orders.ts</code> <span class="does">Holds the export</span></li></ul></div>'));
  const stopped = html.slice(html.indexOf('<li class="step stopped" id="step-2">'));
  assert.ok(stopped.includes('<span class="state stopped">Stopped for you</span>'));
  assert.ok(stopped.includes('<div class="causes"><h4>What may have caused it, the cheapest to check first</h4><ol><li>The count is not kept <span class="check">Check: Print the count after the retry</span></li></ol></div><div class="step-say" data-prefix="step 2">'));
  assert.ok(stopped.includes('<textarea rows="3" aria-label="Your words on step 2"></textarea><div class="say-go"><button type="button" class="step-btn" disabled>Send</button></div>'));
  assert.equal(html.split('class="step-say"').length - 1, 1, "only the stopped step has a box");
  // Every box gives the chat its own prefix and the author's words, the way a choice gives its answer.
  const script = html.slice(html.indexOf("<script>"));
  assert.ok(script.includes("give(`${box.dataset.prefix}: ${words}`"));
  // Before the build starts, each step says what the author will see, and carries no state.
  const before = drawnPlan(() => {});
  assert.ok(before.includes('<p class="see"><strong>You will see:</strong> order-1042.csv after one retry</p>'));
  assert.ok(!before.includes('class="state'));
});

test("once every step is done the page asks the author to tell it back after the last step, and once they have, draws their account there", () => {
  const done = [{ state: "done", saw: "order-1042.csv after one retry", code: [WHERE] }];
  const told = { at: "2026-11-21T16:40:00-05:00", said: "It tries a timed-out export once more after 30 seconds.", right: ["Why one retry is enough"], missed: ["What waiting costs Ana: 30 seconds more on a slow day"] };
  refusedPlan((d) => { d.told = told; }, /"told" is there only once every step is "done"/);
  refusedPlan((d) => { d.build = done; d.told = { ...told, at: "2026-11-21" }; }, /"at" is the moment it was told/);
  refusedPlan((d) => { d.build = done; d.told = { ...told, missed: ["a", "b", "c", "d"] }; }, /"missed" holds at most three; this one holds 4/);
  refusedPlan((d) => { d.build = done; d.told = { at: told.at }; }, /told needs "said"/);
  const asking = drawnPlan((_, d) => { d.build = done; });
  const tell = asking.indexOf('<div class="say tell" data-prefix="told"><h3>Tell it back</h3><p class="qt">Explain what was built, as you would to a colleague: what it does, how it is built, what was chosen over what and why, what that cost, and what you would do differently.</p><textarea');
  assert.ok(tell > asking.indexOf("Every trade-off, in the order it is made") && tell < asking.indexOf("Already settled</h2>"), "after the last step and its trade-offs");
  const answered = drawnPlan((_, d) => { d.build = done; d.told = told; });
  assert.ok(!answered.includes('data-prefix="told"'));
  assert.ok(answered.includes('<div class="told"><h3>You told it back</h3><p class="desc">2026-11-21 16:40:00 -05:00</p><blockquote>It tries a timed-out export once more after 30 seconds.</blockquote><h4>What it had right</h4><ul><li>Why one retry is enough</li></ul><h4>What it missed</h4><ul><li>What waiting costs Ana: 30 seconds more on a slow day</li></ul></div>'));
  // Neither the build nor the account is part of what the author approved.
  const dir = repo();
  write(dir, plan());
  const fp = draw(dir, "fingerprint", "docs/plans/retry.json").stdout.trim();
  write(dir, { ...plan(), build: done, told });
  assert.equal(draw(dir, "fingerprint", "docs/plans/retry.json").stdout.trim(), fp);
});

test("an explanation takes none of a plan's own items, and draws a name's usual name beside it", () => {
  const explained = (change) => {
    const data = JSON.parse(readFileSync(path.join(here, "fixtures/explain.json"), "utf8"));
    change(data);
    return drawn(formatJson(data));
  };
  const first = (d) => d.sections.find((s) => s.heading === "What I'm asking").content;
  const choice = (d) => d.sections.flatMap((s) => s.content).find((n) => n.choice).choice;
  const cases = [
    [(d) => { d.build = [{ state: "now" }]; }, /only a plan has a "build"/],
    [(d) => { d.told = { at: "2026-11-21T16:40:00-05:00", said: "s" }; }, /only a plan has a "told"/],
    [(d) => { first(d).push({ step: { title: "t", shows: { html: ["<b>x</b>"] }, gist: "g", how: { frames: [{ shows: { html: ["<b>x</b>"] }, text: "a" }, { shows: { html: ["<b>y</b>"] }, text: "b" }], breaks: "c" }, see: "s" } }); }, /only a plan has a "step"/],
    [(d) => { first(d).push({ whole: { problem: "p", gets: "g", shows: { html: ["<b>x</b>"] }, for: "f", in: "i", out: "o", assumes: "a", asking: "a" } }); }, /only a plan has a "whole"/],
    [(d) => { choice(d).decides = "What would change it"; }, /only a plan's question for the author takes "decides"/],
    [(d) => { d.sections.push({ heading: "Already settled", content: [{ settled: [{ who: "Claude", how: "claude", text: "t", alternatives: ["u"], wrongIf: "w" }] }] }); }, /only a plan's call takes "wrongIf"/],
  ];
  for (const [change, message] of cases) {
    const { run } = explained(change);
    assert.equal(run.status, 1, String(message));
    assert.match(run.stderr, message);
  }
  const { run, html } = explained((d) => { d.sections.at(-1).content[0].names[1].usual = "inventory service"; });
  assert.equal(run.status, 0, run.stderr);
  assert.ok(html.includes('<dd><span class="usual">The field calls it <b>inventory service</b></span> the service that holds stock'));
  assert.ok(!html.includes('class="seg"'), "an explanation has no switch");
});
