// Draws a page from its parsed data: the same data always gives the same page. The styles (page.css) and the page's
// own script (page.js) are fixed; only the content comes from the data.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blocks, boxes, readTarget } from "./check.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(path.join(here, "page.css"), "utf8");
const JS = readFileSync(path.join(here, "page.js"), "utf8");
const FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500;6..72,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">';

export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Inline markdown: `code`, **bold**, *emphasis* and [links](url). A link goes only to http(s), mailto or a place
// on the page; any other is shown as its words.
const emphasis = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
export function inline(text) {
  return String(text).split(/(`[^`]+`)/).map((part) => {
    if (/^`[^`]+`$/.test(part)) return `<code>${esc(part.slice(1, -1))}</code>`;
    return part.split(/(\[[^\]]+\]\([^)\s]+\))/).map((piece) => {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(piece);
      if (!link) return emphasis(piece);
      return /^(https?:|mailto:|#)/i.test(link[2]) ? `<a href="${esc(link[2])}">${emphasis(link[1])}</a>` : emphasis(link[1]);
    }).join("");
  }).join("");
}

/**
 * @param {object} doc parsed by read.mjs
 * @param {{ plan: boolean, eyebrow: string, fingerprint?: string, approvedNow?: boolean, previous?: Set<string> | null, whole?: boolean }} o
 * @returns {{ html: string, keys: Set<string>, outlined: number }}
 */
