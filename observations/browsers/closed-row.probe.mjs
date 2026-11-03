/* global console, fetch, process, WebSocket */
// Draws a plan with page.mjs, adds a script that follows the page's own links and clicks a row's line, and prints what
// each browser did: Chrome, the Mac's WebKit in a WKWebView, and Safari itself once its Settings allow remote automation
// (Developer section). Chrome then takes real wheel, key and mouse input, which a page's own script can't send. macOS
// only, on Node 22 or later; nothing is installed, and no setting or profile of the person's is touched.
//   node observations/browsers/closed-row.probe.mjs
import { execFile, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const scratch = realpathSync(mkdtempSync(path.join(os.tmpdir(), "closed-row-")));
const git = (...args) => run("git", ["-C", scratch, ...args]);

// A screen, one row taller than the screen, one more below it, and enough between the links and the rows that each link
// scrolls.
const plan = {
  title: "Export an order",
  sections: [
    { heading: "What I'm asking", content: [{ p: "Approve it." }] },
    { heading: "What you'd see", content: [{ screens: { title: "Exporting an order", columns: [{ title: "After", steps: [{ text: "It tries again", change: "Retry once" }] }] } }] },
    { heading: "Check your reading", content: [
      { question: { question: "Where does it start?", options: ["At Export", "At Import", "At Print"], answer: "A", read: "Export an order", why: "It starts there." } },
      { question: { question: "What loads the order?", options: ["exportOrder", "loadOrder", "Nothing"], answer: "B", read: "loadOrder", why: "That step does." } },
    ] },
    { heading: "What this rests on", content: [
      { table: { head: ["The plan rests on", "How it was proved", "Where"], rows: [["An order loads", "Read it", "loadOrder"]] } },
      ...Array.from({ length: 80 }, (_, k) => ({ p: `Line ${k + 1} between the links and the rows.` })),
    ] },
    { heading: "The changes and why", content: [{ changes: [{ title: "Retry once", gets: "A file", why: "It is slow" }] }] },
    { heading: "How it's built", content: [
      { flow: { name: "Export an order", steps: [
        { keyword: "Starts", text: "Ana presses Export", where: "exportOrder" },
        ...Array.from({ length: 40 }, (_, k) => ({ keyword: "Step", text: `Do part ${k + 1}`, ...(k === 30 ? { change: "Retry once" } : {}) })),
        { keyword: "Returns", text: "the file" },
      ] } },
      { flow: { name: "Load an order", steps: [{ keyword: "Starts", text: "Ana opens an order" }, { keyword: "Step", text: "Load the order", where: "loadOrder" }] } },
    ] },
    { heading: "Names", content: [{ names: [{ name: "step", text: "one thing a flow does" }] }] },
  ],
};

const checks = `
(async () => {
  const wait = (ms) => new Promise((done) => setTimeout(done, ms));
  const settled = async () => {
    let last = scrollY, still = 0;
    for (let k = 0; k < 100 && still < 15; k++) {
      await wait(100);
      still = scrollY === last ? still + 1 : 0;
      last = scrollY;
    }
  };
  const inView = (el) => {
    const at = el.getBoundingClientRect();
    return at.top >= 0 && at.bottom <= innerHeight;
  };
  const rows = [...document.querySelectorAll("details.flowbox")];
  const back = document.querySelector("button.back");
  const closeAll = () => rows.forEach((row) => { row.open = false; });
  const [toRow, toStep] = [...document.querySelectorAll(".qz .hint a:not(.term)")];
  const toFlow = document.querySelector("a.to-flow");
  const row = rows[0];
  const step = document.getElementById(toStep.getAttribute("href").slice(1));
  const modal = document.querySelector("dialog.flow-modal");
  const body = modal.querySelector(".modal-body");
  const inModal = (el) => {
    const at = el.getBoundingClientRect();
    const box = body.getBoundingClientRect();
    return at.top >= box.top && at.bottom <= box.bottom;
  };
  // Clicks a link with it in view, and says whether the page stayed where it was.
  const follow = async (link) => {
    link.scrollIntoView({ block: "center", behavior: "instant" });
    await wait(100);
    const y = scrollY;
    link.click();
    await wait(200);
    return () => scrollY === y;
  };
  const out = { pageHidden: document.hidden, closedAtLoad: rows.every((r) => !r.open) };

  let stayed = await follow(toRow);
  const ids = [...document.querySelectorAll("[id]")].map((el) => el.id);
  out.linkToRow = {
    modalOpen: modal.open,
    rowStaysClosed: !row.open,
    pageStays: stayed(),
    nameInBar: modal.querySelector(".modal-title h3").textContent === row.querySelector("h3").textContent,
    wholeFlow: body.querySelectorAll(".n").length === row.querySelectorAll(".n").length,
    atTop: body.scrollTop === 0,
    stepLit: Boolean(body.querySelector(".hit")),
    idsUnique: new Set(ids).size === ids.length,
    focusInModal: modal.contains(document.activeElement),
  };
  modal.querySelector(".modal-close").click();
  await wait(100);
  out.closeButton = { closed: !modal.open, pageStays: stayed(), focusBack: document.activeElement === toRow };

  stayed = await follow(toStep);
  out.linkToStep = { modalOpen: modal.open, stepLit: Boolean(body.querySelector(".hit")), stepInView: inModal(body.querySelector(".hit")), rowStaysClosed: !step.closest("details").open, pageStays: stayed() };
  modal.click();
  await wait(100);
  out.clickOutside = { closed: !modal.open, pageStays: stayed(), focusBack: document.activeElement === toStep };

  stayed = await follow(toFlow);
  const lit = body.querySelector(".hit");
  out.screenLink = { modalOpen: modal.open, stepLit: Boolean(lit), stepInView: inModal(lit), scrolledToStep: body.scrollTop > 0, rowStaysClosed: !row.open, pageStays: stayed() };

  const term = body.querySelector("a.term");
  term.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }));
  const tip = document.querySelector(".tip");
  const tipAt = tip.getBoundingClientRect();
  const termAt = term.getBoundingClientRect();
  out.tipInModal = { shown: !tip.hidden, inModal: modal.contains(tip), besideName: Math.min(Math.abs(tipAt.top - termAt.bottom), Math.abs(termAt.top - tipAt.bottom)) <= 8 };
  body.click();

  const comment = body.querySelector("button.cmt");
  comment.click();
  const commentShown = Boolean(comment.closest(".cell").querySelector(".cmt-box"));
  modal.close();
  await wait(100);
  stayed = await follow(toFlow);
  out.commentInCopy = { shown: commentShown, keptOnReopening: Boolean(body.querySelector(".cmt-box")), notOnPage: !row.querySelector(".cmt-box") };

  const name = document.getElementById(body.querySelector("a.term").getAttribute("href").slice(1));
  body.querySelector("a.term").click();
  await settled();
  out.linkOutOfModal = { closed: !modal.open, targetInView: inView(name), backShown: !back.hidden };
  back.click();
  await settled();
  out.backToOpener = { linkInView: inView(toFlow), focused: document.activeElement === toFlow };

  closeAll();
  row.open = true;
  const inRow = row.querySelector(".chart a.term");
  inRow.scrollIntoView({ block: "center", behavior: "instant" });
  await wait(100);
  inRow.click();
  await settled();
  row.open = false;
  back.click();
  await settled();
  out.backIntoClosedRow = { reopened: row.open, linkInView: inView(inRow) };

  closeAll();
  row.querySelector(".row-meta span").click();
  const opens = row.open;
  row.querySelector("h3").click();
  out.clickOnLine = { opens, closes: !row.open };

  closeAll();
  const seenIn = row.querySelector("summary a");
  const screen = document.getElementById(seenIn.getAttribute("href").slice(1));
  seenIn.scrollIntoView({ block: "center", behavior: "instant" });
  await wait(100);
  seenIn.click();
  await settled();
  const rowStaysClosed = !row.open;
  const screenInView = inView(screen);
  back.click();
  await settled();
  out.seenInLink = { rowStaysClosed, screenInView, backLeavesRowClosed: !row.open };

  out.namesOnLine = document.querySelectorAll("summary a.term").length;
  out.namesInChart = document.querySelectorAll("details.flowbox .chart a.term").length > 0;
  await fetch("/", { method: "POST", body: JSON.stringify(out) });
  document.title = "DONE";
})();
`;

// What the page next reports to this probe's server: the checks' answer.
let report;
const reported = () => new Promise((done, fail) => {
  report = done;
  setTimeout(() => fail(new Error("the page never finished its checks")), 90000).unref();
});

// A real wheel, Esc and click outside on the modal, through Chrome's debugging port.
async function realInput(port, url) {
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const socket = new WebSocket(pages.find((page) => page.url === url).webSocketDebuggerUrl);
  await new Promise((done) => { socket.onopen = done; });
  const replies = new Map();
  socket.onmessage = (message) => {
    const { id, result } = JSON.parse(message.data);
    if (id) replies.get(id)(result);
  };
  let last = 0;
  const send = (method, params) => new Promise((done) => {
    replies.set(++last, done);
    socket.send(JSON.stringify({ id: last, method, params }));
  });
  const wait = (ms) => new Promise((done) => setTimeout(done, ms));
  const read = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
  const wheel = async (x, y) => {
    await send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY: 600 });
    await wait(600);
  };
  const click = async (x, y) => {
    for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
    await wait(400);
  };
  const esc = async () => {
    for (const type of ["keyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { type, key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await wait(400);
  };
  const state = () => read(`({ open: document.querySelector("dialog.flow-modal").open, y: scrollY, flow: document.querySelector(".modal-body").scrollTop, focusBack: document.activeElement === document.querySelector("a.to-flow") })`);
  const link = await read(`(async () => {
    const a = document.querySelector("a.to-flow");
    a.scrollIntoView({ block: "center", behavior: "instant" });
    await new Promise((done) => setTimeout(done, 150));
    const at = a.getBoundingClientRect();
    return { x: at.left + at.width / 2, y: at.top + at.height / 2 };
  })()`);
  const out = {};
  await click(link.x, link.y);
  const opened = await state();
  await wheel(20, 400);
  out.wheelOnDimmedPage = { pageStays: (await state()).y === opened.y };
  await wheel(640, 400);
  const scrolled = await state();
  out.wheelOnFlow = { flowMoves: scrolled.flow > opened.flow, pageStays: scrolled.y === opened.y };
  await esc();
  const escaped = await state();
  out.esc = { closed: !escaped.open, pageStays: escaped.y === opened.y, focusBack: escaped.focusBack };
  await click(link.x, link.y);
  await click(20, 400);
  const outside = await state();
  out.clickOutside = { closed: !outside.open, pageStays: outside.y === opened.y, focusBack: outside.focusBack };
  await wheel(640, 400);
  out.wheelAfterClosing = { pageMoves: (await state()).y !== opened.y };
  socket.close();
  return out;
}

async function chrome(url) {
  const bin = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const { stdout: version } = await run(bin, ["--version"]);
  const answer = reported();
  const port = 47614;
  // Real time, not the virtual time of --dump-dom, which never finishes a smooth scroll.
  const browser = spawn(bin, ["--headless=new", "--disable-gpu", "--no-first-run", `--user-data-dir=${path.join(scratch, "chrome")}`, `--remote-debugging-port=${port}`, "--window-size=1280,800", url], { stdio: "ignore" });
  try {
    const checks = await answer;
    return { name: version.trim(), ...checks, realInput: await realInput(port, url) };
  } finally {
    browser.kill();
  }
}

async function webkit(url) {
  const file = path.join(scratch, "webkit.js");
  writeFileSync(file, `
    ObjC.import("Cocoa");
    ObjC.import("WebKit");
    function run(argv) {
      // WebKit stops the timers of a page it thinks no one can see, as with the screen off or a window in front. Its two
      // private settings here keep them running.
      const app = $.NSApplication.sharedApplication;
      app.setActivationPolicy(1);
      app.finishLaunching;
      const frame = $.NSMakeRect(0, 0, 1280, 800);
      const window = $.NSWindow.alloc.initWithContentRectStyleMaskBackingDefer(frame, 0, 2, false);
      const configuration = $.WKWebViewConfiguration.alloc.init;
      configuration.preferences._setPageVisibilityBasedProcessSuppressionEnabled(false);
      configuration.preferences._setHiddenPageDOMTimerThrottlingEnabled(false);
      const view = $.WKWebView.alloc.initWithFrameConfiguration(frame, configuration);
      window.contentView = view;
      window.alphaValue = 0.01;
      window.ignoresMouseEvents = true;
      window.orderFrontRegardless;
      view.loadRequest($.NSURLRequest.requestWithURL($.NSURL.URLWithString(argv[0])));
      const stop = Date.now() + 90000;
      while (Date.now() < stop && view.title.js !== "DONE") {
        const event = app.nextEventMatchingMaskUntilDateInModeDequeue($.NSEventMaskAny, $.NSDate.dateWithTimeIntervalSinceNow(0.1), $.NSDefaultRunLoopMode, true);
        if (!event.isNil()) app.sendEvent(event);
      }
      return $.NSBundle.bundleWithIdentifier("com.apple.WebKit").infoDictionary.objectForKey("CFBundleVersion").js;
    }
  `);
  const answer = reported();
  const { stdout: version } = await run("osascript", ["-l", "JavaScript", file, url], { timeout: 100000 });
  return { name: `WebKit ${version.trim()} in a WKWebView`, ...(await answer) };
}

async function safari(url) {
  const port = 47613;
  const driver = spawn("safaridriver", ["-p", String(port)], { stdio: "ignore" });
  const call = async (method, where, body) => (await (await fetch(`http://localhost:${port}${where}`, { method, ...(body ? { body: JSON.stringify(body) } : {}) })).json()).value;
  try {
    await new Promise((done) => setTimeout(done, 1000));
    const session = await call("POST", "/session", { capabilities: { alwaysMatch: { browserName: "safari" } } });
    if (!session.sessionId) return { skipped: session.message };
    const at = `/session/${session.sessionId}`;
    await call("POST", `${at}/window/rect`, { width: 1280, height: 800 });
    const answer = reported();
    await call("POST", `${at}/url`, { url });
    const checks = await answer;
    const version = await call("POST", `${at}/execute/sync`, { script: "return /Version\\/([\\d.]+)/.exec(navigator.userAgent)[1];", args: [] });
    await call("DELETE", at);
    return { name: `Safari ${version}`, ...checks };
  } finally {
    driver.kill();
  }
}

mkdirSync(path.join(scratch, "docs/plans"), { recursive: true });
await git("init", "-q", "-b", "main");
await git("config", "user.email", "probe@example.com");
await git("config", "user.name", "Probe");
writeFileSync(path.join(scratch, "orders.ts"), "export function exportOrder() {}\nexport function loadOrder() {}\n");
await git("add", "orders.ts");
await git("commit", "-q", "-m", "orders");
const file = path.join(scratch, "docs/plans/closed-row.json");
writeFileSync(file, JSON.stringify(plan));
const page = path.join(scratch, "page.html");
await run(process.execPath, [path.join(here, "../../page/page.mjs"), "plan", file, "--whole", "--out", page]);
// A hidden page runs no smooth scroll, so it is asked for none, and the answer says it was hidden.
const still = `
if (document.hidden) {
  const real = window.matchMedia.bind(window);
  window.matchMedia = (query) => (query.includes("reduced-motion") ? { matches: true } : real(query));
}
`;
const html = readFileSync(page, "utf8")
  .replace("<script>", () => `<script>${still}</script>\n<script>`)
  .replace("</body>", () => `<script>${checks}</script>\n</body>`);

const server = createServer((request, response) => {
  if (request.method === "POST") {
    let body = "";
    request.on("data", (part) => { body += part; });
    request.on("end", () => {
      response.end();
      report(JSON.parse(body));
    });
    return;
  }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.end(html);
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const url = `http://127.0.0.1:${server.address().port}/`;
const seen = [];
for (const browser of [chrome, webkit, safari]) {
  const result = await browser(url);
  if (result.skipped) console.error(`${browser.name} skipped: ${result.skipped}`);
  else seen.push(result);
}
server.closeAllConnections();
server.close();
console.log(JSON.stringify(seen, null, 2));
