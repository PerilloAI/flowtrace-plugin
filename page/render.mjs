// Draws a page from its parsed data: the same data always gives the same page. The styles (page.css) and the page's
// own script (page.js) are fixed; only the content comes from the data.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STEPS, WHOLE, blocks, foldsCalls, minutes, readTarget, reading } from "./check.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(path.join(here, "page.css"), "utf8");
const JS = readFileSync(path.join(here, "page.js"), "utf8");
export const FONTS =
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
// The same words for inside a link, which can't hold another: a link in them is shown as its words.
export const inlineInLink = (text) => inline(String(text).replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1"));

/**
 * @param {object} doc parsed by read.mjs
 * @param {{ plan: boolean, eyebrow: string, fingerprint?: string, approvedNow?: boolean, previous?: Set<string> | null, whole?: boolean }} o
 * @returns {{ html: string, keys: Set<string>, outlined: number }}
 */
export function render(doc, o) {
  const keys = new Set();
  let outlined = 0;
  // Marks a part changed since the copy the reader last saw, by its source words.
  const changedSince = (key) => Boolean(o.previous) && !o.previous.has(key);
  const since = (key) => {
    keys.add(key);
    if (!changedSince(key)) return "";
    outlined++;
    return " since";
  };
  // A class attribute holding base, and "since" when the part changed.
  const cls = (key, base = "") => {
    const c = (base + since(key)).trim();
    return c ? ` class="${c}"` : "";
  };
  const comments = o.plan;
  let where = [];

  const minutesSaid = (m) => (m === 1 ? "one minute" : `${m} minutes`);
  // A plan's steps, in order, and the question numbers each holds.
  const steps = o.plan ? blocks(doc, "step") : [];
  const asks = (st) => st.choices.map((c) => c.number).filter((n) => n !== null);

  // Paragraphs, lists, subheadings, tables and code, each as the data gives it.
  const prose = (n) => {
    switch (n.type) {
      case "p":
        return `<p${cls(n.text, "prose")}>${inline(n.text)}</p>`;
      case "h3":
        return `<h3${n.id ? ` id="${n.id}"` : ""}${cls(n.text)}>${inline(n.text)}</h3>`;
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
    // The part of the system a step runs in, on a change large enough to show how its pieces fit (teaching.md).
    const partTag = b.part ? `<span class="part">${inline(b.part)}</span>` : "";
    const id = b.whereId ? ` id="${b.whereId}"` : "";
    // The example as it is at this step, drawn inside the step's card under its words, with where it came from.
    const pic = b.shows ? `<div class="pic">${b.shows.html.join("\n")}</div><div class="pic-src">${b.shows.from ? inline(b.shows.from) : "Drawn for this page"}</div>` : "";
    const onlyLane = b.lanes?.length === 1 ? b.lanes[0] : null;
    const side = onlyLane ? `<div class="side"><div class="exit">${esc(onlyLane.label)}</div>${col(onlyLane.items, newFlow)}</div>` : "";
    const note = b.note ? (side ? `<div class="note">${inline(b.note)}</div>` : "") : "";
    const row = `<div class="row"><div class="cell"${id}><div class="${cls}${since(b.source)}">${partTag}${mk}${inline(b.text)}${mark}${whereSpan}${pic}</div>${side ? note : ""}${cmt(b)}</div>${side || (b.note ? `<div class="note">${inline(b.note)}</div>` : "")}</div>`;
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

  // A plan's decisions: what was decided, who decided it and how, the moment, and where it came from. Each of Claude's
  // calls can be flipped to one of its alternatives, which adds "call <n> <letter>" to the answers given to the chat.
  const approvedAt = doc.approved?.split(" · ")[1] ?? null;
  const moment = (at) => esc(at.replace("T", " ").replace(/([+-]\d{2}:\d{2}|Z)$/, " $1"));
  // Claude's calls are numbered in the order the file holds them, however the page groups them.
  const callNumber = new Map(blocks(doc, "settled").flatMap((b) => b.rows).filter((r) => r.how === "claude").map((r, k) => [r, k + 1]));
  const calls = callNumber.size;
  const settledTable = (rows) => {
    if (!rows.length) return "";
    const body = rows.map((r) => {
      const key = `${r.who}: ${r.how}: ${r.text}: ${r.alternatives.join("|")}`;
      if (r.how !== "claude") {
        const by = { chose: `${esc(r.who)} chose`, said: `${esc(r.who)} said`, rule: "A rule" }[r.how];
        return `<tr${cls(key)}><td>${inline(r.text)}</td><td><span class="by ${r.how}">${by}</span></td><td class="when">${r.at ? moment(r.at) : ""}</td><td class="from">${r.from ? inline(r.from) : ""}</td></tr>`;
      }
      const n = callNumber.get(r);
      const flips = r.alternatives.map((a, k) => `<button type="button" class="flip-pick" aria-pressed="false" data-line="call ${n} ${"BCD"[k] ?? "?"}"><span class="letter">${"BCD"[k] ?? "?"}</span><span>${inline(a)}</span></button>`).join("");
      const when = o.approvedNow && approvedAt ? `Accepted with the plan, ${moment(approvedAt)}` : o.plan ? "Accepted when you approve" : "Stands unless you flip it";
      const wrong = r.wrongIf ? `<p class="wrong-if"><strong>Wrong if:</strong> ${inline(r.wrongIf)}</p>` : "";
      return `<tr class="call${since(`${key}: ${r.wrongIf ?? ""}`)}" data-call="${n}"><td><span class="was">${inline(r.text)}</span>${wrong}${o.approvedNow ? "" : `<button type="button" class="flip" aria-expanded="false">Flip</button><div class="flips">${flips}</div>`}</td><td><span class="by claude">${esc(r.who)}'s call ${n}</span></td><td class="when wait">${when}</td><td class="from">${r.from ? inline(r.from) : ""}</td></tr>`;
    }).join("");
    return `<div class="tablewrap"><table class="decided"><thead><tr><th>Decision</th><th>Decided by</th><th>When</th><th>From</th></tr></thead><tbody>${body}</tbody></table></div>`;
  };
  const flippedLine = calls ? '<div class="flipped-line"><code hidden></code><p class="desc" hidden></p></div>' : "";
  // On a plan, the calls most likely to be wrong come first, each saying what would make it wrong; Claude's other calls
  // fold under a line counting them; the rest are drawn as on any page.
  const folds = o.plan && foldsCalls(doc);
  const settledHtml = (rows) => {
    if (!folds) return settledTable(rows) + flippedLine;
    const risky = rows.filter((r) => r.how === "claude" && r.wrongIf);
    const smaller = rows.filter((r) => r.how === "claude" && !r.wrongIf);
    const rest = rows.filter((r) => r.how !== "claude");
    const first = risky.length ? `<h4 class="sub">Calls most likely to be wrong</h4>${settledTable(risky)}` : "";
    const more = smaller.length ? `<details class="more-calls"><summary>Claude's other ${smaller.length === 1 ? "call" : `${smaller.length} calls`}, each yours to flip</summary>${settledTable(smaller)}</details>` : "";
    return `${first}${more}${settledTable(rest)}${flippedLine}`;
  };

  const quiz = [];
  const block = (b) => {
    switch (b.kind) {
      case "case":
      case "chart": {
        const head = b.title ? `<h3 id="${b.id}"${cls(b.title)}>${inline(b.title)}</h3>` : "";
        const about = b.about ? `<p class="desc${since(b.about)}">${inline(b.about)}</p>` : "";
        return `${head}${about}<figure>${chartHtml(b.chart, b.title)}</figure>`;
      }
      case "question": {
        quiz.push(b);
        const answer = "ABC"[b.options.findIndex((x) => x.right)];
        const look = b.read ? `<a href="#${readTarget(o.targets, b.read) ?? ""}">${inline(b.read)}</a>` : "";
        const key = [b.question, ...b.options.map((x) => `${x.right ? "*" : "-"} ${x.text}`), b.read, b.why].join("\n");
        // The case charted up to the step asked about, then each option a card holding its chart on from there. The card's
        // words are its button; a click elsewhere on the card picks it too, unless it lands on a link or a button in it.
        const caseChart = `<figure class="qcase">${chartHtml({ items: b.case }, b.question)}</figure>`;
        const opts = b.options.map((x, k) => {
          const letter = "ABC"[k];
          return `<div class="opt-card" data-letter="${letter}"><button type="button" class="opt" data-letter="${letter}"><span class="letter">${letter}</span><span>${inline(x.text)}</span></button>${chartHtml({ items: x.items }, `${b.question} › ${letter}`)}</div>`;
        }).join("");
        return `<div class="qz${since(key)}" data-answer="${answer}"><p class="qt">${inline(b.question)}</p>${look ? `<p class="hint">Where to look: ${look}</p>` : ""}${caseChart}<div class="opts">${opts}</div><div class="fb" hidden><strong class="verdict"></strong> ${inline(b.why ?? "")}${look ? ` See it in ${look}` : ""}</div></div>`;
      }
      case "choice": {
        const title = b.number !== null ? `${b.number} · ${b.question}` : b.question;
        const key = [title, b.recommended, ...b.alternatives, b.why, b.decides ?? ""].join("\n");
        const ask = b.number === null ? `<p class="ask">${inline(b.question)} Pick an option to copy your answer, or answer in the chat.</p>` : "";
        // Each option is a button that gives the chat its answer: "3 A" on a plan, the letter and the option's name on an
        // explanation.
        // Each option is a card: its button (letter, name and sentence) and its chart. A click elsewhere on the card picks it
        // too, unless it lands on a link or a button in it.
        const picks = [b.recommended, ...b.alternatives].map((text, k) => {
          const letter = "ABCD"[k];
          const line = b.number !== null ? `${b.number} ${letter}` : `${letter} · ${b.names[k] ?? ""}`;
          const tag = k === 0 ? '<span class="tag rec">recommended</span> ' : "";
          const column = b.chart.columns[k];
          const chart = column ? chartHtml({ items: column.items }, `${title} › ${column.title}`) : "";
          return `<div class="pick-card"><button type="button" class="pick" aria-pressed="false" data-line="${esc(line)}"><span class="letter">${letter}</span><span><span class="pick-name">${tag}${inline(b.names[k] ?? "")}</span><span class="pick-says">${k === 0 ? `<strong>${inline(text ?? "")}</strong>` : inline(text ?? "")}</span></span></button>${chart}</div>`;
        }).join("");
        // How the case goes today comes right under the question, before the options that would change it.
        const today = b.today ? `<h4 class="today">How it works today</h4><figure>${chartHtml({ items: b.today }, `${title} › Today`)}</figure>` : "";
        // What decides it comes before the options.
        const decides = b.decides ? `<div class="decides"><h4 class="today">What decides it</h4><p>${inline(b.decides)}</p></div>` : "";
        return `<div class="decision${since(key)}" id="${b.id}"><h3>${inline(title)}</h3>${today}${decides}<div class="picks">${picks}</div><div class="picked"><code hidden></code><p class="desc" hidden></p></div>${b.why ? `<p class="why">${inline(b.why)}</p>` : ""}</div>${ask}`;
      }
      case "settled":
        if (b.rows.some((r) => r.how)) return settledHtml(b.rows);
        return `<ul class="settled">${b.rows.map((r) => {
          const model = /^(Claude|Codex|the agent|the model)\b/i.test(r.who);
          const tag = model ? `<span class="tag model">${esc(r.who)}'s call</span>` : `<span class="tag who">Decided by ${esc(r.who)}</span>`;
          const from = r.from ? ` <span class="tag alt">${esc(r.from)}</span>` : "";
          return `<li${cls(`${r.who}: ${r.text}`)}><span>${tag}${from}</span><span>${inline(r.text)}</span></li>`;
        }).join("")}</ul>`;
      case "names":
        // A name the field calls by another, its own name beside it, for whoever goes on to the field's docs.
        return `<dl class="names">${b.rows.map((r) => `<dt id="${r.id}"${r.also.length ? ` data-also="${esc(r.also.join(","))}"` : ""}${cls(`${r.name}: ${r.usual ?? ""}: ${r.text}`)}>${esc(r.name)}</dt><dd>${r.usual ? `<span class="usual">The field calls it <b>${esc(r.usual)}</b></span> ` : ""}${inline(r.text)}</dd>`).join("")}</dl>`;
      case "flow": {
        const newFlow = b.nameMark === "+";
        where = [where[0], b.name];
        const tag = newFlow ? '<span class="tag rec">new flow</span> ' : b.nameMark === "-" ? '<span class="tag alt">removed flow</span> ' : "";
        const heading = `<h3${cls(`Flow: ${b.name}`)}>${tag}${inline(b.name)}</h3>`;
        const chart = `<figure><div class="chart">${col(b.items, newFlow)}</div></figure>`;
        return `<section class="flowbox" id="${b.id}">${heading}${chart}</section>`;
      }
      case "whole": {
        // The whole change: what it gives, its picture, what is asked, then a labelled line each and the map of plans.
        const pic = `<figure class="whole-pic"><div class="pic">${b.shows.html.join("\n")}</div><div class="pic-src">${b.shows.from ? inline(b.shows.from) : "Drawn for this page"}</div></figure>`;
        const line = (label, html) => `<dt>${label}</dt><dd>${html}</dd>`;
        const facts = [
          line("For", inline(b.for)), line("In", inline(b.in)), line("Left out for now", inline(b.out)), line("Assumes", inline(b.assumes)),
          b.unknown ? line("Not known yet", inline(b.unknown)) : "",
        ].join("");
        const map = b.map ? `<ol class="map" aria-label="The plans toward the larger change">${b.map.map((m) => `<li${m.here ? ' class="here" aria-current="step"' : ""}>${m.here ? '<span class="tag rec">this plan</span> ' : ""}${inline(m.text)}</li>`).join("")}</ol>` : "";
        return `<div class="whole${since(b.source)}"><p class="problem"><span class="lbl">The problem today</span>${inline(b.problem)}</p><p class="gets"><span class="lbl">With this plan</span>${inline(b.gets)}</p>${pic}<p class="asking">${inline(b.asking)}</p><dl class="facts">${facts}</dl>${map}</div>${storyline()}`;
      }
      case "step":
        return stepHtml(b);
    }
    return "";
  };
  const node = (n) => (n.type === "block" ? block(n) : prose(n));

  // Every step's name on one line, in order, each linking to its step, those holding a question for the author marked;
  // then how many steps there are and how long the gist and the whole take to read.
  const storyline = () => {
    if (!o.plan || !steps.length) return "";
    const read = reading(doc);
    const mine = steps.filter((st) => asks(st).length);
    const items = steps.map((st) => `<li${asks(st).length ? ' class="mine"' : ""}><a href="#${st.id}"><span class="n">${st.number}</span> ${inlineInLink(st.label ?? st.title)}</a></li>`).join("");
    const held = mine.length ? ` ${mine.length === 1 ? `Step ${mine[0].number} holds` : `Steps ${mine.map((st) => st.number).join(", ")} hold`} a question for you, shaded.` : "";
    return `<h3 class="storyhead">Everything that will happen, in order</h3><ol class="storyline">${items}</ol><p class="desc">${steps.length} step${steps.length === 1 ? "" : "s"}, each ending in something you can look at.${held} The gist alone reads in about ${minutesSaid(minutes(read.gist))}; the whole page, with how each step works, in about ${minutesSaid(minutes(read.total))}.</p>`;
  };

  // One step of the storyboard: its number, its picture beside its words (the gist, how it works, the cases it makes come
  // true, the trade-off made there or the question that is the author's, and what they will see), and once the build
  // has started, where the build stands at it: what the plan promised beside what it showed, what it found, and on a
  // stopped step its causes and a box whose words go to the chat as "step <n>: <their words>".
  const STATE = { now: "Building now", done: "Done", stopped: "Stopped for you", not: "Not started" };
  const stepHtml = (st) => {
    const n = st.number;
    where = [where[0], `Step ${n}`];
    const item = doc.build?.[n - 1] ?? null;
    const state = doc.build ? item?.state ?? "not" : null;
    const questions = asks(st);
    const tags = [
      state ? `<span class="state ${state}">${STATE[state]}</span>` : "",
      questions.length ? `<span class="tag mine">Your call · question ${questions.join(", ")}</span>` : "",
      st.unknown ? '<span class="tag unk">Tests what nobody knows yet</span>' : "",
    ].filter(Boolean).join(" ");
    const pic = `<div class="step-pic"><div class="pic">${st.shows.html.join("\n")}</div>${st.caption ? `<p class="cap">${inline(st.caption)}</p>` : ""}<div class="pic-src">${st.shows.from ? inline(st.shows.from) : "Drawn for this page"}</div></div>`;
    // How it works, drawn: the example at each moment of the step, one frame under the other, each with its picture and,
    // beside it, its caption and the notes that belong to it; or a chart when the step branches. Then the numbers that decide, where it goes wrong
    // first, and any detail left, as lists, tables and charts.
    const frames = () => {
      const items = st.drawn.chart.items;
      const strip = items.map((f, k) => {
        where = [where[0], `Step ${n}`, `Frame ${k + 1}`];
        return `<li class="frame cell${since(f.source)}"><div class="fhead"><span class="fn">${k + 1}</span>${f.part ? `<span class="part">${inline(f.part)}</span>` : ""}</div><div class="fpic"><div class="pic">${f.shows.html.join("\n")}</div>${f.shows.from ? `<div class="pic-src">${inline(f.shows.from)}</div>` : ""}</div><div class="fwords"><p class="fcap">${inline(f.text)}</p>${f.notes.length ? `<ul class="fnotes">${f.notes.map((t) => `<li>${inline(t)}</li>`).join("")}</ul>` : ""}</div>${cmt(f)}</li>`;
      }).join("");
      where = [where[0], `Step ${n}`];
      return `<ol class="frames">${strip}</ol>${items.some((f) => !f.shows.from) ? '<div class="pic-src">Pictures drawn for this page</div>' : ""}`;
    };
    const decides = st.decides.length
      ? `<div class="tablewrap decides"><table><thead><tr><th>The number</th><th>What it decides</th></tr></thead><tbody>${st.decides.map((d) => `<tr${cls(`${d.number}|${d.decides}`)}><td>${inline(d.number)}</td><td>${inline(d.decides)}</td></tr>`).join("")}</tbody></table></div>`
      : "";
    const breaks = `<p class="breaks${since(`breaks: ${st.breaks}`)}"><strong>Where it goes wrong first:</strong> ${inline(st.breaks)}</p>`;
    const more = st.more.length ? `<div class="more-how"><h5>More detail</h5>${st.more.map(node).join("\n")}</div>` : "";
    const how = `<div class="tech"><h4>How it works</h4>${st.drawn.strip ? frames() : node(st.drawn)}${decides}${breaks}${more}</div>`;
    const cases = st.cases.length ? `<div class="step-cases"><h4>What a person gets</h4>${st.cases.map(node).join("\n")}</div>` : "";
    const t = st.trade;
    const trade = t ? `<div class="trade"><h4>The trade-off</h4><dl><dt>Chose</dt><dd>${inline(t.chose)}</dd><dt>Over</dt><dd>${inline(t.over)}</dd><dt>Because</dt><dd>${inline(t.because)}</dd><dt>It costs</dt><dd>${inline(t.costs)}</dd></dl></div>` : "";
    const choices = st.choices.length ? `<div class="step-choices">${st.choices.map(node).join("\n")}<p class="ask">Pick an option to copy your answer, such as "${questions[0] ?? 1} A", and paste it into the chat. Or type it there, or use Comment on a box.</p></div>` : "";
    const see = item
      ? `<div class="seesaw"><div><span class="lbl">Promised</span>${inline(st.see)}</div><div><span class="lbl">Showed</span>${item.saw ? inline(item.saw) : '<span class="desc">Nothing yet</span>'}</div></div>`
      : `<p class="see"><strong>You will see:</strong> ${inline(st.see)}</p>`;
    const found = item?.found ? `<p class="found"><strong>Found:</strong> ${inline(item.found)}</p>` : "";
    const code = item?.code?.length ? `<div class="tech built"><h4>Where it is in the code</h4><ul>${item.code.map((c) => `<li><code>${esc(c.where)}</code>${c.name ? ` · <code>${esc(c.name)}</code>` : ""} <span class="does">${inline(c.does)}</span></li>`).join("")}</ul></div>` : "";
    const causes = item?.causes ? `<div class="causes"><h4>What may have caused it, the cheapest to check first</h4><ol>${item.causes.map((c) => `<li>${inline(c.text)} <span class="check">Check: ${inline(c.check)}</span></li>`).join("")}</ol></div>` : "";
    const box = state === "stopped" ? `<div class="step-say" data-prefix="step ${n}"><p class="qt">Which check should run, or what do you think went wrong?</p><textarea rows="3" aria-label="Your words on step ${n}"></textarea><div class="say-go"><button type="button" class="step-btn" disabled>Send</button></div><code hidden></code><p class="desc" hidden></p></div>` : "";
    const key = `${st.source}: ${JSON.stringify(item)}`;
    return `<li class="step${state ? ` ${state}` : ""}${questions.length ? " mine" : ""}${since(key)}" id="${st.id}"><div class="num">${n}</div>${pic}<div class="step-head"><h3>${inline(st.title)}${tags ? ` ${tags}` : ""}</h3><p class="gist">${inline(st.gist)}</p></div><div class="step-body">${how}${cases}${trade}${choices}${see}${found}${code}${causes}${box}</div></li>`;
  };

  // After the last step: every trade-off in the order it is made, a step whose trade-off is the author's showing the
  // question that asks it; then, once every step is done, the author's account of what was built, or the box for it.
  const TELL = "Explain what was built, as you would to a colleague: what it does, how it is built, what was chosen over what and why, what that cost, and what you would do differently.";
  const afterSteps = () => {
    const rows = steps.filter((st) => st.trade || asks(st).length).map((st) => (st.trade
      ? `<tr><td>${st.number}</td><td>${inline(st.trade.chose)}</td><td>${inline(st.trade.over)}</td><td>${inline(st.trade.costs)}</td></tr>`
      : `<tr class="mine"><td>${st.number}</td><td colspan="3"><a href="#${st.id}">Your call: question ${asks(st).join(", ")}</a></td></tr>`)).join("");
    const trades = rows ? `<h3 id="h-every-trade-off">Every trade-off, in the order it is made</h3><div class="tablewrap"><table class="trades"><thead><tr><th>Step</th><th>Chose</th><th>Over</th><th>It costs</th></tr></thead><tbody>${rows}</tbody></table></div>` : "";
    const finished = doc.build && steps.length && doc.build.length === steps.length && doc.build.every((x) => x.state === "done");
    const told = doc.told
      ? `<div class="told${since(`told: ${JSON.stringify(doc.told)}`)}"><h3>You told it back</h3><p class="desc">${moment(doc.told.at)}</p><blockquote>${inline(doc.told.said)}</blockquote>${doc.told.right.length ? `<h4>What it had right</h4><ul>${doc.told.right.map((x) => `<li>${inline(x)}</li>`).join("")}</ul>` : ""}${doc.told.missed.length ? `<h4>What it missed</h4><ul>${doc.told.missed.map((x) => `<li>${inline(x)}</li>`).join("")}</ul>` : ""}</div>`
      : finished ? `<div class="say tell" data-prefix="told"><h3>Tell it back</h3><p class="qt">${TELL}</p><textarea rows="6" aria-label="What was built, in your own words"></textarea><div class="say-go"><button type="button" class="tell-btn" disabled>Send</button></div><code hidden></code><p class="desc" hidden></p></div>` : "";
    return `${trades}${told}`;
  };

  const body = [];
  // A plan's header says where it stands: approved or not, how many questions wait, how many cases change.
  const open = blocks(doc, "choice").length;
  const caseCount = blocks(doc, "case").length;
  const status = o.plan
    ? `<p class="status">${o.approvedNow ? `<span class="approval">Approved: ${esc(doc.approved)}</span>` : `<span class="pending">${doc.approved ? `Changed since it was approved (${esc(doc.approved)})` : "Not approved yet"}</span>`}<span><b>${steps.length}</b> step${steps.length === 1 ? "" : "s"}</span><span><b>${open}</b> question${open === 1 ? "" : "s"} for you</span><span><b>${caseCount}</b> case${caseCount === 1 ? "" : "s"} change</span></p>`
    : doc.approved ? `<p class="approval">Approved: ${esc(doc.approved)}</p>` : "";
  // A plan's switch: the gist and the technical parts, or the gist alone, which hides every step's "How it works".
  const show = o.plan && steps.length ? '<div class="seg" role="group" aria-label="How much to show"><button type="button" data-show="all" aria-pressed="true">The gist and the technical parts</button><button type="button" data-show="gist" aria-pressed="false">The gist only</button></div>' : "";
  body.push(`<header><div class="eyebrow">${o.eyebrow}</div><h1>${inline(doc.title)}</h1>${status}${show}%%LEGEND%%</header>`);
  if (doc.intro.length) body.push(`<section>${doc.intro.map(node).join("\n")}</section>`);
  for (const s of doc.sections) {
    where = [s.heading];
    if (o.plan) {
      // The steps, in order, as one list; after the last, every trade-off and the telling back.
      const nodes = s.heading === STEPS ? `<ol class="steps">${s.nodes.map(node).join("\n")}</ol>${afterSteps()}` : s.nodes.map(node).join("\n");
      body.push(`<section${s.heading === WHOLE ? ' class="top"' : ""}><h2 id="${s.id}">${inline(s.heading)}</h2>\n${nodes}</section>`);
      continue;
    }
    const ask = /^Questions from /.test(s.heading) ? '<p class="ask">Pick an option on each question to copy your answers, such as "1 A, 3 B", and paste them into the chat. Or type them there, or use Comment on a box.</p>' : "";
    const score = s.nodes.some((n) => n.kind === "question") ? `<p class="score" hidden></p>` : "";
    const nodes = s.nodes.map(node).join("\n");
    body.push(`<section><h2 id="${s.id}">${inline(s.heading)}</h2>\n${s.nodes.some((n) => n.kind === "question") ? `<div class="qs">${nodes}</div>` : nodes}${score}${ask}</section>`);
  }
  if (o.plan) {
    const approve = o.approvedNow
      ? `<p><span class="approved">Approved</span> ${esc(doc.approved)}</p>`
      : `<p>Answer the questions, flip any of Claude's calls under Already settled you'd make differently, and comment in the chat or with Comment on any box. When the plan is right, press Approve plan, or type approve in the chat. The approval records who approved and the moment, and accepts each of Claude's calls you left alone.</p><button type="button" class="approve-btn" data-line="Approve plan ${o.fingerprint}">Approve plan</button><code hidden></code><p class="desc" hidden></p>`;
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

