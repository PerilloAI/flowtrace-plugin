/* global console, fetch, process, WebSocket */
// Draws a plan with page.mjs, adds a script that follows the page's own links and clicks a row's line, and prints what
// each browser did: Chrome, the Mac's WebKit in a WKWebView, and Safari itself once its Settings allow remote automation
// (Developer section). Chrome then takes real wheel, key and mouse input, which a page's own script can't send. macOS
// only, on Node 22 or later; nothing is installed, and no setting or profile of the person's is touched.
//   node observations/browsers/closed-row.probe.mjs
// With --check it runs Chrome alone, and fails when any answer differs from the record's, leaving out the browser's name
// and version. CI runs this.
//   node observations/browsers/closed-row.probe.mjs --check
import { execFile, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { observation } from "../observation.mjs";

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const scratch = realpathSync(mkdtempSync(path.join(os.tmpdir(), "closed-row-")));
const git = (...args) => run("git", ["-C", scratch, ...args]);

// A screen, one row taller than the screen, one more below it, and enough between the links and the rows that each link
// scrolls.
const plan = {
  title: "Export an order",
  sections: [
    { heading: "What I'm asking", content: [{ p: "Approve each step, and see [the last answer](#w-lastanswer) and [the questions](#s-check-your-reading)." }] },
    { heading: "What you'd see", content: [{ screens: { title: "Exporting an order", columns: [{ title: "Today", steps: [{ text: "It gives up" }] }, { title: "After", steps: [{ text: "It tries again", change: "Retry once" }] }] } }] },
    { heading: "Check your reading", content: [
      { question: { question: "Where does it start?", options: ["At Export", "At Import", "At Print"], answer: "A", read: "Export an order", why: "It starts there." } },
      { question: { question: "What loads the order?", options: ["exportOrder", "loadOrder", "Nothing"], answer: "B", read: "loadOrder", why: "That step does." } },
    ] },
    { heading: "What this rests on", content: [
      { table: { head: ["The plan rests on", "How it was proved", "Where"], rows: [["An order loads", "Read it", "loadOrder"]] } },
      ...Array.from({ length: 80 }, (_, k) => ({ p: `Line ${k + 1} between the links and the rows.` })),
    ] },
    { heading: "The changes and why", content: [{ changes: [{ title: "Retry once", gets: "A file", why: "It is slow, as [the report](https://example.com/report) says, and one more try gets most exports through" }] }] },
    { heading: "How it's built", content: [
      { flow: { name: "Export an order", steps: [
        { keyword: "Starts", text: "Ana presses Export", where: "exportOrder" },
        ...Array.from({ length: 40 }, (_, k) => ({ keyword: "Step", text: k === 30 ? "Do part 31, as [the changes say](#s-the-changes-and-why) in [its row](#c-retry-once)" : `Do part ${k + 1}`, ...(k === 30 ? { change: "Retry once" } : {}) })),
        { keyword: "Returns", text: "the file" },
      ] } },
      { flow: { name: "Load an order", steps: [{ keyword: "Starts", text: "Ana opens an order" }, { keyword: "Step", text: "Load the order", where: "loadOrder" }] } },
      { flow: { name: "Answer an order", steps: [{ keyword: "Starts", text: "Ana asks" }, { keyword: "Check", text: "Which answer?", answers: Array.from({ length: 8 }, (_, k) => ({ label: `answer ${k + 1}`, steps: [{ keyword: "Step", text: `Give answer ${k + 1}`, ...(k === 7 ? { where: "lastAnswer" } : {}) }] })) }] } },
    ] },
    { heading: "Names", content: [{ names: [{ name: "step", text: "one thing a flow does, as [the docs](https://example.com/docs) say" }, { name: "flow", text: "the steps of a behaviour" }] }] },
  ],
};

const checks = `
const out = {};
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
  const modal = document.querySelector("dialog.modal");
  const modalBack = modal.querySelector(".modal-back");
  const titled = () => modal.querySelector(".modal-title").textContent;
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
  out.pageHidden = document.hidden;
  out.closedAtLoad = rows.every((r) => !r.open);

  let stayed = await follow(toRow);
  const ids = [...document.querySelectorAll("[id]")].map((el) => el.id);
  out.linkToRow = {
    modalOpen: modal.open,
    rowStaysClosed: !row.open,
    pageStays: stayed(),
    nameInBar: titled() === row.querySelector("h3").textContent,
    wholeFlow: body.querySelectorAll(".n").length === row.querySelectorAll(".n").length,
    atTop: body.scrollTop === 0,
    stepLit: Boolean(body.querySelector(".hit")),
    idsUnique: new Set(ids).size === ids.length,
    focusInModal: modal.contains(document.activeElement),
    focusOnFlow: document.activeElement === body,
  };
  modal.querySelector(".modal-close").click();
  await wait(100);
  out.closeButton = { closed: !modal.open, pageStays: stayed(), focusBack: document.activeElement === toRow };

  stayed = await follow(toStep);
  out.linkToStep = { modalOpen: modal.open, stepLit: Boolean(body.querySelector(".hit")), stepInView: inModal(body.querySelector(".hit")), rowStaysClosed: !step.closest("details").open, pageStays: stayed(), focusOnStep: document.activeElement === body.querySelector(".hit") };
  modal.click();
  await wait(100);
  out.clickOutside = { closed: !modal.open, pageStays: stayed(), focusBack: document.activeElement === toStep };

  stayed = await follow(document.querySelector('a[href="#w-lastanswer"]'));
  const wide = body.querySelector(".hit");
  const wideChart = wide.closest(".chart").getBoundingClientRect();
  const wideAt = wide.getBoundingClientRect();
  out.stepInWideChart = { scrolledSideways: wide.closest(".chart").scrollLeft > 0, inViewSideways: wideAt.left >= wideChart.left && wideAt.right <= wideChart.right, focusOnStep: document.activeElement === wide, pageStays: stayed() };
  modal.querySelector(".modal-close").click();
  await wait(100);

  stayed = await follow(toFlow);
  const lit = body.querySelector(".hit");
  out.screenLink = { modalOpen: modal.open, stepLit: Boolean(lit), stepInView: inModal(lit), scrolledToStep: body.scrollTop > 0, rowStaysClosed: !row.open, pageStays: stayed() };

  const term = body.querySelector("a.term");
  term.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }));
  const tip = document.querySelector(".tip");
  const tipAt = tip.getBoundingClientRect();
  const termAt = term.getBoundingClientRect();
  out.tipInModal = { shown: !tip.hidden, inModal: modal.contains(tip), besideName: Math.min(Math.abs(tipAt.top - termAt.bottom), Math.abs(termAt.top - tipAt.bottom)) <= 8 };
  const flowAt = body.scrollTop;
  term.click();
  await wait(100);
  out.nameClickInModal = { modalStays: modal.open, flowStays: body.scrollTop === flowAt, tipShown: !tip.hidden };
  body.click();
  const inCopy = body.querySelector("a.to-change");
  inCopy.click();
  await wait(100);
  out.changeClickInModal = { modalStays: modal.open, flowStays: body.scrollTop === flowAt, tipShown: !tip.hidden, rowInTip: tip.textContent.includes("It is slow") };
  body.click();

  const comment = body.querySelector("button.cmt");
  comment.click();
  const commentShown = Boolean(comment.closest(".cell").querySelector(".cmt-box"));
  modal.close();
  await wait(100);
  stayed = await follow(toFlow);
  out.commentInCopy = { shown: commentShown, keptOnReopening: Boolean(body.querySelector(".cmt-box")), notOnPage: !row.querySelector(".cmt-box") };

  // The circle. Opened from a step of that very screen, Seen in just closes the modal.
  body.querySelector(".row-meta a").click();
  await wait(100);
  out.seenInToWhereYouCameFrom = { closed: !modal.open, pageStays: stayed(), focusBack: document.activeElement === toFlow };

  // Opened from anywhere else, Seen in shows the screen, Back retraces it, and going round adds nothing.
  stayed = await follow(toRow);
  const flowName = titled();
  const backHiddenAtFirst = modalBack.hidden;
  body.querySelector(".row-meta a").click();
  await wait(100);
  out.seenInToSomewhereNew = { modalOpen: modal.open, screenInModal: titled() === "Exporting an order", chartInModal: Boolean(body.querySelector("figure a.to-flow")), backHiddenAtFirst, backShown: !modalBack.hidden, pageStays: stayed() };
  modalBack.click();
  await wait(100);
  out.modalBack = { onFlow: titled() === flowName, backGone: modalBack.hidden };
  body.scrollTop = 200;
  body.querySelector(".row-meta a").click();
  await wait(100);
  modalBack.click();
  await wait(100);
  out.modalBack.placeKept = body.scrollTop === 200;
  body.querySelector(".row-meta a").click();
  await wait(100);
  body.querySelector("figure a.to-flow").click();
  await wait(100);
  out.noRepeats = { onFlow: titled() === flowName, backGone: modalBack.hidden, stepLit: Boolean(body.querySelector(".hit")), pageStays: stayed() };

  // A section opens in the modal too, and what the modal can't show still scrolls, with the page's Back.
  body.querySelector('a[href="#s-the-changes-and-why"]').click();
  await wait(100);
  out.sectionInModal = { modalOpen: modal.open, sectionInBar: titled() === "The changes and why", tableInModal: Boolean(body.querySelector("table")), backShown: !modalBack.hidden, pageStays: stayed() };
  modalBack.click();
  await wait(100);
  const tableRow = document.getElementById("c-retry-once");
  body.querySelector('a[href="#c-retry-once"]').click();
  await settled();
  out.linkOutOfModal = { closed: !modal.open, targetInView: inView(tableRow), backShown: !back.hidden };
  back.click();
  await settled();
  out.backToOpener = { linkInView: inView(toRow), focused: document.activeElement === toRow };

  closeAll();
  row.open = true;
  const inRow = row.querySelector('.chart a[href="#c-retry-once"]');
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
  stayed = await follow(seenIn);
  out.seenInLink = { modalOpen: modal.open, screenInModal: titled() === "Exporting an order", rowStaysClosed: !row.open, pageStays: stayed() };
  body.querySelector("figure a.to-flow").click();
  await wait(100);
  out.seenInLink.howItsBuiltOpensTheClosedRowsFlow = modal.open && titled() === row.querySelector("h3").textContent;
  body.querySelector(".row-meta a").click();
  await wait(100);
  out.seenInLink.seenInGoesBack = modal.open && titled() === "Exporting an order" && modalBack.hidden;
  modal.querySelector(".modal-close").click();
  await wait(100);
  out.seenInLink.closes = !modal.open && document.activeElement === seenIn && !row.open && stayed();

  // With the row open, How it's built names a step the reader may not be looking at, so it shows that step.
  row.open = true;
  stayed = await follow(seenIn);
  body.querySelector("figure a.to-flow").click();
  await wait(100);
  const openLit = body.querySelector(".hit");
  out.seenInOnOpenRow = { modalOpen: modal.open, onFlow: titled() === row.querySelector("h3").textContent, stepLit: Boolean(openLit), stepInView: Boolean(openLit) && inModal(openLit), pageStays: stayed() };
  modal.querySelector(".modal-close").click();
  await wait(100);
  out.seenInOnOpenRow.closes = !modal.open && document.activeElement === seenIn;
  closeAll();

  // A question in a copy looks disabled and says where to answer it, and a later copy holds an answer given on the page.
  const toQuestions = document.querySelector('a[href="#s-check-your-reading"]');
  const onPage = document.querySelector(".qz button.opt");
  await follow(toQuestions);
  const inCopyOpt = body.querySelector("button.opt");
  const copyLook = getComputedStyle(inCopyOpt);
  out.questionInCopy = { disabled: inCopyOpt.disabled, looksDisabled: copyLook.cursor === "not-allowed" && copyLook.opacity !== getComputedStyle(onPage).opacity, saysWhere: Boolean(body.querySelector(".modal-note")) };
  modal.querySelector(".modal-close").click();
  await wait(100);
  onPage.click();
  await follow(toQuestions);
  out.questionInCopy.answerShowsNext = !body.querySelector(".qz .fb").hidden && Boolean(body.querySelector("button.opt.right"));
  modal.querySelector(".modal-close").click();
  await wait(100);

  const mention = document.querySelector("p a.term");
  mention.scrollIntoView({ block: "center", behavior: "instant" });
  await wait(100);
  const pageAt = scrollY;
  mention.click();
  await settled();
  out.nameClick = { pageStays: scrollY === pageAt, tipShown: !tip.hidden, lineInTip: tip.textContent.includes("one thing a flow does"), backStaysHidden: back.hidden, keysMoveIntoTip: tip.contains(document.activeElement) };
  document.body.click();
  out.nameClick.focusBackOnName = document.activeElement === mention;
  out.nameClick.clickElsewhereCloses = tip.hidden;

  const onScreen = document.querySelector("a.to-change");
  onScreen.scrollIntoView({ block: "center", behavior: "instant" });
  await wait(100);
  const screenAt = scrollY;
  onScreen.click();
  await settled();
  const boxAt = tip.getBoundingClientRect();
  const builtWords = document.createRange();
  builtWords.selectNodeContents(document.querySelector("a.to-flow"));
  const builtAt = builtWords.getBoundingClientRect();
  out.changeClick = { pageStays: scrollY === screenAt, tipShown: !tip.hidden, titleInTip: tip.textContent.includes("Retry once"), getsInTip: tip.textContent.includes("A file"), whyInTip: tip.textContent.includes("It is slow"), backStaysHidden: back.hidden, howItsBuiltUncovered: boxAt.bottom <= builtAt.top || boxAt.top >= builtAt.bottom || boxAt.right <= builtAt.left || boxAt.left >= builtAt.right };
  document.body.click();
  out.changeClick.clickElsewhereCloses = tip.hidden;

  out.namesOnLine = document.querySelectorAll("summary a.term").length;
  out.namesInChart = document.querySelectorAll("details.flowbox .chart a.term").length > 0;
})().catch((error) => {
  // Reported at once, with the answers up to it, which say how far the checks got.
  out.threw = String(error);
}).then(async () => {
  await fetch("/", { method: "POST", body: JSON.stringify(out) });
  document.title = "DONE";
});
`;

// What the page next reports to this probe's server: the checks' answer.
let report;
const reported = () => new Promise((done, fail) => {
  report = done;
  setTimeout(() => fail(new Error("the page never finished its checks")), 90000).unref();
});

// A real wheel, Esc and click outside on the modal, through Chrome's debugging port.
async function realInput(port, url) {
  // Blank page beside the words, clear of the scrollbar that a Mac with no trackpad draws at the far right.
  const aside = 1250;
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
  const press = async (key, windowsVirtualKeyCode, text) => {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key, code: key, windowsVirtualKeyCode, ...(text ? { text } : {}) });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key, code: key, windowsVirtualKeyCode });
    await wait(600);
  };
  const move = async (x, y) => {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await wait(50);
  };
  const middle = (selector) => read(`(() => { const at = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: at.left + at.width / 2, y: at.top + at.height / 2, top: at.top }; })()`);
  const tip = () => read(`(() => { const t = document.querySelector(".tip"); return { hidden: t.hidden, words: t.textContent, inTip: t.contains(document.activeElement), onName: document.activeElement === document.querySelector("p a.term") }; })()`);
  const esc = () => press("Escape", 27);
  const drag = async (x, y, x2, y2) => {
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x2, y: y2, button: "left", buttons: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x2, y: y2, button: "left", clickCount: 1 });
    await wait(400);
  };
  const nameState = () => read(`({ tip: !document.querySelector(".tip").hidden, y: scrollY, backHidden: document.querySelector("button.back").hidden })`);
  const name = await read(`(async () => {
    const a = document.querySelector("p a.term");
    a.scrollIntoView({ block: "center", behavior: "instant" });
    await new Promise((done) => setTimeout(done, 150));
    const at = a.getBoundingClientRect();
    return { x: at.left + at.width / 2, y: at.top + at.height / 2, pageAt: scrollY };
  })()`);
  const out = {};
  await click(name.x, name.y);
  await wait(1500);
  const clicked = await nameState();
  out.nameClick = { pageStays: clicked.y === name.pageAt, tipShown: clicked.tip, backStaysHidden: clicked.backHidden };
  await click(aside, name.y);
  out.clickElsewhere = { tipHidden: !(await nameState()).tip };
  await send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await send("Input.synthesizeTapGesture", { x: name.x, y: name.y });
  await wait(1500);
  const tapped = await nameState();
  out.nameTap = { pageStays: tapped.y === name.pageAt, tipShown: tapped.tip };
  await send("Input.synthesizeTapGesture", { x: aside, y: name.y });
  await wait(400);
  out.tapElsewhere = { tipHidden: !(await nameState()).tip };
  await send("Emulation.setTouchEmulationEnabled", { enabled: false });
  // After a click, the line stays as the pointer moves away.
  await move(aside, name.y);
  await click(name.x, name.y);
  await move(aside, name.y);
  await wait(200);
  out.tip = { clickKeepsItAsPointerLeaves: !(await tip()).hidden };
  await click(aside, name.y);
  out.tip.clickElsewhereClosesIt = (await tip()).hidden;
  // Pointing shows it, and the pointer can cross the gap to it, small moves at a time.
  await move(name.x, name.y);
  const crossing = await middle(".tip");
  const pointed = await tip();
  for (let y = name.y; y < crossing.top + 4; y += 2) await move(name.x, y);
  out.tip.pointerCrossesToIt = !pointed.hidden && !(await tip()).hidden;
  // A name in the line leaves it as it is when pointed at, and shows its own line when clicked.
  const nested = await middle(".tip a.term");
  await move(nested.x, nested.y);
  await wait(200);
  const pointedInIt = await tip();
  out.tip.pointingAtNameInItKeepsIt = !pointedInIt.hidden && pointedInIt.words.includes("one thing a flow does");
  await click(nested.x, nested.y);
  const clickedInIt = await tip();
  out.tip.clickingNameInItShowsThatLine = !clickedInIt.hidden && clickedInIt.words.includes("the steps of a behaviour");
  await click(aside, name.y);
  // A link in the line can be followed, by mouse and by keys, without leaving this page.
  await read(`(() => {
    window.followed = 0;
    document.addEventListener("click", (event) => {
      if (event.target.closest('.tip a[href^="https"]')) {
        event.preventDefault();
        window.followed += 1;
      }
    }, true);
  })()`);
  await move(aside, name.y);
  await click(name.x, name.y);
  const docs = await middle('.tip a[href^="https"]');
  await move(docs.x, docs.y);
  await click(docs.x, docs.y);
  out.tip.linkInItFollowedByMouse = (await read("window.followed")) === 1;
  out.tip.followingItClosesIt = (await tip()).hidden;
  await move(aside, name.y);
  await read(`document.querySelector("p a.term").focus()`);
  await press("Enter", 13, "\r");
  out.tip.enterMovesIntoIt = (await tip()).inTip;
  await press("Tab", 9);
  const tabbed = await read(`document.activeElement.matches('.tip a[href^="https"]')`);
  await press("Enter", 13, "\r");
  out.tip.linkInItFollowedByKeys = tabbed && (await read("window.followed")) === 2;
  await read(`document.querySelector("p a.term").focus()`);
  await press("Enter", 13, "\r");
  await esc();
  const closedByEsc = await tip();
  out.tip.escClosesItAndFocusReturns = closedByEsc.hidden && closedByEsc.onName;
  await read(`document.activeElement.blur()`);
  const change = await read(`(async () => {
    const a = document.querySelector("a.to-change");
    a.scrollIntoView({ block: "center", behavior: "instant" });
    await new Promise((done) => setTimeout(done, 150));
    const at = a.getBoundingClientRect();
    return { x: at.left + at.width / 2, y: at.top + at.height / 2, pageAt: scrollY };
  })()`);
  await click(change.x, change.y);
  await wait(1500);
  const changed = await nameState();
  out.changeClick = { pageStays: changed.y === change.pageAt, tipShown: changed.tip, backStaysHidden: changed.backHidden };
  await click(aside, change.y);
  out.changeClickElsewhere = { tipHidden: !(await nameState()).tip };
  // A link in the row can be followed, and the row leaves How it's built to be clicked first time.
  await move(aside, change.y);
  await click(change.x, change.y);
  const followedBefore = await read("window.followed");
  const report = await middle('.tip a[href^="https"]');
  await move(report.x, report.y);
  await click(report.x, report.y);
  out.changeTip = { linkInItFollowed: (await read("window.followed")) === followedBefore + 1, followingItClosesIt: (await tip()).hidden };
  await move(aside, change.y);
  await click(change.x, change.y);
  // The start of the link's words, which the row reaches first.
  const built = await read(`(() => {
    const words = document.createRange();
    words.selectNodeContents(document.querySelector("a.to-flow"));
    const at = words.getBoundingClientRect();
    return { x: at.left + 6, y: at.top + at.height / 2 };
  })()`);
  await move(built.x, built.y);
  await click(built.x, built.y);
  out.changeTip.howItsBuiltOpensOnFirstClick = await read(`document.querySelector("dialog").open`);
  await esc();
  await move(aside, change.y);
  const state = () => read(`({ open: document.querySelector("dialog.modal").open, y: scrollY, flow: document.querySelector(".modal-body").scrollTop, focusBack: document.activeElement === document.querySelector("a.to-flow") })`);
  const link = await read(`(async () => {
    const a = document.querySelector("a.to-flow");
    a.scrollIntoView({ block: "center", behavior: "instant" });
    await new Promise((done) => setTimeout(done, 150));
    const at = a.getBoundingClientRect();
    return { x: at.left + at.width / 2, y: at.top + at.height / 2 };
  })()`);
  await click(link.x, link.y);
  const opened = await state();
  // Esc closes a line shown in the modal first, and the modal after it.
  const word = await middle(".modal-body .hit a.term");
  await move(word.x, word.y);
  await wait(200);
  const inModal = await tip();
  await esc();
  const once = await state();
  out.tip.escInModalClosesItFirst = !inModal.hidden && (await tip()).hidden && once.open;
  await move(aside, 40);
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
  await click(link.x, link.y);
  const lit = await state();
  const focusOnStep = await read(`document.activeElement === document.querySelector(".modal-body .hit")`);
  await press("PageDown", 34);
  const paged = await state();
  out.keysOnLitStep = { focusOnStep, pageDownMovesFlow: paged.flow > lit.flow, pageStays: paged.y === opened.y };
  await drag(640, 400, 20, 400);
  out.dragOutOfModal = { staysOpen: (await state()).open };
  await click(20, 400);
  out.dragOutOfModal.clickOutsideStillCloses = !(await state()).open;
  await click(link.x, link.y);
  // Seen in sits above the lit step, so it takes scrolling up to reach.
  const seenIn = await read(`(() => {
    document.querySelector(".modal-body").scrollTop = 0;
    const at = document.querySelector(".modal-body .row-meta a").getBoundingClientRect();
    return { x: at.left + at.width / 2, y: at.top + at.height / 2 };
  })()`);
  await click(seenIn.x, seenIn.y);
  const circled = await state();
  out.seenInClosesTheCircle = { closed: !circled.open, pageStays: circled.y === opened.y, focusBack: circled.focusBack };
  await wheel(640, 400);
  out.wheelAfterClosing = { pageMoves: (await state()).y !== opened.y };
  socket.close();
  return out;
}