export function render(doc, o) {
  const keys = new Set();
  let outlined = 0;
  // Marks a part changed since the copy the reader last saw, by its source words.
  const since = (key) => {
    keys.add(key);
    if (!o.previous || o.previous.has(key)) return "";
    outlined++;
    return " since";
  };
  // A class attribute holding base, and "since" when the part changed.
  const cls = (key, base = "") => {
    const c = (base + since(key)).trim();
    return c ? ` class="${c}"` : "";
  };
  const comments = o.plan;
  const changeIds = new Map(blocks(doc, "changes").flatMap((b) => b.rows.map((r) => [r.title, r.id])));
  let where = [];

  // Paragraphs, lists, subheadings, tables and code, each as the data gives it.
  const prose = (n) => {
    switch (n.type) {
      case "p":
        return `<p${cls(n.text, "prose")}>${inline(n.text)}</p>`;
      case "h3":
        return `<h3${cls(n.text)}>${inline(n.text)}</h3>`;
      case "list": {
        const tag = n.ordered ? "ol" : "ul";
        return `<${tag} class="prose">${n.items.map((t) => `<li${cls(t)}>${inline(t)}</li>`).join("")}</${tag}>`;
      }
      case "table":
        return `<div class="tablewrap"><table><thead><tr>${n.head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${n.rows
          .map((r) => `<tr${cls(r.join("|"))}>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
      case "code":
        return `<pre${cls(n.lines.join("\n"))}>${esc(n.lines.join("\n"))}</pre>`;
    }
    return "";
  };

  const cmt = (box) => (comments ? `<button type="button" class="cmt" data-words="${esc(box.text)}" data-at="${esc(where.filter(Boolean).join(" › "))}">Comment</button>` : "");
  const MK = { "+": '<span class="mk new">+ new</span>', "~": '<span class="mk chg">~ changed</span>', "-": '<span class="mk gone">− removed</span>' };

  const arrow = '<div class="arrow"><div class="stem"></div></div>';
  const col = (items, newFlow) => `<div class="col">${items.map((b) => boxHtml(b, newFlow)).join(arrow)}</div>`;
  const boxHtml = (b, newFlow) => {
    const cls = ["n", b.kind === "step" ? "" : b.kind, b.mark ?? "", b.flowMark === "-" ? "removed" : ""].filter(Boolean).join(" ");
    const mk = b.flowMark && !newFlow ? MK[b.flowMark] ?? "" : "";
    const mark = b.mark ? ` <span class="mark ${b.mark}">${b.mark === "ok" ? "✓" : "✗"}</span>` : "";
    const whereSpan = b.where ? `<span class="where">${esc(b.where)}</span>` : "";
    const change = b.change ? `<a class="to-change" href="#${changeIds.get(b.change) ?? ""}">change: ${esc(b.change)}</a>` : "";
    const warns = (b.flags ?? []).map((f) => `<div class="warn${since(`${f.kind}: ${f.text}`)}"><b>Look closely · ${esc(f.kind)}</b>: ${inline(f.text)}</div>`).join("");
    const id = b.whereId ? ` id="${b.whereId}"` : "";
    const onlyLane = b.lanes?.length === 1 ? b.lanes[0] : null;
    const side = onlyLane ? `<div class="side"><div class="exit">${esc(onlyLane.label)}</div>${col(onlyLane.items, newFlow)}</div>` : "";
    const note = b.note ? (side ? `<div class="note">${inline(b.note)}</div>` : "") : "";
    const row = `<div class="row"><div class="cell"${id}><div class="${cls}${since(b.source)}">${mk}${inline(b.text)}${mark}${whereSpan}${change}</div>${warns}${side ? note : ""}${cmt(b)}</div>${side || (b.note ? `<div class="note">${inline(b.note)}</div>` : "")}</div>`;
    const lanes = b.lanes && !onlyLane
      ? `${arrow}<div class="br">${b.lanes.map((l) => `<div class="lane"><div class="exit">${esc(l.label)}</div>${l.items.length ? arrow + col(l.items, newFlow) : ""}</div>`).join("")}</div>`
      : "";
    const inner = b.inner ? `${arrow}<div class="inner">${col(b.inner, newFlow)}</div>` : "";
    return row + lanes + inner;
  };
  const chartHtml = (chart, title) => {
    if (!chart.columns) {
      where = [where[0], title];
      return `<div class="chart">${col(chart.items)}</div>`;
    }
    return `<div class="chart"><div class="sbs" style="--cols: ${chart.columns.length}">${chart.columns.map((c) => {
      where = [where[0], title, c.title];
      return `<div><h4>${inline(c.title)}</h4>${col(c.items)}</div>`;
    }).join("")}</div></div>`;
  };

  const quiz = [];
  const block = (b) => {
    switch (b.kind) {
      case "case":
        return `<div class="example">${b.content.map(prose).join("\n")}</div>`;
      case "screens":
      case "trace":
      case "chart": {
        const head = b.title ? `<h3 id="${b.id}"${cls(b.title)}>${inline(b.title)}</h3>` : "";
        const about = b.about ? `<p class="desc">${inline(b.about)}</p>` : "";
        return `${head}${about}<figure>${chartHtml(b.chart, b.title)}</figure>`;
      }
      case "question": {
        quiz.push(b);
        const answer = "ABC"[b.options.findIndex((x) => x.right)];
        const look = b.read ? `<a href="#${readTarget(o.targets, b.read) ?? ""}">${inline(b.read)}</a>` : "";
        const key = [b.question, ...b.options.map((x) => `${x.right ? "*" : "-"} ${x.text}`), b.read, b.why].join("\n");
        return `<div class="qz${since(key)}" data-answer="${answer}"${b.source ? ` data-source="${esc(b.source)}"` : ""}><p class="qt">${inline(b.question)}</p>${look ? `<p class="hint">Where to look: ${look}</p>` : ""}<div class="opts">${b.options
          .map((x, k) => `<button type="button" class="opt" data-letter="${"ABC"[k]}">${"ABC"[k]}. ${inline(x.text)}</button>`).join("")}</div><div class="fb" hidden><strong class="verdict"></strong> ${inline(b.why ?? "")}${look ? ` See it in ${look}` : ""}${b.source ? ` <span class="src">· ${b.source === "map" ? "the map" : esc(b.source)}</span>` : ""}</div></div>`;
      }
      case "choice": {
        const title = b.number !== null ? `${b.number} · ${b.question}` : b.question;
        const key = [title, b.recommended, ...b.alternatives, b.why].join("\n");
        const ask = b.number === null ? `<p class="ask">${inline(b.question)} Pick an option to copy your answer, or answer in the chat.</p>` : "";
        // Each option is a button that gives the chat its answer: "3 A" on a plan, the letter and the option's name on an
        // explanation.
        const picks = [b.recommended, ...b.alternatives].map((text, k) => {
          const letter = "ABCD"[k];
          const line = b.number !== null ? `${b.number} ${letter}` : `${letter} · ${b.names[k] ?? ""}`;
          const tag = k === 0 ? '<span class="tag rec">recommended</span> ' : "";
          return `<button type="button" class="pick" aria-pressed="false" data-line="${esc(line)}"><span class="letter">${letter}</span><span>${tag}${k === 0 ? `<strong>${inline(text ?? "")}</strong>` : inline(text)}</span></button>`;
        }).join("");
        return `<div class="decision${since(key)}" id="${b.id}"><h3>${inline(title)}</h3><div class="picks">${picks}</div><div class="picked"><code hidden></code><p class="desc" hidden></p></div><figure>${chartHtml(b.chart, title)}${b.why ? `<figcaption>${inline(b.why)}</figcaption>` : ""}</figure></div>${ask}`;
      }
      case "changes":
        return `<div class="tablewrap"><table><thead><tr><th>Change</th><th>What users get</th><th>Why</th></tr></thead><tbody>${b.rows
          .map((r) => `<tr id="${r.id}"${cls(`${r.title}|${r.gets}|${r.why}`)}><td>${inline(r.title)}</td><td>${inline(r.gets)}</td><td>${inline(r.why)}</td></tr>`).join("")}</tbody></table></div>`;
      case "settled":
        return `<ul class="settled">${b.rows.map((r) => {
          const model = /^(Claude|Codex|the agent|the model)\b/i.test(r.who);
          const tag = model ? `<span class="tag model">${esc(r.who)}'s call</span>` : `<span class="tag who">Decided by ${esc(r.who)}</span>`;
          const from = r.from ? ` <span class="tag alt">${esc(r.from)}</span>` : "";
          return `<li${cls(`${r.who}: ${r.text}`)}><span>${tag}${from}</span><span>${inline(r.text)}</span></li>`;
        }).join("")}</ul>`;
      case "names":
        return `<dl class="names">${b.rows.map((r) => `<dt id="${r.id}"${r.also.length ? ` data-also="${esc(r.also.join(","))}"` : ""}${cls(`${r.name}: ${r.text}`)}>${esc(r.name)}</dt><dd>${inline(r.text)}</dd>`).join("")}</dl>`;
      case "flow": {
        const newFlow = b.nameMark === "+";
        where = [where[0], b.name];
        const tag = newFlow ? '<span class="tag rec">new flow</span> ' : b.nameMark === "-" ? '<span class="tag alt">removed flow</span> ' : "";
        const heading = `<h3${cls(`Flow: ${b.name}`)}>${tag}${inline(b.name)}</h3>`;
        const chart = `<figure><div class="chart">${col(b.items, newFlow)}</div></figure>`;
        if (!o.plan) return `<section class="flowbox" id="${b.id}">${heading}${chart}</section>`;
        // On a plan, a closed row: its line says what opening it shows. A flow marked as a whole has its tag, not counts.
        const all = boxes(b.items);
        const counts = b.nameMark !== " " ? "" : [["+", "+", "new", "new"], ["~", "~", "chg", "changed"], ["-", "−", "gone", "removed"]].map(([mark, sign, c, word]) => {
          const n = all.filter((x) => x.flowMark === mark).length;
          return n ? `<span class="mk ${c}">${sign}${n} ${word}</span>` : "";
        }).join("");
        return `<details class="flowbox" id="${b.id}"><summary>${heading}<span class="row-meta">${counts}<span>${all.length} step${all.length === 1 ? "" : "s"}</span></span></summary>${chart}</details>`;
      }
    }
    return "";
  };
  const node = (n) => (n.type === "block" ? block(n) : prose(n));

  const body = [];
  body.push(`<header><div class="eyebrow">${o.eyebrow}</div><h1>${inline(doc.title)}</h1>${doc.approved ? `<p class="approval">Approved: ${esc(doc.approved)}</p>` : ""}%%LEGEND%%</header>`);
  if (doc.intro.length) body.push(`<section>${doc.intro.map(node).join("\n")}</section>`);
  for (const s of doc.sections) {
    where = [s.heading];
    const ask = /^Questions from /.test(s.heading) ? '<p class="ask">Pick an option on each question to copy your answers, such as "1 A, 3 B", and paste them into the chat. Or type them there, or use Comment on a box.</p>' : "";
    const send = doc.send ? '<div class="send" hidden><button type="button" id="send-answers">Send answers</button><code hidden></code><p class="desc" hidden></p></div>' : "";
    const score = s.nodes.some((n) => n.kind === "question") ? `<p class="score" hidden></p>${send}` : "";
    const nodes = s.nodes.map(node).join("\n");
    body.push(`<section><h2 id="${s.id}">${inline(s.heading)}</h2>\n${s.nodes.some((n) => n.kind === "question") ? `<div class="qs">${nodes}</div>` : nodes}${score}${ask}</section>`);
  }
  if (o.plan) {
    const approve = o.approvedNow
      ? `<p><span class="approved">Approved</span> ${esc(doc.approved)}</p>`
      : `<p>Answer the questions and comment in the chat, or with Comment on any box. When the plan is right, press Approve plan, or type approve in the chat. Any question still open is then asked there.</p><button type="button" class="approve-btn" data-line="Approve plan ${o.fingerprint}">Approve plan</button><code hidden></code><p class="desc" hidden></p>`;
    body.push(`<section><h2 id="s-approve">Approve</h2><div class="approve">${approve}</div></section>`);
  }
  const legend = outlined ? '<p class="since-legend">Outlined: changed since the page you last read.</p>' : "";
  const content = body.join("\n").replace("%%LEGEND%%", legend);
  const head = `<meta charset="utf-8">\n<title>${esc(o.name)}</title>\n${FONTS}\n<style>\n${CSS}</style>`;
  const page = `${head}\n<div class="wrap">\n${content}\n</div>\n<script>\n${JS}</script>\n`;
  const html = o.whole
    ? `<!doctype html>\n<html lang="en">\n<head>\n<meta name="viewport" content="width=device-width, initial-scale=1">\n${head}\n</head>\n<body>\n<div class="wrap">\n${content}\n</div>\n<script>\n${JS}</script>\n</body>\n</html>\n`
    : page;
  return { html, keys, outlined };
}

