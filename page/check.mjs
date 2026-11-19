// The checks a page's data must pass before it is drawn: every rule blocks.md and plan-format.md mark **checked**, on
// the data itself, so the page is never read back. An explanation gets the rules its blocks share with a plan.
import { pictureProblems } from "./picture.mjs";
import { allNodes } from "./read.mjs";

export const WHOLE = "The whole thing";
export const STEPS = "What will happen, in order";
export const PLAN_SECTIONS = [WHOLE, "Plan changes", STEPS, "Already settled", "Names"];
// An explanation asks two reading questions: enough to show the reader understood, few enough to stay worth answering.
export const PAGE_QUESTIONS = 2;
// A step's gist is read on its own as the account of the whole build, so it stays short.
export const GIST_WORDS = 50;
// How a step works is drawn: a few frames, each a picture and a caption short enough to read at a glance.
export const FRAMES = [2, 8];
export const FRAME_WORDS = 25;
// A frame's notes carry the detail that belongs to it: a few, each short.
export const FRAME_NOTES = 3;
export const NOTE_WORDS = 25;
// What "more" holds is scanned, not read through: each item of a list and each cell of a table stays short.
export const MORE_WORDS = 30;
export const BREAKS_WORDS = 40;
export const DECIDES_WORDS = 20;
// Minutes to read, at 230 words a minute.
export const WORDS_A_MINUTE = 230;
export const minutes = (words) => Math.max(1, Math.ceil(words / WORDS_A_MINUTE));
// "<who> · <date and time, with its offset> · <fingerprint>", and what changed an approved plan since.
export const APPROVED = /^[^·]+ · \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[+-]\d{2}:\d{2}|Z) · [0-9a-f]{7}(?: · after (?:plan change \d+|plan-check))?$/;
const MOMENT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[+-]\d{2}:\d{2}|Z)$/;

// Every block of a page, a plan's steps and what each holds included.
export function blocks(doc, kind) {
  return allNodes(doc).filter((n) => n.type === "block" && (!kind || n.kind === kind));
}

// Every box of a chart or flow, lanes and inner boxes included.
export function boxes(items) {
  return items.flatMap((b) => [b, ...boxes(b.inner ?? []), ...(b.lanes ?? []).flatMap((l) => boxes(l.items))]);
}
export function chartBoxes(chart) {
  return chart.columns ? chart.columns.flatMap((c) => boxes(c.items)) : boxes(chart.items);
}
// Every box a block draws as a chart: a chart's, a case's, a choice's today and options, a question's case and options. A
// flow's steps are not a chart's.
export function blockChartBoxes(b) {
  if (b.kind === "question") return [...boxes(b.case), ...b.options.flatMap((o) => boxes(o.items))];
  return [...(b.chart ? chartBoxes(b.chart) : []), ...boxes(b.today ?? [])];
}

// Whether any of these steps draws the example as a picture.
const pictured = (items) => boxes(items).some((b) => b.shows);

// What a reader's question can name, and what a plan's page counts: its cases.
export const cases = (doc) => blocks(doc, "case");

// What a question's "read" can name: a chart's or flow's title, a section's heading, a subheading, or a step's "where".
export function targets(doc) {
  const ids = new Map();
  const add = (name, id) => name && !ids.has(name) && ids.set(name, id);
  for (const s of doc.sections) add(s.heading, s.id);
  for (const n of allNodes(doc)) if (n.type === "h3") add(n.text, n.id);
  for (const b of blocks(doc)) {
    if (b.title) add(b.title, b.id);
    if (b.kind === "flow") {
      add(b.name, b.id);
      for (const box of boxes(b.items)) if (box.where) add(box.where, box.whereId);
    }
  }
  return ids;
}

// The id a question's "read" reaches; a "where" may be written with or without brackets around it.
export function readTarget(ids, read) {
  return ids.get(read) ?? ids.get(read.replace(/^\[(.+)\]$/, "$1")) ?? null;
}

// Whether a plan's page folds Claude's smaller calls: it does once one of its calls says what would make it wrong.
export const foldsCalls = (doc) => blocks(doc, "settled").some((b) => b.rows.some((r) => r.how === "claude" && r.wrongIf));