async function chrome(url) {
  const bin = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const { stdout: version } = await run(bin, ["--version"]);
  const answer = reported();
  const profile = path.join(scratch, "chrome");
  // Real time, not the virtual time of --dump-dom, which never finishes a smooth scroll. Port 0 has Chrome pick a free
  // port and write it in the profile, so a run beside this one, or a Chrome still going down, can't answer in its place.
  const browser = spawn(bin, ["--headless=new", "--disable-gpu", "--no-first-run", `--user-data-dir=${profile}`, "--remote-debugging-port=0", "--window-size=1280,800", url], { stdio: "ignore" });
  try {
    const checks = await answer;
    if (checks.threw) return { name: version.trim(), ...checks };
    const port = readFileSync(path.join(profile, "DevToolsActivePort"), "utf8").split("\n")[0];
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
writeFileSync(path.join(scratch, "orders.ts"), "export function exportOrder() {}\nexport function loadOrder() {}\nexport function lastAnswer() {}\n");
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
const checking = process.argv.includes("--check");
const seen = [];
for (const browser of checking ? [chrome] : [chrome, webkit, safari]) {
  const result = await browser(url);
  if (result.skipped) console.error(`${browser.name} skipped: ${result.skipped}`);
  else seen.push(result);
}
server.closeAllConnections();
server.close();
if (checking) {
  // Each answer under its path, so one that differs, has gone or is new gets a line of its own.
  const flat = (value, at) => (value && typeof value === "object"
    ? Object.entries(value).flatMap(([key, inner]) => flat(inner, at ? `${at}.${key}` : key))
    : [[at, value]]);
  const answers = ({ name, ...rest }) => new Map(flat(rest));
  const recorded = observation("browsers/closed-row").evidence.find(({ name }) => name.startsWith("Google Chrome"));
  const [got, want] = [answers(seen[0]), answers(recorded)];
  const differing = [...new Set([...got.keys(), ...want.keys()])].filter((at) => got.get(at) !== want.get(at));
  if (differing.length) {
    console.error(`${seen[0].name} answered differently from ${recorded.name} in the record:`);
    for (const at of differing) console.error(`  ${at}: ${got.get(at)}, where the record has ${want.get(at)}`);
    process.exitCode = 1;
  } else {
    console.log(`${seen[0].name} gave the answers ${recorded.name} did in the record.`);
  }
} else {
  console.log(JSON.stringify(seen, null, 2));
  if (seen.some(({ threw }) => threw)) process.exitCode = 1;
}
