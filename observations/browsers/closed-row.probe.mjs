/* global console, fetch, process */
// Draws a plan with page.mjs, adds a script that follows the page's own links and clicks a row's line, and prints what
// each browser did: Chrome, the Mac's WebKit in a WKWebView, and Safari itself once its Settings allow remote automation
// (Developer section). macOS only; nothing is installed, and no setting or profile of the person's is touched.
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

// One row taller than the screen, one more below it, and enough between the links and the rows that each link scrolls.
const plan = {
  title: "Export an order",
  sections: [
    { heading: "What I'm asking", content: [{ p: "Approve it." }] },
    { heading: "Check your reading", content: [
      { question: { question: "Where does it start?", options: ["At Export", "At Import", "At Print"], answer: "A", read: "Export an order", why: "It starts there." } },
      { question: { question: "What loads the order?", options: ["exportOrder", "loadOrder", "Nothing"], answer: "B", read: "loadOrder", why: "That step does." } },
    ] },
    { heading: "What this rests on", content: [
      { table: { head: ["The plan rests on", "How it was proved", "Where"], rows: [["An order loads", "Read it", "loadOrder"]] } },
      ...Array.from({ length: 80 }, (_, k) => ({ p: `Line ${k + 1} between the links and the rows.` })),
    ] },
    { heading: "How it's built", content: [
      { flow: { name: "Export an order", steps: [
        { keyword: "Starts", text: "Ana presses Export", where: "exportOrder" },
        ...Array.from({ length: 40 }, (_, k) => ({ keyword: "Step", text: `Do part ${k + 1}` })),
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
  const row = rows[0];
  const step = document.getElementById(toStep.getAttribute("href").slice(1));
  const out = { closedAtLoad: rows.every((r) => !r.open) };

  toRow.click();
  await settled();
  out.linkToRow = { opened: row.open, lineInView: inView(row.querySelector("summary")), focused: document.activeElement === row, backShown: !back.hidden };
  back.click();
  await settled();
  out.backToLink = { linkInView: inView(toRow), rowStaysOpen: row.open };

  closeAll();
  toStep.click();
  await settled();
  out.linkIntoRow = { opened: step.closest("details").open, targetInView: inView(step), focused: document.activeElement === step };
  back.click();
  await settled();

  closeAll();
  row.open = true;
  const name = row.querySelector(".chart a.term");
  name.scrollIntoView({ block: "center", behavior: "instant" });
  await wait(100);
  name.click();
  await settled();
  row.open = false;
  back.click();
  await settled();
  out.backIntoClosedRow = { reopened: row.open, linkInView: inView(name) };

  closeAll();
  row.querySelector(".row-meta span").click();
  const opens = row.open;
  row.querySelector("h3").click();
  out.clickOnLine = { opens, closes: !row.open };
  out.namesOnLine = document.querySelectorAll("summary a.term").length;
  out.namesInChart = document.querySelectorAll("details.flowbox .chart a.term").length > 0;
  document.title = "DONE:" + JSON.stringify(out);
})();
`;

// Reads the title a browser's page ended on; the checks put their answer there.
const answer = (title) => JSON.parse(/DONE:(.*)/.exec(title)[1]);

// Chrome runs in real time, its title read off its debugging port, which escapes quotes: the virtual time --dump-dom needs
// never finishes a smooth scroll.
async function chrome(url) {
  const bin = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const { stdout: version } = await run(bin, ["--version"]);
  const port = 47614;
  const browser = spawn(bin, ["--headless=new", "--disable-gpu", "--no-first-run", `--user-data-dir=${path.join(scratch, "chrome")}`, `--remote-debugging-port=${port}`, "--window-size=1280,800", url], { stdio: "ignore" });
  try {
    const stop = Date.now() + 90000;
    while (Date.now() < stop) {
      await new Promise((done) => setTimeout(done, 500));
      const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json(), () => []);
      const page = pages.find((p) => p.title.startsWith("DONE:"));
      if (page) return { name: version.trim(), ...answer(page.title.replaceAll("&quot;", '"')) };
    }
    throw new Error("Chrome never finished the checks");
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
      // A window on the screen, all but transparent, and the app's events pumped: WebKit holds back the timers of a page
      // it thinks no one can see.
      const app = $.NSApplication.sharedApplication;
      app.setActivationPolicy(1);
      app.finishLaunching;
      const frame = $.NSMakeRect(0, 0, 1280, 800);
      const window = $.NSWindow.alloc.initWithContentRectStyleMaskBackingDefer(frame, 0, 2, false);
      const view = $.WKWebView.alloc.initWithFrameConfiguration(frame, $.WKWebViewConfiguration.alloc.init);
      window.contentView = view;
      window.alphaValue = 0.01;
      window.ignoresMouseEvents = true;
      window.orderFrontRegardless;
      view.loadRequest($.NSURLRequest.requestWithURL($.NSURL.URLWithString(argv[0])));
      const stop = Date.now() + 90000;
      while (Date.now() < stop && !view.title.js.startsWith("DONE:")) {
        const event = app.nextEventMatchingMaskUntilDateInModeDequeue($.NSEventMaskAny, $.NSDate.dateWithTimeIntervalSinceNow(0.1), $.NSDefaultRunLoopMode, true);
        if (!event.isNil()) app.sendEvent(event);
      }
      const version = $.NSBundle.bundleWithIdentifier("com.apple.WebKit").infoDictionary.objectForKey("CFBundleVersion").js;
      return JSON.stringify({ version, title: view.title.js });
    }
  `);
  const { stdout } = await run("osascript", ["-l", "JavaScript", file, url], { timeout: 100000 });
  const { version, title } = JSON.parse(stdout);
  return { name: `WebKit ${version} in a WKWebView`, ...answer(title) };
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
    await call("POST", `${at}/url`, { url });
    const stop = Date.now() + 90000;
    let title = "";
    while (Date.now() < stop && !title.startsWith("DONE:")) {
      await new Promise((done) => setTimeout(done, 500));
      title = await call("GET", `${at}/title`);
    }
    const version = await call("POST", `${at}/execute/sync`, { script: "return /Version\\/([\\d.]+)/.exec(navigator.userAgent)[1];", args: [] });
    await call("DELETE", at);
    return { name: `Safari ${version}`, ...answer(title) };
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
const html = readFileSync(page, "utf8").replace("</body>", () => `<script>${checks}</script>\n</body>`);

const server = createServer((_, response) => {
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
server.close();
console.log(JSON.stringify(seen, null, 2));
