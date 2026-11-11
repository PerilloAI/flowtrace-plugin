// A deliverable's plan page: what the author gets, the questions only they can answer and the edge cases worth a look,
// as one map of cards. Each card opens in place with the map kept beside it, and its detail folds under a name. The data
// is JSON, as deliverable.md gives it: this reads it, checks it and draws the page the same way every time.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson } from "./json.mjs";
import { pictureProblems } from "./picture.mjs";
import { reader } from "./read.mjs";
import { FONTS, esc, inline, inlineInLink } from "./render.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(path.join(here, "page.css"), "utf8") + readFileSync(path.join(here, "deliverable.css"), "utf8");
const JS = readFileSync(path.join(here, "deliverable.js"), "utf8");

// The map fits a screen or two, and a title reads at a glance.
export const LIMITS = { deliverables: 6, questions: 7, edgeCases: 5, options: [2, 4], titleWords: 12, lineWords: 30, tldrWords: 60 };
const LETTERS = "ABCD";

/** @returns {{ doc: object, lineOf: (path: (string|number)[]) => number }} */
export function readDeliverable(text) {
  const { value, lineOf } = readJson(text);
  const { shape, list } = reader(lineOf);
  const picture = (lines, p) => (lines === undefined ? null : { html: lines, path: p });
  const more = (v, p) => {
    if (v === undefined) return null;
    shape(v, p, { label: "string", picture: "strings" });
    return { label: v.label, picture: picture(v.picture, [...p, "picture"]) };
  };
  shape(value, [], { title: "string", about: "string?", tldr: "string", deliverables: "array", questions: "array", edgeCases: "array", settled: "array?" });
  const doc = {
    title: value.title,
    about: value.about ?? null,
    tldr: value.tldr,
    deliverables: list(value.deliverables, ["deliverables"], (v, p) => {
      shape(v, p, { name: "string", kind: "string?", line: "string", picture: "strings", more: "object?", from: "string?" });
      return { ...v, path: p, picture: picture(v.picture, [...p, "picture"]), more: more(v.more, [...p, "more"]) };
    }),
    questions: list(value.questions, ["questions"], (v, p) => {
      shape(v, p, { question: "string", line: "string", picture: "strings?", options: "array", why: "string", more: "object?", from: "string?" });
      const options = list(v.options, [...p, "options"], (o, op) => {
        shape(o, op, { name: "string", gives: "strings", costs: "strings", recommended: "boolean?", chosen: "boolean?" });
        return { ...o, path: op };
      });
      return { ...v, path: p, options, picture: picture(v.picture, [...p, "picture"]), more: more(v.more, [...p, "more"]) };
    }),
    edgeCases: list(value.edgeCases, ["edgeCases"], (v, p) => {
      shape(v, p, { title: "string", line: "string", happens: "string", picture: "strings?", consider: "string", covered: "boolean", more: "object?", from: "string?" });
      return { ...v, path: p, picture: picture(v.picture, [...p, "picture"]), more: more(v.more, [...p, "more"]) };
    }),
    settled: list(value.settled ?? [], ["settled"], (v, p) => {
      shape(v, p, { who: "string", text: "string" });
      return { ...v, path: p };
    }),
  };
  return { doc, lineOf };
}

const wordCount = (s) => s.trim().split(/\s+/).length;

