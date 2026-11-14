// The checks a page's data must pass before it is drawn: every rule blocks.md and plan-format.md mark **checked**, on
// the data itself, so the page is never read back. An explanation gets the rules its blocks share with a plan.
import { pictureProblems } from "./picture.mjs";

export const PLAN_SECTIONS = [
  "What I'm asking",
  "Questions from plan-flows",
  "Questions from plan-check",
  "What changes, case by case",
  "Check your reading",
  "Already settled",
  "Plan changes",
  "Names",
];
export const CASES = "What changes, case by case";
// A plan asks two reading questions: enough to show the reader understood, few enough to stay worth answering.
export const PLAN_QUESTIONS = 2;
// "<who> · <date and time, with its offset> · <fingerprint>", and what changed an approved plan since.
export const APPROVED = /^[^·]+ · \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[+-]\d{2}:\d{2}|Z) · [0-9a-f]{7}(?: · after (?:plan change \d+|plan-check))?$/;
const MOMENT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[+-]\d{2}:\d{2}|Z)$/;

export function blocks(doc, kind) {
  return [...doc.intro, ...doc.sections.flatMap((s) => s.nodes)].filter((n) => n.type === "block" && (!kind || n.kind === kind));
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

// What a question's "read" can name: a chart's or flow's title, a section's heading, or a step's "where".
export function targets(doc) {
  const ids = new Map();
  const add = (name, id) => name && !ids.has(name) && ids.set(name, id);
  for (const s of doc.sections) add(s.heading, s.id);
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

/** @returns {string[]} what is wrong, each naming its line */
export function check(doc, { plan, nameFound }) {
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
  if (questions.length > PLAN_QUESTIONS) at(questions[PLAN_QUESTIONS].line, `a page asks ${PLAN_QUESTIONS} reading questions; this one asks ${questions.length}`);

  if (!plan) return errors;

  let last = -1;
  for (const s of doc.sections) {
    const k = PLAN_SECTIONS.indexOf(s.heading);
    if (k < 0) at(s.line, `"${s.heading}" is not a plan section (plan-format.md, Sections, in order)`);
    else if (k < last) at(s.line, `"${s.heading}" stands after "${PLAN_SECTIONS[last]}", out of order`);
    else last = k;
  }
  if (doc.sections[0]?.heading !== "What I'm asking") at(doc.sections[0]?.line ?? doc.titleLine, "What I'm asking comes first");
  if (!doc.sections.some((s) => s.heading === CASES)) at(doc.titleLine, `a plan has a "${CASES}" section`);
  if (doc.approved && !APPROVED.test(doc.approved)) at(doc.titleLine, '"approved" is "<who> · <YYYY-MM-DDTHH:MM:SS±HH:MM> · <fingerprint>", the moment the author approved');

  for (const f of blocks(doc, "flow")) at(f.line, "a plan draws what changes as cases, each today beside after; it has no flows");
  for (const c of cases(doc)) {
    if (!c.change) { at(c.line, 'a plan\'s case is a change: it has "today" and "after"'); continue; }
    // A step that exists today names code that is there now.
    for (const box of chartBoxes(c.chart)) {
      if (box.where && box.flowMark !== "+" && !nameFound(box.where)) at(box.line, `"where": "${box.where}" is on a step that exists today, and the code at the merge base has no such name or file`);
    }
  }

  if (questions.length !== PLAN_QUESTIONS) at(questions[0]?.line ?? doc.titleLine, `a plan asks ${PLAN_QUESTIONS} reading questions; this one asks ${questions.length}`);

  return errors;
}
