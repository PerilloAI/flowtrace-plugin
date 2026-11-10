// The checks a page's data must pass before it is drawn: every rule blocks.md and plan-format.md mark **checked**, on
// the data itself, so the page is never read back. An explanation gets the rules its blocks share with a plan.
import { pictureProblems } from "./picture.mjs";

export const PLAN_SECTIONS = [
  "What I'm asking",
  "The case",
  "What you'd see",
  "Check your reading",
  "Questions from plan-flows",
  "Questions from plan-check",
  "What this rests on",
  "The changes and why",
  "Already settled",
  "How it works, traced with",
  "How it's built",
  "Order of work",
  "Tests",
  "What comes next",
  "Plan changes",
  "Names",
];
export const PREMISE_HEAD = ["The plan rests on", "How it was proved", "Where"];
export const LOOK_CLOSELY = ["Breaking", "No undo", "Access check", "Default changed", "External call", "Migration", "Error hidden", "Side effect"];

// 2 questions for 0 or 1 changed steps, one more each time they double, at most 8.
export function questionsFor(changedSteps) {
  return Math.min(8, 2 + Math.floor(Math.log2(Math.max(1, changedSteps))));
}

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
// Every box a block draws as a chart: a chart's, a screen's or a trace's, a choice's today and options, a question's case
// and options. A flow's steps are not a chart's.
export function blockChartBoxes(b) {
  if (b.kind === "question") return [...boxes(b.case), ...b.options.flatMap((o) => boxes(o.items))];
  return [...(b.chart ? chartBoxes(b.chart) : []), ...boxes(b.today ?? [])];
}

// Whether any of these steps draws the example as a picture.
const pictured = (items) => boxes(items).some((b) => b.shows);

export function changedSteps(doc) {
  return blocks(doc, "flow").flatMap((f) => boxes(f.items)).filter((b) => "+~-".includes(b.flowMark) && ["Step", "Check", "Only if"].includes(b.keyword)).length;
}

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

  const changes = all.filter((b) => b.kind === "changes").flatMap((b) => b.rows);
  const titles = new Set();
  for (const row of changes) {
    if (row.title.split(/\s+/).length > 6) at(row.line, `the change title "${row.title}" is longer than six words`);
    if (titles.has(row.title)) at(row.line, `two changes are titled "${row.title}"`);
    titles.add(row.title);
  }
  for (const b of all) {
    const drawn = b.kind === "flow" ? boxes(b.items) : blockChartBoxes(b);
    for (const box of drawn) {
      for (const p of box.shows ? pictureProblems(box.shows.html) : []) at(box.shows.lines[p.k], p.message);
      if (box.change && !titles.has(box.change)) at(box.line, `"change": "${box.change}" names no row of "changes"`);
      for (const f of box.flags ?? []) {
        if (!LOOK_CLOSELY.includes(f.kind)) at(f.line, `Look closely's kind "${f.kind}" is not one of ${LOOK_CLOSELY.join(", ")}`);
      }
    }
  }

  const questions = all.filter((b) => b.kind === "question");
  for (const q of questions) {
    const texts = q.options.map((o) => o.text);
    if (q.options.length !== 3 || new Set(texts).size !== 3) at(q.line, "a question has three different options");
    if (!readTarget(ids, q.read)) at(q.line, `"read": "${q.read}" names no chart, flow, section or step's "where" on the page`);
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
      if (box.change) at(box.line, `"change": "${box.change}" is on a step of "today", which shows what happens now, before any change`);
    }
    if (plan) {
      if (c.number === null) at(c.line, 'a plan\'s choice has a "number"');
      else if (numbers.has(c.number)) at(c.line, `two questions are numbered ${c.number}`);
      numbers.add(c.number);
    }
  }

  if (!plan) return errors;

  let last = -1;
  for (const s of doc.sections) {
    const k = PLAN_SECTIONS.findIndex((name) => s.heading === name || (name.endsWith("with") && s.heading.startsWith(name)));
    if (k < 0) at(s.line, `"${s.heading}" is not a plan section (plan-format.md, Sections, in order)`);
    else if (k < last) at(s.line, `"${s.heading}" stands after "${PLAN_SECTIONS[last]}", out of order`);
    else last = k;
  }
  if (doc.sections[0]?.heading !== "What I'm asking") at(doc.sections[0]?.line ?? doc.titleLine, "What I'm asking comes first");

  const rests = doc.sections.find((s) => s.heading === "What this rests on");
  const premises = rests?.nodes.find((n) => n.type === "table" && PREMISE_HEAD.every((h, i) => n.head[i] === h) && n.head.length === PREMISE_HEAD.length);
  if (!premises) at(rests?.line ?? doc.titleLine, `a plan has a "What this rests on" section holding a table headed ${PREMISE_HEAD.join(", ")} (plan-format.md)`);
  else if (premises.rows.some((row) => row.some((cell) => !cell.trim()))) at(premises.line, "every premise under What this rests on says what it is, how it was proved and where");

  const steps = changedSteps(doc);
  if (questions.length !== questionsFor(steps)) {
    at(questions[0]?.line ?? doc.titleLine, `the plan asks ${questions.length} reading questions, and its ${steps} changed steps call for ${questionsFor(steps)}`);
  }

  const built = new Set(blocks(doc, "flow").flatMap((f) => boxes(f.items)).map((box) => box.change));
  for (const s of blocks(doc, "screens")) {
    for (const box of chartBoxes(s.chart)) {
      if (titles.has(box.change) && !built.has(box.change)) at(box.line, `"change": "${box.change}" is on a screen's step, and no flow's step names it`);
    }
  }

  for (const f of blocks(doc, "flow")) {
    for (const box of boxes(f.items)) {
      if (!box.where || "+".includes(box.flowMark)) continue;
      if (!nameFound(box.where)) at(box.line, `"where": "${box.where}" is on a step marked as existing, changed or removed, and the code at the merge base has no such name or file`);
    }
  }
  return errors;
}
