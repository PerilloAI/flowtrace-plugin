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
import { questionsFor } from "./check.mjs";
import { inline } from "./render.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, "page.mjs");

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
  sections: [
    { heading: "What I'm asking", content: [{ p: "Approve the retry. No questions are open." }] },
    { heading: "The case", content: [{ case: [{ p: "An export that times out fails today." }] }] },
    {
      heading: "What you'd see",
      content: [{
        screens: {
          title: "Exporting order 1042",
          columns: [
            { title: "Today", steps: [{ text: "Ana exports order 1042", kind: "start" }, { text: '"Export failed"', result: "bad" }] },
            { title: "After", steps: [{ text: "Ana exports order 1042", kind: "start" }, { text: "It tries once more", change: "Retry once", result: "ok" }] },
          ],
        },
      }],
    },
    {
      heading: "Check your reading",
      content: [
        { question: { question: "Ana's export times out twice. What does she see?", options: ["The file", '"Export failed"', "Nothing"], answer: "B", read: "How it's built", why: "It retries once." } },
        { question: { question: "Ben's order doesn't exist. What happens?", options: ['"Export failed" at once', "A retry after 30 seconds, then failure", "Endless retries"], answer: "A", read: "exportOrder", why: "Only a timeout is retried." } },
        { question: { question: "Cy's export finishes in 2 seconds. How many times is the warehouse asked?", options: ["Twice, to be sure", "Three times", "Once"], answer: "C", read: "Export an order", why: "Only a timeout asks again." } },
      ],
    },
    { heading: "What this rests on", content: [{ table: { head: ["The plan rests on", "How it was proved", "Where"], rows: [["Every export loads its order first", "Traced from the Export button", "exportOrder"]] } }] },
    { heading: "The changes and why", content: [{ changes: [{ title: "Retry once", gets: "Ana gets her file", why: "The warehouse is slow for a minute at a time" }] }] },
    {
      heading: "How it's built",
      content: [{
        flow: {
          name: "Export an order",
          steps: [
            { keyword: "Starts", text: "Ana presses Export", where: "exportOrder" },
            { keyword: "Step", text: "Load the order", where: "loadOrder" },
            {
              keyword: "Check", text: "Did the warehouse time out?", mark: "+",
              answers: [{ label: "yes", steps: [{ keyword: "Step", text: "Wait 30 seconds and try once more", mark: "+", change: "Retry once", lookClosely: [{ kind: "External call", text: "the warehouse is asked twice" }] }] }],
            },
            { keyword: "Returns", text: "the file" },
          ],
        },
      }],
    },
  ],
});

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
  assert.equal(result.changedSteps, 2);
  assert.equal(result.questions, 3);
  const html = readFileSync(out, "utf8");
  for (const words of ["Ana exports order 1042", "Check: Did the warehouse time out?", "Step: Load the order", "the warehouse is asked twice"]) {
    assert.ok(html.includes(words), words);
  }
  assert.match(html, /data-line="Approve plan [0-9a-f]{7}"/);
});