/** Every rule deliverable.md marks checked, each failure as "line N: what is wrong". */
export function checkDeliverable(doc, lineOf) {
  const errors = [];
  const say = (p, message) => errors.push(`line ${lineOf(p)}: ${message}`);
  const most = (key, n, what) => {
    if (doc[key].length > n) say([key, n], `at most ${n} ${what}: the map should fit a screen or two, so fold the rest into a deliverable or settle it in the chat`);
  };
  if (!doc.deliverables.length) say(["deliverables"], "a plan names at least one deliverable: what the author will hold at the end");
  most("deliverables", LIMITS.deliverables, "deliverables");
  most("questions", LIMITS.questions, "questions");
  most("edgeCases", LIMITS.edgeCases, "edge cases");

  const title = (p, text, what) => {
    if (wordCount(text) > LIMITS.titleWords) say(p, `${what} has ${wordCount(text)} words; keep it to ${LIMITS.titleWords}, and put the rest in its "line"`);
  };
  const line = (p, text) => {
    if (wordCount(text) > LIMITS.lineWords) say(p, `"line" has ${wordCount(text)} words; keep it to ${LIMITS.lineWords}, and put the rest in the card`);
  };
  const drawn = (pic) => {
    if (!pic) return;
    if (!pic.html.length || pic.html.every((l) => !l.trim())) say(pic.path, "a picture holds at least one line of HTML or SVG");
    for (const { k, message } of pictureProblems(pic.html)) say([...pic.path, k], message);
  };

  title(["title"], doc.title, "the title");
  if (wordCount(doc.tldr) > LIMITS.tldrWords) say(["tldr"], `"tldr" has ${wordCount(doc.tldr)} words; keep it to ${LIMITS.tldrWords}, read in ten seconds`);
  for (const d of doc.deliverables) {
    title([...d.path, "name"], d.name, "a deliverable's name");
    line([...d.path, "line"], d.line);
    drawn(d.picture);
    drawn(d.more?.picture);
  }
  for (const q of doc.questions) {
    title([...q.path, "question"], q.question, "a question");
    if (!q.question.trim().endsWith("?")) say([...q.path, "question"], "a question ends with a question mark");
    line([...q.path, "line"], q.line);
    drawn(q.picture);
    drawn(q.more?.picture);
    const [fewest, most] = LIMITS.options;
    if (q.options.length < fewest || q.options.length > most) say([...q.path, "options"], `a question has ${fewest} to ${most} options; it has ${q.options.length}`);
    const recommended = q.options.filter((o) => o.recommended).length;
    if (recommended !== 1) say([...q.path, "options"], `exactly one option is "recommended": true; ${recommended} are`);
    if (q.options.filter((o) => o.chosen).length > 1) say([...q.path, "options"], 'at most one option is "chosen": true, the one the author already picked');
    const names = new Set();
    for (const o of q.options) {
      if (names.has(o.name)) say([...o.path, "name"], `two options are named "${o.name}"`);
      names.add(o.name);
      if (!o.gives.length) say([...o.path, "gives"], "an option says what it gives, at least one line");
      if (!o.costs.length) say([...o.path, "costs"], "an option says what it costs, at least one line: every choice costs something");
    }
  }
  for (const e of doc.edgeCases) {
    title([...e.path, "title"], e.title, "an edge case's title");
    line([...e.path, "line"], e.line);
    drawn(e.picture);
    drawn(e.more?.picture);
  }
  return errors;
}

const FILE_ICON = '<svg class="ico" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><rect x="1.5" y="1.5" width="11" height="11" rx="1.5"/><path d="M1.5 5h11M5 1.5v11"/></svg>';

// A question's status before any pick on the page: the author's earlier choice, or the recommendation.
export function questionStatus(q) {
  const k = q.options.findIndex((o) => o.chosen);
  if (k >= 0) return { cls: "st-you", text: `You chose ${LETTERS[k]}, ${q.options[k].name}` };
  const r = q.options.findIndex((o) => o.recommended);
  return { cls: "st-rec", text: `Recommended: ${LETTERS[r]}, ${q.options[r].name}` };
}
const edgeStatus = (e) => (e.covered ? { cls: "st-plan", text: "The plan covers it" } : { cls: "st-gap", text: "Not covered yet" });

/**
 * @param {object} doc read by readDeliverable and passed by checkDeliverable
 * @param {{ name: string, whole?: boolean }} o
 * @returns {{ html: string }}
 */