// The words a reader reads on a plan's page, as the plan writes them: all of its texts but its pictures (their drawing
// and where each came from), Names, which is looked up, Claude's calls folded under Already settled (those without
// "wrongIf"), and the build and told records, which change as the build goes. The gist alone leaves out every step's
// "how", which the page's switch hides.
const count = (text) => (text ? String(text).replace(/\]\([^)\s]+\)/g, "]").replace(/[`*[\]]/g, " ").split(/\s+/).filter(Boolean).length : 0);
const boxWords = (items) => boxes(items).reduce((n, b) => n + count(b.text) + count(b.note) + count(b.where) + count(b.part)
  + (b.lanes ?? []).reduce((m, l) => m + count(l.label), 0), 0);
function nodeWords(n, folds) {
  if (n.type === "p" || n.type === "h3") return count(n.text);
  if (n.type === "list") return n.items.reduce((m, t) => m + count(t), 0);
  if (n.type === "table") return [...n.head, ...n.rows.flat()].reduce((m, t) => m + count(t), 0);
  if (n.type === "code") return n.lines.reduce((m, t) => m + count(t), 0);
  const all = (...texts) => texts.flat().reduce((m, t) => m + count(t), 0);
  switch (n.kind) {
    case "case":
    case "chart":
      return all(n.title, n.about) + (n.chart.columns ? n.chart.columns.reduce((m, c) => m + count(c.title) + boxWords(c.items), 0) : boxWords(n.chart.items));
    case "question":
      return all(n.question, n.read, n.why, n.options.map((o) => o.text)) + boxWords(n.case) + n.options.reduce((m, o) => m + boxWords(o.items), 0);
    case "choice":
      return all(n.question, n.recommended, n.alternatives, n.names, n.why, n.decides) + boxWords(n.today ?? []) + n.chart.columns.reduce((m, c) => m + boxWords(c.items), 0);
    case "settled":
      return n.rows.filter((r) => !(folds && r.how === "claude" && !r.wrongIf)).reduce((m, r) => m + all(r.text, r.from, r.alternatives, r.wrongIf), 0);
    case "flow":
      return count(n.name) + boxWords(n.items);
    case "whole":
      return all(n.problem, n.gets, n.for, n.in, n.out, n.assumes, n.unknown, n.asking, (n.map ?? []).map((m) => m.text));
    case "step":
      return all(n.title, n.label, n.caption, n.gist, n.see, n.trade ? [n.trade.chose, n.trade.over, n.trade.because, n.trade.costs] : []);
  }
  return 0;
}
/** @returns {{ total: number, gist: number }} the words of the whole page, and of the gist alone */
export function reading(doc) {
  const folds = foldsCalls(doc);
  const steps = blocks(doc, "step");
  const technical = new Set(steps.flatMap((st) => st.how));
  let total = count(doc.title);
  let gist = total;
  for (const n of [...doc.intro, ...doc.sections.filter((s) => s.heading !== "Names").flatMap((s) => [{ type: "h3", text: s.heading }, ...s.nodes])].flatMap((n) => (n.kind === "step" ? [n, ...n.how, ...n.cases, ...n.choices] : [n]))) {
    const words = nodeWords(n, folds);
    total += words;
    if (!technical.has(n)) gist += words;
  }
  for (const st of steps) {
    total += count(st.breaks) + st.decides.reduce((m, d) => m + count(d.number) + count(d.decides), 0);
    if (st.drawn.strip) total += st.drawn.chart.items.reduce((m, f) => m + f.notes.reduce((k, t) => k + count(t), 0), 0);
  }
  return { total, gist };
}

/** @returns {string[]} what is wrong, each naming its line */
export function check(doc, { plan, nameFound, codeFound = () => true }) {
  const errors = [];
  const at = (line, message) => errors.push(`line ${line}: ${message}`);
  const all = blocks(doc);
  const ids = targets(doc);

  // Each picture as it is written, with the line it starts on: one written out a second time is a copy.
  const written = new Map();
  const copyOf = (html, line) => {
    const key = html.join("\n");
    if (written.has(key)) at(line, `this picture is written out at line ${written.get(key)} too: draw it once under "pictures" and show it with "use"`);
    else written.set(key, line);
  };
  for (const picture of doc.pictures) {
    copyOf(picture.html, picture.lines[0]);
    for (const p of pictureProblems(picture.html)) at(picture.lines[p.k], p.message);
    if (!picture.used) at(picture.line, `the picture "${picture.name}" is shown by no step: a step shows it with "shows": { "use": "${picture.name}" }`);
  }
  for (const b of all) {
    // A plan's whole and each of its steps carry a picture of their own.
    if ((b.kind === "whole" || b.kind === "step") && !b.shows.use) {
      copyOf(b.shows.html, b.shows.lines[0]);
      for (const p of pictureProblems(b.shows.html)) at(b.shows.lines[p.k], p.message);
    }
    const drawn = b.kind === "flow" ? boxes(b.items) : blockChartBoxes(b);
    for (const box of drawn) {
      // A named picture is checked once, where it is drawn, however many steps show it.
      if (box.shows && !box.shows.use) copyOf(box.shows.html, box.shows.lines[0]);
      for (const p of box.shows && !box.shows.use ? pictureProblems(box.shows.html) : []) at(box.shows.lines[p.k], p.message);
    }
  }

  const questions = all.filter((b) => b.kind === "question");
  for (const q of questions) {
    const texts = q.options.map((o) => o.text);
    if (q.options.length !== 3 || new Set(texts).size !== 3) at(q.line, "a question has three different options");
    if (!plan && !q.read) at(q.line, 'a question names in "read" the part of the page to look at');
    if (q.read && !readTarget(ids, q.read)) at(q.line, `"read": "${q.read}" names no chart, case, flow, section or step's "where" on the page`);
    for (const o of q.options) {
      for (const box of boxes(o.items).filter((b) => b.mark)) at(box.line, "an option's chart carries no ✓ or ✗ (\"result\"), so it doesn't give the answer away");
    }
    // The reader answers from the question alone, so its case is drawn there, and its options are drawn alike.
    if (!pictured(q.case)) at(q.line, 'a question draws its case as a picture ("shows") on a step of its "steps", so the reader sees what it asks about');
    const drawn = q.options.filter((o) => pictured(o.items)).length;
    if (drawn && drawn !== q.options.length) at(q.line, "either every option's chart holds a picture or none does, so none stands out");
  }
  if (questions.length >= 2) {
    const places = questions.map((q) => q.options.findIndex((o) => o.right));
    if (new Set(places).size === 1) at(questions[0].line, "the right option sits in the same place in every question");
  }

  const numbers = new Set();
  for (const c of all.filter((b) => b.kind === "choice")) {
    const cols = c.chart.columns ?? [];
    if (cols.length < 2 || cols.length > 4) at(c.line, `a choice charts 2 to 4 options, the recommended one first; this one has ${cols.length}`);
    if (c.alternatives.length !== cols.length - 1) at(c.line, `a choice with ${cols.length} options has ${cols.length - 1} "alternatives", one per option after the first`);
    if (plan && !c.today) at(c.line, 'a plan\'s question for the author needs "today": its case as the code runs it now');
    if (!plan && c.today) at(c.line, 'only a plan\'s question for the author takes "today"');
    if (plan && c.today && !pictured(c.today)) at(c.line, 'a question for the author draws its case as a picture ("shows") on a step of "today", so the author sees what it asks about');
    if (!plan && !c.today && !cols.some((col) => pictured(col.items))) at(c.line, 'a choice draws its case as a picture ("shows") on a step of an option\'s chart, so the person sees what it asks about');
    for (const box of boxes(c.today ?? [])) {
      if (box.flowMark) at(box.line, `a step of "today" shows what happens now, before any change, so it takes no "mark"`);
    }
    if (plan) {
      if (c.number === null) at(c.line, 'a plan\'s choice has a "number"');
      else if (numbers.has(c.number)) at(c.line, `two questions are numbered ${c.number}`);
      numbers.add(c.number);
    }
  }

  // Each decision says how it was made and when, on a plan and an explanation alike (teaching.md, Recording each decision).
  for (const r of blocks(doc, "settled").flatMap((b) => b.rows)) {
    if (!r.how) at(r.line, 'a settled item says "how" it was decided: "chose", "said", "rule" or "claude"');
    else if (r.how === "claude") {
      if (!r.alternatives.length) at(r.line, 'Claude\'s call lists in "alternatives" what else the author could pick, so they can flip it');
      if (r.at) at(r.line, 'Claude\'s call takes no "at": it stands once the person answers the page, or approves the plan');
    } else {
      if (r.how === "rule") {
        if (r.at) at(r.line, 'a rule takes no "at": its file\'s history holds when it was made');
        if (!r.from) at(r.line, 'a rule names its file in "from"');
      } else if (!r.at || !MOMENT.test(r.at)) at(r.line, `an item the author ${r.how} says when, in "at": YYYY-MM-DDTHH:MM:SS±HH:MM`);
      if (r.alternatives.length) at(r.line, 'only Claude\'s call lists "alternatives"');
    }
  }

  // Every page's cases (teaching.md, Cases): each draws its example, and only a change's after marks its steps.
  for (const c of cases(doc)) {
    if (!chartBoxes(c.chart).some((b) => b.shows)) at(c.line, 'a case draws its example as a picture ("shows") on a step, so the reader sees what happens');
    if (c.change) {
      const [today, after] = c.chart.columns;
      if (boxes(today.items).some((b) => b.flowMark)) at(today.line, 'a case\'s "today" is how it runs now, so its steps take no "mark"');
      if (!boxes(after.items).some((b) => b.flowMark)) at(after.line, 'a case is drawn because something changes: mark the steps of "after" that are new ("+"), changed ("~") or removed ("-")');
    } else if (boxes(c.chart.items).some((b) => b.flowMark)) at(c.line, 'a case\'s "steps" show how it works now, so they take no "mark"');
  }
  if (!plan) {
    if (questions.length > PAGE_QUESTIONS) at(questions[PAGE_QUESTIONS].line, `a page asks ${PAGE_QUESTIONS} reading questions; this one asks ${questions.length}`);
    // What only a plan has: its build and told, its whole and steps, what decides a question, and the calls most likely
    // to be wrong.
    if (doc.build) at(doc.buildLine, 'only a plan has a "build"');
    if (doc.told) at(doc.toldLine, 'only a plan has a "told"');
    for (const b of all.filter((n) => ["whole", "step"].includes(n.kind))) at(b.line, `only a plan has a "${b.kind}"`);
    for (const c of all.filter((b) => b.kind === "choice")) if (c.decides) at(c.decidesLine, 'only a plan\'s question for the author takes "decides"');
    for (const r of blocks(doc, "settled").flatMap((b) => b.rows).filter((r) => r.wrongIf)) at(r.line, 'only a plan\'s call takes "wrongIf"');
    return errors;
  }

  let last = -1;
  for (const s of doc.sections) {
    const k = PLAN_SECTIONS.indexOf(s.heading);
    if (k < 0) at(s.line, `"${s.heading}" is not a plan section (plan-format.md, Sections, in order)`);
    else if (k < last) at(s.line, `"${s.heading}" stands after "${PLAN_SECTIONS[last]}", out of order`);
    else last = k;
  }
  if (doc.sections[0]?.heading !== WHOLE) at(doc.sections[0]?.line ?? doc.titleLine, `${WHOLE} comes first`);
  if (!doc.sections.some((s) => s.heading === STEPS)) at(doc.titleLine, `a plan has a "${STEPS}" section`);
  const section = (heading) => doc.sections.find((s) => s.heading === heading) ?? null;
  if (doc.approved && !APPROVED.test(doc.approved)) at(doc.titleLine, '"approved" is "<who> · <YYYY-MM-DDTHH:MM:SS±HH:MM> · <fingerprint>", the moment the author approved');

  // The whole thing: one whole, first, then at most one chart of the parts.
  const wholes = blocks(doc, "whole");
  if (wholes.length !== 1) at(wholes[1]?.line ?? section(WHOLE)?.line ?? doc.titleLine, `a plan has one "whole"; this one has ${wholes.length}`);
  const whole = wholes[0] ?? null;
  const top = section(WHOLE)?.nodes ?? [];
  if (whole && top[0] !== whole) at(whole.line, `"whole" is the first item of ${WHOLE}`);
  for (const n of top.slice(1)) if (n.kind !== "chart" || top.slice(1).indexOf(n) > 0) at(n.line, `${WHOLE} holds its "whole" and, when the change adds or connects parts, one "chart" of the parts, and nothing else`);
  if (whole?.map && whole.map.filter((m) => m.here).length !== 1) at(whole.mapLine, '"map" marks exactly one plan, this one, with "here": true');

  // What will happen, in order: the steps, and nothing else; every case and question sits in the step it belongs to.
  for (const n of section(STEPS)?.nodes ?? []) if (n.kind !== "step") at(n.line, `${STEPS} holds only steps, in the order they are built`);
  const steps = blocks(doc, "step");
  if (!steps.length) at(section(STEPS)?.line ?? doc.titleLine, `a plan has at least one "step"`);
  for (const n of doc.sections.flatMap((s) => s.nodes).concat(doc.intro)) {
    if (n.kind === "step" && !(section(STEPS)?.nodes ?? []).includes(n)) at(n.line, `a "step" stands under ${STEPS}`);
    if (n.kind === "case") at(n.line, 'a plan\'s case sits in the "cases" of the step that makes its "after" come true');
    if (n.kind === "choice") at(n.line, 'a plan\'s question for the author sits in the "choices" of the step it belongs to');
  }
  for (const st of steps) {
    const words = count(st.gist);
    if (words > GIST_WORDS) at(st.gistLine, `a step's "gist" is ${GIST_WORDS} words or fewer, a sentence or two; this one is ${words}`);
    const drawnBoxes = chartBoxes(st.drawn.chart);
    if (st.drawn.strip) {
      const [least, most] = FRAMES;
      if (drawnBoxes.length < least || drawnBoxes.length > most) at(st.drawn.line, `"frames" holds ${least} to ${most} frames, the example at each moment of the step; this one holds ${drawnBoxes.length}. A step that needs more is two steps`);
    } else if (!drawnBoxes.some((b) => b.shows)) at(st.drawn.line, 'a "how" drawn as a chart shows the example on at least one of its steps, as a picture');
    for (const b of drawnBoxes) {
      const n = count(b.text);
      if (n > FRAME_WORDS) at(b.line, `${st.drawn.strip ? "a frame's caption" : "a step of a \"how\" chart"} is ${FRAME_WORDS} words or fewer: the picture carries the rest; this one is ${n}`);
    }
    for (const b of st.drawn.strip ? drawnBoxes : []) {
      if (b.notes.length > FRAME_NOTES) at(b.notesLine, `a frame carries at most ${FRAME_NOTES} notes; this one carries ${b.notes.length}. More detail than that is another frame`);
      for (const t of b.notes) if (count(t) > NOTE_WORDS) at(b.notesLine, `a frame's note is ${NOTE_WORDS} words or fewer; one here is ${count(t)}`);
    }
    for (const m of st.more) {
      const texts = m.type === "list" ? m.items : m.type === "table" ? m.rows.flat() : [];
      for (const t of texts) if (count(t) > MORE_WORDS) at(m.line, `each item of a list and each cell of a table under "more" is ${MORE_WORDS} words or fewer; one here is ${count(t)}`);
    }
    if (count(st.breaks) > BREAKS_WORDS) at(st.breaksLine, `"breaks" says where the step goes wrong first in ${BREAKS_WORDS} words or fewer; this one is ${count(st.breaks)}`);
    for (const d of st.decides) if (count(d.number) > DECIDES_WORDS || count(d.decides) > DECIDES_WORDS) at(d.line, `each text of "decides" is ${DECIDES_WORDS} words or fewer`);
    if (st.trade && /^(nothing|none|no cost)\.?$/i.test(st.trade.costs.trim())) at(st.costsLine, 'a trade-off\'s "costs" says what the choice costs: a choice that costs nothing is no trade-off, so leave "trade" out');
  }
  const unknown = steps.filter((st) => st.unknown);
  if (whole?.unknown) {
    if (unknown.length !== 1) at(unknown[1]?.line ?? section(STEPS)?.line ?? doc.titleLine, `"whole" says what nobody knows yet, so exactly one step carries "unknown": true; ${unknown.length} do`);
  } else for (const st of unknown) at(st.line, '"unknown": true marks the step that tests "whole"\'s "unknown", and "whole" has none');

  for (const b of all.filter((n) => ["flow", "question"].includes(n.kind))) at(b.line, `a plan has no "${b.kind}": it tells what happens step by step, each case today beside after`);
  for (const c of cases(doc)) {
    if (!c.change) { at(c.line, 'a plan\'s case is a change: it has "today" and "after"'); continue; }
    // A step that exists today names code that is there now.
    for (const box of chartBoxes(c.chart)) {
      if (box.where && box.flowMark !== "+" && !nameFound(box.where)) at(box.line, `"where": "${box.where}" is on a step that exists today, and the code at the merge base has no such name or file`);
    }
  }

  // Each question for the author says what decides it.
  const choices = all.filter((b) => b.kind === "choice");
  for (const c of choices) if (!c.decides) at(c.line, 'a plan\'s question for the author says in "decides" what about the author\'s situation makes each option the right one');

  // Of Claude's calls, the one or two most likely to be wrong say what would make them wrong.
  const rows = blocks(doc, "settled").flatMap((b) => b.rows);
  for (const r of rows.filter((x) => x.wrongIf && x.how !== "claude")) at(r.line, 'only Claude\'s call takes "wrongIf"');
  const claudes = rows.filter((r) => r.how === "claude");
  const risky = claudes.filter((r) => r.wrongIf);
  if (claudes.length && !risky.length) at(claudes[0].line, 'one or two of Claude\'s calls, those most likely to be wrong, say in "wrongIf" what would make them wrong');
  if (risky.length > 2) at(risky[2].line, `one or two of Claude's calls carry "wrongIf"; ${risky.length} do`);

  // The build so far: one item for each step started, every one done but the last.
  if (doc.build) {
    if (doc.build.length > steps.length) at(doc.buildLine, `"build" has ${doc.build.length} items and the plan ${steps.length} steps: one item for each step started`);
    doc.build.forEach((r, k) => {
      if (k < doc.build.length - 1 && r.state !== "done") at(r.line, 'every step of "build" but the last is "done": the build goes one step at a time');
      if (r.state !== "now" && !r.saw) at(r.line, `a ${r.state} step says in "saw" what it showed, in the terms of its "see"`);
      if (r.causes && r.state !== "stopped") at(r.line, 'only a stopped step has "causes"');
      if (r.state === "done" && !r.code?.length) at(r.line, 'a done step says in "code" where its code is: each file, and what it does there');
      for (const c of r.code ?? []) {
        const has = codeFound(c.where, c.name);
        if (has === "file") at(c.line, `"where" names a file of the repository as it stands now, by its path, outside docs/plans; there is no ${c.where}`);
        else if (has === "name") at(c.line, `${c.where} holds no ${c.name}: "name" is a function or class in that file`);
      }
    });
  }

  // Telling it back, once every step is done.
  if (doc.told) {
    if (!doc.build || doc.build.length !== steps.length || doc.build.some((r) => r.state !== "done")) at(doc.toldLine, '"told" is there only once every step is "done"');
    if (!MOMENT.test(doc.told.at)) at(doc.told.atLine, '"at" is the moment it was told, YYYY-MM-DDTHH:MM:SS±HH:MM');
    if (doc.told.missed.length > 3) at(doc.told.missedLine, `"missed" holds at most three; this one holds ${doc.told.missed.length}`);
  }

  return errors;
}