test("each option of a plan's question for the author is a button giving its number and letter", () => {
  const dir = repo();
  const data = plan();
  data.sections[0].content[0].p = "Approve the retry. 1 question is open.";
  data.sections.splice(4, 0, { heading: "Questions from plan-flows", content: [
    { p: "1 question. Pick an option to answer it." },
    { choice: {
      number: 1, question: "Ana's export times out twice. Is it retried again?", recommended: "No: one retry, then \"Export failed\"", alternatives: ["Yes: retry until it answers"],
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
  assert.match(html, /<button type="button" class="pick" aria-pressed="false" data-line="1 A"><span class="letter">A<\/span><span><span class="tag rec">recommended<\/span> <strong>No: one retry/);
  assert.match(html, /data-line="1 B"><span class="letter">B<\/span><span>Yes: retry until it answers<\/span>/);
  assert.match(html, /<p class="ask">Pick an option on each question to copy your answers/);
});

test("a step marked as existing whose name the code doesn't have stops the drawing, naming its line", () => {
  const dir = repo();
  const data = plan();
  data.sections[6].content[0].flow.steps[1].where = "loadOrders";
  const file = write(dir, data);
  const out = path.join(dir, "page.html");
  const run = draw(dir, "plan", "docs/plans/retry.json", "--out", out);
  assert.equal(run.status, 1);
  assert.match(run.stderr, new RegExp(`line ${lineOf(file, '"loadOrders"')}: "where": "loadOrders" is on a step marked as existing`));
  assert.equal(existsSync(out), false);
});

test("every broken rule is reported at once, each with its line", () => {
  const dir = repo();
  const data = plan();
  data.sections[2].content[0].screens.columns[1].steps[1].change = "Retry twice";
  data.sections[6].content[0].flow.steps[2].answers[0].steps[0].lookClosely[0].kind = "Slow";
  data.sections[3].content[0].question.options[2] = "The file";
  const file = write(dir, data);
  const run = draw(dir, "plan", "docs/plans/retry.json", "--out", path.join(dir, "page.html"));
  assert.equal(run.status, 1);
  assert.match(run.stderr, new RegExp(`line ${lineOf(file, "Retry twice")}: "change": "Retry twice" names no row`));
  assert.match(run.stderr, /Look closely's kind "Slow"/);
  assert.match(run.stderr, /three different options/);
});

test("the plan asks as many reading questions as its changed steps call for", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 8, 16, 32, 64, 500].map(questionsFor), [2, 2, 3, 3, 4, 5, 6, 7, 8, 8]);
  const dir = repo();
  const data = plan();
  data.sections[3].content.pop();
  write(dir, data);
  const run = draw(dir, "plan", "docs/plans/retry.json", "--out", path.join(dir, "page.html"));
  assert.match(run.stderr, /asks 2 reading questions, and its 2 changed steps call for 3/);
});

test("a plan names what it rests on, each premise with how it was proved and where", () => {
  const refused = (change, message) => {
    const dir = repo();
    const data = plan();
    change(data);
    write(dir, data);
    const run = draw(dir, "plan", "docs/plans/retry.json", "--out", path.join(dir, "page.html"));
    assert.equal(run.status, 1);
    assert.match(run.stderr, message);
  };
  refused((d) => d.sections.splice(4, 1), /a plan has a "What this rests on" section/);
  refused((d) => { d.sections[4].content = [{ p: "It rests on the code." }]; }, /a plan has a "What this rests on" section holding a table/);
  refused((d) => { d.sections[4].content[0].table.rows[0][1] = " "; }, /every premise under What this rests on says/);
});

test("the fingerprint leaves out approved, reviewPage and spacing, and a plan approved at it shows Approved", () => {
  const dir = repo();
  write(dir, plan());
  const fp = draw(dir, "fingerprint", "docs/plans/retry.json").stdout.trim();
  assert.match(fp, /^[0-9a-f]{7}$/);
  const file = path.join(dir, "docs/plans/retry.json");
  writeFileSync(file, JSON.stringify({ ...plan(), approved: `Ana · 2026-11-01 · ${fp}`, reviewPage: "https://example.com/p" }));
  assert.equal(draw(dir, "fingerprint", "docs/plans/retry.json").stdout.trim(), fp);
  const out = path.join(dir, "page.html");
  const run = draw(dir, "plan", "docs/plans/retry.json", "--out", out);
  assert.equal(JSON.parse(run.stdout).approved, true);
  const html = readFileSync(out, "utf8");
  assert.ok(html.includes('<span class="approved">Approved</span>'));
  assert.ok(!html.includes('class="approve-btn"'));
  assert.ok(!html.includes("https://example.com/p"));
});

test("a drawing outlines only what changed since the author last read the plan, and nothing before they have", () => {
  const dir = repo();
  write(dir, plan());
  const out = path.join(dir, "page.html");
  assert.equal(JSON.parse(draw(dir, "plan", "docs/plans/retry.json", "--out", out).stdout).outlined, 0);
  draw(dir, "seen", "docs/plans/retry.json");
  const data = plan();
  data.sections[6].content[0].flow.steps[1].text = "Load the order and its lines";
  data.sections[3].content[0].question.answer = "A";
  data.sections[3].content[0].question.options = ['"Export failed"', "The file", "Nothing"];
  write(dir, data);
  const run = draw(dir, "plan", "docs/plans/retry.json", "--out", out);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout).outlined, 2);
  const html = readFileSync(out, "utf8");
  assert.match(html, /class="n since">Step: Load the order and its lines/);
  assert.match(html, /Outlined: changed since the page you last read/);
});

// The page drawn once `change` has edited what the plan holds under How it's built, or anywhere else in it.
const drawnPlan = (change) => {
  const dir = repo();
  const data = plan();
  change(data.sections[6].content, data);
  write(dir, data);
  const out = path.join(dir, "page.html");
  const run = draw(dir, "plan", "docs/plans/retry.json", "--out", out);
  assert.equal(run.status, 0, run.stderr);
  return readFileSync(out, "utf8");
};

test("a plan's flow is a closed row whose line gives its name, its counts of marked steps and its number of steps", () => {
  const html = drawnPlan((content) => {
    const { steps } = content[0].flow;
    steps[1].mark = "~";
    steps[3].mark = "-";
  });
  assert.ok(html.includes('<details class="flowbox" id="f-export-an-order"><summary><h3>Export an order</h3><span class="row-meta"><span class="mk new">+2 new</span><span class="mk chg">~1 changed</span><span class="mk gone">−1 removed</span><span>5 steps</span><span>Seen in: <a href="#v-exporting-order-1042">Exporting order 1042</a></span></span></summary><figure>'));
});

test("a flow marked as a whole has its tag on its row's line, and no counts", () => {
  const html = drawnPlan((content) => {
    content.push({ flow: { name: "Import an order", mark: "+", steps: [{ keyword: "Starts", text: "Ana presses Import" }] } });
    content.push({ flow: { name: "Print an order", mark: "-", steps: [{ keyword: "Starts", text: "Ana presses Print" }, { keyword: "Returns", text: "the print" }] } });
  });
  assert.ok(html.includes('<summary><h3><span class="tag rec">new flow</span> Import an order</h3><span class="row-meta"><span>1 step</span><span>No screen links here</span></span></summary>'));
  assert.ok(html.includes('<summary><h3><span class="tag alt">removed flow</span> Print an order</h3><span class="row-meta"><span>2 steps</span><span>No screen links here</span></span></summary>'));
});

test("a flow with no marked step has only its number of steps on its row's line", () => {
  const html = drawnPlan((content) => {
    content.push({ flow: { name: "Load an order", steps: [{ keyword: "Starts", text: "Ana opens an order" }, { keyword: "Step", text: "Load the order" }, { keyword: "Returns", text: "the order" }] } });
  });
  assert.ok(html.includes('<summary><h3>Load an order</h3><span class="row-meta"><span>3 steps</span><span>No screen links here</span></span></summary>'));
});

test("Where to look reaches a closed row by its id, and a step's where by an id inside it", () => {
  const html = drawnPlan(() => {});
  assert.ok(html.includes('Where to look: <a href="#f-export-an-order">'));
  assert.ok(html.includes('Where to look: <a href="#w-exportorder">'));
  assert.ok(html.includes('<details class="flowbox" id="f-export-an-order">'));
  const row = html.slice(html.indexOf('<details class="flowbox"'), html.indexOf("</details>"));
  assert.ok(row.includes('id="w-exportorder"'));
});

test("in each browser tried, a link to a flow opens it in a modal over the page, and a row still opens in place", () => {
  const seen = observation("browsers/closed-row").evidence;
  assert.ok(seen.length >= 2);
  for (const browser of seen) {
    const { name, pageHidden: _, realInput: __, nameClick: ___, nameClickInModal: ____, changeClick: _____, changeClickInModal: ______, ...checks } = browser;
    assert.deepEqual(checks, {
      closedAtLoad: true,
      linkToRow: { modalOpen: true, rowStaysClosed: true, pageStays: true, nameInBar: true, wholeFlow: true, atTop: true, stepLit: false, idsUnique: true, focusInModal: true, focusOnFlow: true },
      closeButton: { closed: true, pageStays: true, focusBack: true },
      linkToStep: { modalOpen: true, stepLit: true, stepInView: true, rowStaysClosed: true, pageStays: true, focusOnStep: true },
      clickOutside: { closed: true, pageStays: true, focusBack: true },
      stepInWideChart: { scrolledSideways: true, inViewSideways: true, focusOnStep: true, pageStays: true },
      screenLink: { modalOpen: true, stepLit: true, stepInView: true, scrolledToStep: true, rowStaysClosed: true, pageStays: true },
      tipInModal: { shown: true, inModal: true, besideName: true },
      commentInCopy: { shown: true, keptOnReopening: true, notOnPage: true },
      linkOutOfModal: { closed: true, targetInView: true, backShown: true },
      backToOpener: { linkInView: true, focused: true },
      backIntoClosedRow: { reopened: true, linkInView: true },
      clickOnLine: { opens: true, closes: true },
      seenInLink: { rowStaysClosed: true, screenInView: true, backLeavesRowClosed: true },
      namesOnLine: 0,
      namesInChart: true,
    }, name);
  }
});

test("with real input in Chrome, Esc and a click outside close the modal, a drag let go outside doesn't, the keys scroll from the lit step, and only the flow scrolls while it is open", () => {
  const chrome = observation("browsers/closed-row").evidence.find((browser) => browser.realInput);
  const { nameClick: _, clickElsewhere: __, nameTap: ___, tapElsewhere: ____, tip: _____, changeClick: ______, changeClickElsewhere: _______, changeTip: ________, ...modal } = chrome.realInput;
  assert.deepEqual(modal, {
    wheelOnDimmedPage: { pageStays: true },
    wheelOnFlow: { flowMoves: true, pageStays: true },
    esc: { closed: true, pageStays: true, focusBack: true },
    clickOutside: { closed: true, pageStays: true, focusBack: true },
    keysOnLitStep: { focusOnStep: true, pageDownMovesFlow: true, pageStays: true },
    dragOutOfModal: { staysOpen: true, clickOutsideStillCloses: true },
    wheelAfterClosing: { pageMoves: true },
  });
});

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

test("in each browser tried, a click on a step's change shows its row beside it, and neither the page nor the modal moves", () => {
  const seen = observation("browsers/closed-row").evidence;
  assert.ok(seen.length >= 2);
  for (const browser of seen) {
    assert.deepEqual(browser.changeClick, { pageStays: true, tipShown: true, titleInTip: true, getsInTip: true, whyInTip: true, backStaysHidden: true, howItsBuiltUncovered: true, clickElsewhereCloses: true }, browser.name);
    assert.deepEqual(browser.changeClickInModal, { modalStays: true, flowStays: true, tipShown: true, rowInTip: true }, browser.name);
  }
});

test("with a real click in Chrome, a step's change shows its row, the page stays, and a click elsewhere closes it", () => {
  const { changeClick, changeClickElsewhere, changeTip } = observation("browsers/closed-row").evidence.find((browser) => browser.realInput).realInput;
  assert.deepEqual({ changeClick, changeClickElsewhere, changeTip }, {
    changeClick: { pageStays: true, tipShown: true, backStaysHidden: true },
    changeClickElsewhere: { tipHidden: true },
    changeTip: { linkInItFollowed: true, followingItClosesIt: true, howItsBuiltOpensOnFirstClick: true },
  });
});

test("a step's change names its row by id, for the page to show beside it", () => {
  const html = drawnPlan(() => {});
  assert.ok(html.includes('<a class="to-change" href="#c-retry-once">change: Retry once</a>'));
  assert.ok(html.includes('<tr id="c-retry-once">'));
});

test("a flow's modal is the script's, so a page where the script doesn't run has none", () => {
  const html = drawnPlan(() => {});
  assert.doesNotMatch(html.slice(0, html.indexOf("<script>")), /<dialog/);
});

test("a screen's step links to each flow naming its change, at the first step naming it there", () => {
  const html = drawnPlan((content) => {
    content[0].flow.steps[1].change = "Retry once";
    content.push({ flow: { name: "Retry a failed export", mark: "+", steps: [{ keyword: "Starts", text: "The retry timer fires", change: "Retry once" }] } });
  });
  const links = [...html.matchAll(/<a class="to-flow" href="#([^"]+)">([^<]+)<\/a>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(links, [["w-loadorder", "How it's built: Export an order"], ["w-retry-once", "How it's built: Retry a failed export"]]);
  assert.ok(html.includes('<div class="cell" id="w-retry-once"><div class="n start">Starts: The retry timer fires'));
  assert.ok(html.includes('<div class="cell" id="w-loadorder">'));
});

test("a chart's step naming a change gets no link to a flow, and doesn't put its chart on the flow's row", () => {
  const html = drawnPlan((_, data) => {
    data.sections[2].content.push({ trace: { title: "Ana's second try", steps: [{ text: "It tries once more", change: "Retry once" }] } });
  });
  assert.equal(html.split('class="to-flow"').length - 1, 1);
  assert.ok(html.includes('<span>Seen in: <a href="#v-exporting-order-1042">Exporting order 1042</a></span>'));
});

test("a flow's row lists each screen that links to it, once", () => {
  const html = drawnPlan((content, data) => {
    content[0].flow.steps[1].change = "Retry once";
    data.sections[2].content.push({ screens: { title: "Retrying an export", columns: [{ title: "After", steps: [{ text: "It tries again", change: "Retry once" }] }] } });
  });
  assert.ok(html.includes('<span>Seen in: <a href="#v-exporting-order-1042">Exporting order 1042</a>, <a href="#v-retrying-an-export">Retrying an export</a></span>'));
});

test("a link in a flow's name or a screen's title shows as its words inside the links to them, which can't hold another", () => {
  const html = drawnPlan((content, data) => {
    content.push({ flow: { name: "Retry, see [the docs](https://example.com/docs)", mark: "+", steps: [{ keyword: "Starts", text: "The retry timer fires", change: "Retry once" }] } });
    data.sections[2].content.push({ screens: { title: "Retrying, see [the docs](https://example.com/docs)", columns: [{ title: "After", steps: [{ text: "It tries again", change: "Retry once" }] }] } });
  });
  assert.ok(html.includes("How it's built: Retry, see the docs</a>"));
  assert.ok(html.includes(">Retrying, see the docs</a>"));
  assert.ok(html.includes('Retry, see <a href="https://example.com/docs">the docs</a></h3>'));
  assert.doesNotMatch(html, /<a [^>]*>[^<]*<a /);
});

test("a screen's step naming a change no flow's step names stops the drawing, naming its line", () => {
  const dir = repo();
  const data = plan();
  delete data.sections[6].content[0].flow.steps[2].answers[0].steps[0].change;
  const file = write(dir, data);
  const out = path.join(dir, "page.html");
  const run = draw(dir, "plan", "docs/plans/retry.json", "--out", out);
  assert.equal(run.status, 1);
  assert.match(run.stderr, new RegExp(`line ${lineOf(file, "It tries once more")}: "change": "Retry once" is on a screen's step, and no flow's step names it`));
  assert.equal(existsSync(out), false);
});

test("a screen's step naming a title no change has is told that once, not also that no flow names it", () => {
  const dir = repo();
  const data = plan();
  data.sections[2].content[0].screens.columns[1].steps[1].change = "Retry twice";
  write(dir, data);
  const run = draw(dir, "plan", "docs/plans/retry.json", "--out", path.join(dir, "page.html"));
  assert.equal(run.status, 1);
  assert.match(run.stderr, /"change": "Retry twice" names no row/);
  assert.doesNotMatch(run.stderr, /no flow's step names it/);
});

test("an explanation isn't held to its screen's change being on a flow's step", () => {
  const { run, html } = drawn(JSON.stringify({
    title: "A page",
    sections: [
      { heading: "What you'd see", content: [{ screens: { title: "Exporting", columns: [{ title: "After", steps: [{ text: "It tries again", change: "Retry once" }] }] } }] },
      { heading: "The changes", content: [{ changes: [{ title: "Retry once", gets: "A file", why: "It is slow" }] }] },
    ],
  }));
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(html, /class="to-flow"/);
});

test("an explanation's and a review's flows stay drawn in full", () => {
  for (const extra of [{}, { send: true }]) {
    const { run, html } = drawn(JSON.stringify({
      title: "A page", ...extra,
      sections: [{ heading: "How it's built", content: [{ flow: { name: "Export an order", steps: [{ keyword: "Starts", text: "Ana presses Export", mark: "+" }] } }] }],
    }));
    assert.equal(run.status, 0, run.stderr);
    assert.ok(html.includes('<section class="flowbox" id="f-export-an-order"><h3>Export an order</h3><figure>'));
    assert.ok(html.includes("Starts: Ana presses Export"));
    assert.doesNotMatch(html, /<details/);
  }
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

const reviewPage = (extra) => JSON.stringify({
  title: "A review", ...extra,
  sections: [{ heading: "Questions", content: [
    { question: { question: "Which?", options: ["one", "two", "three"], answer: "A", read: "Questions", why: "It is.", source: "map" } },
    { question: { question: "Which now?", options: ["one", "two", "three"], answer: "B", read: "Questions", why: "It is.", source: "test ran" } }
  ] }]
});
const drawn = (data) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "page-review-"));
  const file = path.join(dir, "review.json");
  writeFileSync(file, data);
  const run = spawnSync(process.execPath, [script, "explain", file, "--out", path.join(dir, "page.html")], { encoding: "utf8" });
  return { run, html: run.status === 0 ? readFileSync(path.join(dir, "page.html"), "utf8") : "" };
};

test("a page offers Send answers only when its data says so, and each question says where its answer came from", () => {
  const sent = drawn(reviewPage({ send: true }));
  assert.equal(sent.run.status, 0, sent.run.stderr);
  assert.match(sent.html, /<button type="button" id="send-answers">Send answers<\/button>/);
  assert.match(sent.html, /data-source="map"/);
  assert.match(sent.html, /<span class="src">· the map<\/span>/);
  assert.match(sent.html, /<span class="src">· test ran<\/span>/);
  const quiet = drawn(reviewPage({}));
  assert.equal(quiet.run.status, 0, quiet.run.stderr);
  assert.doesNotMatch(quiet.html, /<button type="button" id="send-answers"/);
});

test("a question's source is one of the four the page knows", () => {
  const { run } = drawn(reviewPage({}).replace('"map"', '"a guess"'));
  assert.equal(run.status, 1);
  assert.match(run.stderr, /"source" is one of map, test ran, test read, reading/);
});
