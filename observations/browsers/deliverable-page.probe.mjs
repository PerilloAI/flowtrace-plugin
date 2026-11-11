/* global console, fetch, process */
// Draws the sample deliverable plan with page.mjs, adds a script that opens its cards, picks options, marks an edge case
// and sends or copies the answers, and prints what each browser did: Chrome and the Mac's WebKit in a WKWebView, each
// at 1280 and 375 wide. The narrow run gives the page a stand-in sendPrompt, as a host that can send has; the wide run
// has none, so the page copies, and what the browser's clipboard did is kept. macOS only, on Node 22 or later; nothing
// is installed, and no setting or profile of the person's is touched.
//   node observations/browsers/deliverable-page.probe.mjs
import { execFile, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const scratch = realpathSync(mkdtempSync(path.join(os.tmpdir(), "deliverable-page-")));

const checks = `
(async () => {
  const $ = (s) => document.querySelector(s);
  const out = { width: innerWidth, sends: typeof sendPrompt === "function" };
  const shown = (el) => !el.hidden && el.getBoundingClientRect().height > 0;
  const visiblePanels = () => [...document.querySelectorAll(".panel")].filter((p) => !p.hidden).map((p) => p.dataset.card);
  const fits = () => document.documentElement.scrollWidth <= innerWidth;
  // What a click at the middle of an element's box lands on.
  const hitAt = (el) => {
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  };

  out.atLoad = { map: shown($(".map-view")), zoomHidden: $(".zoom").hidden, panelsShown: visiblePanels().length, button: $(".send").textContent, buttonDisabled: $(".send").disabled, picks: $(".picks").textContent, fits: fits() };

  const lineHit = hitAt($('.map-view .card.q .cl'));
  out.cardBodyHit = { isTitleButton: lineHit?.matches?.('button.open[data-open="q1"]') ?? false };
  const thumbHit = hitAt($(".map-view .dtile .thumb"));
  out.tileThumbHit = { isTitleButton: thumbHit?.matches?.('button.open[data-open="d1"]') ?? false };

  $('.map-view [data-open="q1"]').click();
  out.openQuestion = { mapHidden: $(".map-view").hidden, zoom: shown($(".zoom")), panels: visiblePanels(), focus: document.activeElement.tagName + " " + document.activeElement.textContent, current: [...document.querySelectorAll('.mini .it[aria-current="true"]')].map((b) => b.dataset.open), top: scrollY, fits: fits() };
  out.optionTitles = [...document.querySelectorAll('[data-card="q1"] .ot')].map((b) => ({ k: b.dataset.k, onLettersLine: Math.abs(b.querySelector(".letter").getBoundingClientRect().top - b.querySelector(".name").getBoundingClientRect().top) < 6 }));

  $('[data-card="q1"] .opt[data-k="B"] .gc').click();
  out.pick = { pressed: [...document.querySelectorAll('[data-card="q1"] .ot')].map((b) => b.dataset.k + " " + b.getAttribute("aria-pressed")), statuses: [...document.querySelectorAll('[data-status="q1"]')].map((s) => s.className + " " + s.textContent), pip: $('[data-pip="q1"]').className, picks: $(".picks").textContent, buttonDisabled: $(".send").disabled };
  $('[data-card="q1"] .opt[data-k="B"] .ot').click();
  out.pickAgain = { pressed: [...document.querySelectorAll('[data-card="q1"] .ot')].map((b) => b.getAttribute("aria-pressed")), statuses: [...document.querySelectorAll('[data-status="q1"]')].map((s) => s.className + " " + s.textContent), picks: $(".picks").textContent, buttonDisabled: $(".send").disabled };
  $('[data-card="q1"] .opt[data-k="A"]').click();

  $('.mini [data-open="e1"]').click();
  out.openFromStrip = { panels: visiblePanels(), fits: fits() };
  $('[data-card="e1"] .tog[data-v="discuss"]').click();
  out.verdict = { pressed: [...document.querySelectorAll('[data-card="e1"] .tog')].map((b) => b.dataset.v + " " + b.getAttribute("aria-pressed")), onMap: $('[data-verdict="e1"]').textContent, picks: $(".picks").textContent };

  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  out.escape = { map: shown($(".map-view")), zoomHidden: $(".zoom").hidden, panels: visiblePanels().length, focus: document.activeElement.textContent };

  $('.map-view [data-open="d1"]').click();
  out.openDeliverable = { panels: visiblePanels(), fits: fits() };
  $(".mini .all").click();
  out.backToMap = { map: shown($(".map-view")), zoomHidden: $(".zoom").hidden };
  $('.map-view [data-open="d2"]').click();
  $(".home").click();
  out.homeToMap = { map: shown($(".map-view")), zoomHidden: $(".zoom").hidden };

  const sent = window.__sent ?? null;
  const label = $(".send").textContent;
  $(".send").click();
  // The clipboard answers later: wait until the button says it copied or the paste box shows, for at most 3 s.
  for (let k = 0; k < 60 && $(".send").textContent === label && $(".fallback").hidden; k++) await new Promise((done) => setTimeout(done, 50));
  out.answer = { button: $(".send").textContent, sent: sent && [...sent], fallbackShown: !$(".fallback").hidden, fallbackValue: $(".fallback").value };

  await fetch("/", { method: "POST", body: JSON.stringify(out) });
  document.title = "DONE";
})();
`;

// A host that can send gives the page a global sendPrompt; this one keeps what it was given.
const host = "window.__sent = []; window.sendPrompt = (text) => window.__sent.push(text);";

let report;
const reported = () => new Promise((done, fail) => {
  report = done;
  setTimeout(() => fail(new Error("the page never finished its checks")), 60000).unref();
});

async function chrome(url, width) {
  const bin = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const { stdout: version } = await run(bin, ["--version"]);
  const answer = reported();
  const browser = spawn(bin, ["--headless=new", "--disable-gpu", "--no-first-run", `--user-data-dir=${path.join(scratch, `chrome-${width}`)}`, `--window-size=${width},800`, url], { stdio: "ignore" });
  try {
    return { name: version.trim(), ...(await answer) };
  } finally {
    browser.kill();
  }
}

async function webkit(url, width) {
  const file = path.join(scratch, "webkit.js");
  writeFileSync(file, `
    ObjC.import("Cocoa");
    ObjC.import("WebKit");
    function run(argv) {
      // WebKit stops the timers of a page it thinks no one can see. Its two private settings here keep them running.
      const app = $.NSApplication.sharedApplication;
      app.setActivationPolicy(1);
      app.finishLaunching;
      const frame = $.NSMakeRect(0, 0, Number(argv[1]), 800);
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
      const stop = Date.now() + 60000;
      while (Date.now() < stop && view.title.js !== "DONE") {
        const event = app.nextEventMatchingMaskUntilDateInModeDequeue($.NSEventMaskAny, $.NSDate.dateWithTimeIntervalSinceNow(0.1), $.NSDefaultRunLoopMode, true);
        if (!event.isNil()) app.sendEvent(event);
      }
      return $.NSBundle.bundleWithIdentifier("com.apple.WebKit").infoDictionary.objectForKey("CFBundleVersion").js;
    }
  `);
  const answer = reported();
  const { stdout: version } = await run("osascript", ["-l", "JavaScript", file, url, String(width)], { timeout: 70000 });
  return { name: `WebKit ${version.trim()} in a WKWebView`, ...(await answer) };
}

const page = path.join(scratch, "page.html");
await run(process.execPath, [path.join(here, "../../page/page.mjs"), "deliverable", path.join(here, "../../page/fixtures/deliverable.json"), "--whole", "--out", page]);
const drawn = readFileSync(page, "utf8");
const served = (sends) => drawn
  .replace("<script>", () => `${sends ? `<script>${host}</script>\n` : ""}<script>`)
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
  response.end(served(request.url.includes("sends")));
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const base = `http://127.0.0.1:${server.address().port}/`;
const seen = [];
for (const browser of [chrome, webkit]) {
  seen.push(await browser(base, 1280));
  seen.push(await browser(`${base}?sends`, 375));
}
server.closeAllConnections();
server.close();
rmSync(scratch, { recursive: true, force: true });
console.log(JSON.stringify(seen, null, 2));