export function renderDeliverable(doc, o) {
  const ids = { d: (k) => `d${k + 1}`, q: (k) => `q${k + 1}`, e: (k) => `e${k + 1}` };
  const pic = (p, cls = "pic") => (p ? `<div class="${cls}">\n${p.html.join("\n")}\n</div>` : "");
  const fold = (m) => (m ? `<details class="work"><summary>${inline(m.label)}</summary><div class="inner">${pic(m.picture)}</div></details>` : "");
  const from = (f) => (f ? `<p class="from">From ${inline(f)}</p>` : "");
  const chip = (s, id) => `<span class="st ${s.cls}"${id ? ` data-status="${id}"` : ""}>${inlineInLink(s.text)}</span>`;
  const list = (items) => `<ul>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</ul>`;
  const open = (id, text) => `<button class="open" data-open="${id}">${inlineInLink(text)}</button>`;

  const tiles = doc.deliverables.map((d, k) =>
    `<article class="dtile">${d.kind ? `<span class="kind">${inline(d.kind)}</span>` : ""}<h3>${open(ids.d(k), d.name)}</h3>` +
    `<div class="thumb" aria-hidden="true"><div class="thumb-in">\n${d.picture.html.join("\n")}\n</div></div><p class="cl">${inline(d.line)}</p><span class="go" aria-hidden="true">Open →</span></article>`).join("\n");
  const qCards = doc.questions.map((q, k) =>
    `<article class="card q"><span class="num">Question ${k + 1}</span><h3>${open(ids.q(k), q.question)}</h3><p class="cl">${inline(q.line)}</p>` +
    `<div class="cf">${chip(questionStatus(q), ids.q(k))}<span class="go" aria-hidden="true">Open →</span></div></article>`).join("\n");
  const eCards = doc.edgeCases.map((e, k) =>
    `<article class="card e"><span class="num">Edge case ${k + 1}</span><h3>${open(ids.e(k), e.title)}</h3><p class="cl">${inline(e.line)}</p>` +
    `<div class="cf">${chip(edgeStatus(e))}<span class="verdict" data-verdict="${ids.e(k)}"></span><span class="go" aria-hidden="true">Open →</span></div></article>`).join("\n");
  const column = (name, sub, cards, none) =>
    `<div class="col"><div class="col-head"><h2>${name}</h2><span>${sub}</span></div>${cards || `<p class="none">${none}</p>`}</div>`;
  const settled = doc.settled.length
    ? `<details class="work settled"><summary>Already settled (${doc.settled.length})</summary><div class="inner"><ul>${doc.settled.map((s) => `<li><span class="tag who">${esc(s.who)}</span> ${inline(s.text)}</li>`).join("")}</ul></div></details>`
    : "";

  const map = `<section class="map-view">
<header class="hero">${doc.about ? `<div class="eyebrow">${inline(doc.about)}</div>` : ""}<h1>${inline(doc.title)}</h1><p class="tldr">${inline(doc.tldr)}</p></header>
<section class="get" aria-label="What you get"><div class="col-head"><h2>What you get</h2><span>open one to see it</span></div><div class="dtiles">
${tiles}
</div></section>
<section class="cols" aria-label="What to decide">
${column("Questions for you", "answer these", qCards, "Nothing to answer: every call is settled.")}
${column("Edge cases", "what if", eCards, "None found worth a look.")}
</section>
${settled}
</section>`;

  const navItem = (id, text, pipCls) => `<button class="it" data-open="${id}" aria-current="false"><span class="pip ${pipCls}" data-pip="${id}"></span>${inlineInLink(text)}</button>`;
  const mini = `<aside class="mini" aria-label="All cards">
<button class="all" data-open=""><span class="eyebrow">The map</span><b>← Back to all cards</b></button>
<div class="g get-list"><div class="eyebrow">You get</div>${doc.deliverables.map((d, k) => `<button class="it file" data-open="${ids.d(k)}" aria-current="false">${FILE_ICON}${inlineInLink(d.name)}</button>`).join("")}</div>
<div class="nav">${doc.questions.length ? `<div class="g"><div class="eyebrow">Questions for you</div>${doc.questions.map((q, k) => navItem(ids.q(k), q.question, questionStatus(q).cls)).join("")}</div>` : ""}${doc.edgeCases.length ? `<div class="g"><div class="eyebrow">Edge cases</div>${doc.edgeCases.map((e, k) => navItem(ids.e(k), e.title, edgeStatus(e).cls)).join("")}</div>` : ""}</div>
</aside>`;

  const head = (eyebrow, h, line, status) => `<div class="head"><div class="eyebrow">${eyebrow}</div><h2>${inline(h)}</h2><p class="line">${inline(line)}</p>${status ? `<div>${status}</div>` : ""}</div>`;
  const dPanels = doc.deliverables.map((d, k) =>
    `<article class="panel" data-card="${ids.d(k)}" hidden>${head(`What you get${d.kind ? ` · ${inline(d.kind)}` : ""}`, d.name, d.line)}${pic(d.picture)}${from(d.from)}${fold(d.more)}</article>`);
  const qPanels = doc.questions.map((q, k) => {
    const id = ids.q(k);
    const chosen = q.options.findIndex((x) => x.chosen);
    const options = q.options.map((x, j) => {
      const badges = [x.chosen ? "You chose this" : "", x.recommended ? "Recommended" : ""].filter(Boolean).map((b) => `<span class="rec">${b}</span>`).join("");
      return `<div class="opt" data-k="${LETTERS[j]}"><button class="ot" data-q="${id}" data-k="${LETTERS[j]}" aria-pressed="false"><span class="letter">${LETTERS[j]}</span><span class="name">${inlineInLink(x.name)}</span>${badges ? `<span class="badges">${badges}</span>` : ""}</button>` +
        `<div class="gc"><div class="gv"><span class="lab">Gives</span>${list(x.gives)}</div><div class="cs"><span class="lab">Costs</span>${list(x.costs)}</div></div></div>`;
    }).join("");
    const rec = q.options.findIndex((x) => x.recommended);
    return `<article class="panel" data-card="${id}" data-n="${k + 1}" data-rec="${LETTERS[rec]}"${chosen >= 0 ? ` data-chosen="${LETTERS[chosen]}"` : ""} hidden>` +
      `${head(`Question ${k + 1}`, q.question, q.line, chip(questionStatus(q), id))}${pic(q.picture)}<div class="options">${options}</div><p class="why">${inline(q.why)}</p>${from(q.from)}${fold(q.more)}</article>`;
  });
  const ePanels = doc.edgeCases.map((e, k) => {
    const id = ids.e(k);
    return `<article class="panel" data-card="${id}" data-n="${k + 1}" data-title="${esc(e.title)}" hidden>${head(`Edge case ${k + 1}`, e.title, e.line, chip(edgeStatus(e)))}` +
      `<p class="prose">${inline(e.happens)}</p>${pic(e.picture)}<div class="side"><div class="eyebrow">To consider</div><p class="prose">${inline(e.consider)}</p></div>${from(e.from)}` +
      `<div class="choice"><button class="tog" data-e="${id}" data-v="ok" aria-pressed="false">Looks right</button><button class="tog" data-e="${id}" data-v="discuss" aria-pressed="false">Let's discuss</button></div>${fold(e.more)}</article>`;
  });

  const content = `<div class="dv">
<nav class="bar" aria-label="Plan"><div class="bar-in"><button class="home" data-open="">${inlineInLink(doc.title)}</button><span class="picks" aria-live="polite"></span><button class="btn send" disabled>Copy answers</button><input class="fallback" readonly hidden aria-label="Your answers"></div></nav>
<div class="body">
${map}
<section class="zoom" hidden>
${mini}
<div class="panels">
${[...dPanels, ...qPanels, ...ePanels].join("\n")}
</div>
</section>
</div>
</div>`;
  const headTags = `<meta charset="utf-8">\n<title>${esc(o.name)}</title>\n${FONTS}\n<style>\n${CSS}</style>`;
  const html = o.whole
    ? `<!doctype html>\n<html lang="en">\n<head>\n<meta name="viewport" content="width=device-width, initial-scale=1">\n${headTags}\n</head>\n<body>\n${content}\n<script>\n${JS}</script>\n</body>\n</html>\n`
    : `${headTags}\n${content}\n<script>\n${JS}</script>\n`;
  return { html };
}
