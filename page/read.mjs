// Reads a page's data file (JSON, as blocks.md gives it) into its title, sections, blocks and boxes, refusing any key
// or shape blocks.md doesn't give, with the line to fix. Nothing here reads the code or draws HTML: check.mjs judges
// what this reads, render.mjs draws it.
import { PageError, readJson } from "./json.mjs";

export { PageError };

const KEYWORDS = ["Starts", "Step", "Check", "Only if", "Repeats", "Tries", "Returns", "Raises", "Exits", "Finishes"];
const QUESTION_KEYWORDS = ["Check", "Only if", "Repeats", "Tries"];
const END_KEYWORDS = ["Returns", "Raises", "Exits", "Finishes"];
const MARKS = ["+", "~", "-"];

export function slug(text) {
  return text.toLowerCase().replace(/[`*_]/g, "").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

// How a settled item was decided: the person picked it, said it, a file's rule holds it, or it is Claude's call.
export const HOW = ["chose", "said", "rule", "claude"];

// The strict reader every page's data shares: an object with only the keys given, each of its type, and a list, each
// failure naming the line to fix.
export function reader(lineOf) {
  const fail = (path, message) => {
    throw new PageError(lineOf(path), message);
  };
  const where = (path) => (path.length ? path.join(".") : "the file");

  // An object with only these keys, the required ones present, each of the type given.
  const shape = (v, path, spec) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) fail(path, `${where(path)} must be an object { … }`);
    for (const key of Object.keys(v)) if (!(key in spec)) fail([...path, key], `"${key}" is not a key here; ${where(path)} takes ${Object.keys(spec).map((k) => `"${k}"`).join(", ")}`);
    for (const [key, type] of Object.entries(spec)) {
      const optional = type.endsWith("?");
      const t = type.replace("?", "");
      if (!(key in v)) {
        if (!optional) fail(path, `${where(path)} needs "${key}"`);
        continue;
      }
      const x = v[key];
      const ok = t === "string" ? typeof x === "string" && x.trim() !== "" : t === "number" ? Number.isInteger(x) : t === "boolean" ? typeof x === "boolean" : t === "array" ? Array.isArray(x) : t === "strings" ? Array.isArray(x) && x.every((s) => typeof s === "string") : Boolean(x) && typeof x === "object" && !Array.isArray(x);
      const said = { string: "text in quotes, not empty", number: "a whole number", boolean: "true or false", array: "a list [ … ]", strings: "a list of texts in quotes", object: "an object { … }" }[t];
      if (!ok) fail([...path, key], `"${key}" must be ${said}`);
    }
    return v;
  };
  const list = (v, path, each) => {
    if (!Array.isArray(v)) fail(path, `${where(path)} must be a list [ … ]`);
    return v.map((x, k) => each(x, [...path, k]));
  };

  return { fail, where, shape, list };
}

export function readDocument(text) {
  const { value, lineOf } = readJson(text);
  const { fail, where, shape, list } = reader(lineOf);

  shape(value, [], { title: "string", approved: "string?", reviewPage: "string?", about: "string?", pictures: "object?", intro: "array?", sections: "array" });
  // The pictures drawn once at the top of the file, each by its name, for the steps that show them with "use".
  const pictures = new Map(Object.entries(value.pictures ?? {}).map(([name, v]) => {
    const p = ["pictures", name];
    shape(v, p, { html: "strings", from: "string?" });
    if (!v.html.length) fail([...p, "html"], '"html" holds the picture, one line a string');
    return [name, { name, html: v.html, from: v.from ?? null, lines: v.html.map((_, k) => lineOf([...p, "html", k])), line: lineOf(p), used: 0 }];
  }));

  const step = (v, path, flow) => {
    const s = shape(v, path, flow
      ? { keyword: "string?", text: "string", mark: "string?", where: "string?", result: "string?", note: "string?", inner: "array?", answers: "array?", shows: "object?" }
      : { text: "string", kind: "string?", mark: "string?", part: "string?", where: "string?", result: "string?", note: "string?", inner: "array?", answers: "array?", shows: "object?" });
    if (flow && s.shows) fail([...path, "shows"], "a flow's step takes no picture: flows stay lean, and the example is drawn on a chart's step");
    if (s.result && !["ok", "bad"].includes(s.result)) fail([...path, "result"], '"result" is "ok" (✓) or "bad" (✗)');
    let kind = "step";
    let text = s.text;
    if (s.mark && !MARKS.includes(s.mark)) fail([...path, "mark"], '"mark" is "+" (new), "~" (changed) or "-" (removed); leave it out for a step that exists');
    if (flow) {
      if (s.keyword && !KEYWORDS.includes(s.keyword)) fail([...path, "keyword"], `"keyword" is one of ${KEYWORDS.join(", ")}`);
      if (s.mark && flow.mark) fail([...path, "mark"], "a flow marked as a whole marks none of its steps");
      kind = s.keyword === "Starts" ? "start" : QUESTION_KEYWORDS.includes(s.keyword) ? "q" : END_KEYWORDS.includes(s.keyword) ? "end" : "step";
      if (s.keyword) text = s.keyword === "Finishes" ? `Finishes ${s.text}` : `${s.keyword}: ${s.text}`;
    } else if (s.kind) {
      kind = { start: "start", question: "q", here: "here" }[s.kind];
      if (!kind) fail([...path, "kind"], '"kind" is "start", "question" or "here"; leave it out for a plain step');
    }
    if (s.answers && kind !== "q") fail([...path, "answers"], flow ? "only a Check, Only if, Repeats or Tries step has answers" : 'only a step of "kind": "question" has answers');
    // A picture of the example at this step, its lines as written and the line in the file of each, for check.mjs to read.
    let shows = null;
    if (s.shows) {
      const p = [...path, "shows"];
      shape(s.shows, p, { html: "strings?", from: "string?", use: "string?" });
      if (s.shows.use) {
        if (s.shows.html || s.shows.from) fail(p, 'a "shows" naming a picture with "use" takes no "html" or "from": they are the picture\'s own');
        const picture = pictures.get(s.shows.use);
        if (!picture) fail([...p, "use"], `"use": "${s.shows.use}" names no picture under "pictures", at the top of the file`);
        picture.used++;
        shows = { html: picture.html, from: picture.from, lines: picture.lines, use: picture.name };
      } else {
        if (!s.shows.html?.length) fail(p, '"shows" holds the picture as "html", one line a string, or names one of "pictures" with "use"');
        shows = { html: s.shows.html, from: s.shows.from ?? null, lines: s.shows.html.map((_, k) => lineOf([...p, "html", k])), use: null };
      }
    }
    const box = {
      text, kind, question: kind === "q", keyword: s.keyword ?? null, mark: s.result ?? null, note: s.note ?? null,
      where: s.where ?? null, part: s.part ?? null, shows, line: lineOf(path),
      // A flow's step is new, changed, removed or existing (" "); a chart's step only when it says so.
      flowMark: flow ? s.mark ?? flow.mark ?? " " : s.mark,
      // A step showing a named picture changes when that picture does, so its source holds the picture too.
      source: JSON.stringify({ ...s, inner: undefined, answers: undefined, mark: flow ? s.mark ?? flow.mark : s.mark, ...(shows?.use ? { shows: { use: shows.use, html: shows.html, from: shows.from } } : {}) }),
    };
    if (s.inner) box.inner = list(s.inner, [...path, "inner"], (x, p) => step(x, p, flow));
    if (s.answers) {
      box.lanes = list(s.answers, [...path, "answers"], (a, p) => {
        shape(a, p, { label: "string", steps: "array" });
        return { label: a.label, line: lineOf(p), items: list(a.steps, [...p, "steps"], (x, q) => step(x, q, flow)) };
      });
      if (!box.lanes.length) fail([...path, "answers"], '"answers" holds at least one answer');
    }
    return box;
  };
  const steps = (v, path, flow) => {
    const items = list(v, path, (x, p) => step(x, p, flow));
    if (!items.length) fail(path, `${where(path)} needs at least one step`);
    return items;
  };
  const chart = (v, path) => {
    if (v.steps && v.columns) fail(path, 'a chart has "steps" or "columns", not both');
    if (v.columns) {
      return {
        columns: list(v.columns, [...path, "columns"], (c, p) => {
          shape(c, p, { title: "string", steps: "array" });
          return { title: c.title, line: lineOf(p), items: steps(c.steps, [...p, "steps"]) };
        }),
      };
    }
    if (!v.steps) fail(path, 'a chart needs "steps", or "columns" to draw side by side');
    return { items: steps(v.steps, [...path, "steps"]) };
  };

  const PROSE = {
    p: (v, path) => {
      if (typeof v !== "string" || !v.trim()) fail(path, '"p" is a paragraph, as text in quotes');
      return { type: "p", text: v };
    },
    h3: (v, path) => {
      if (typeof v !== "string" || !v.trim()) fail(path, '"h3" is a heading, as text in quotes');
      return { type: "h3", text: v };
    },
    list: (v, path) => ({ type: "list", ordered: false, items: list(v, path, (x, p) => (typeof x === "string" ? x : fail(p, "a list item is text in quotes"))) }),
    numbered: (v, path) => ({ type: "list", ordered: true, items: list(v, path, (x, p) => (typeof x === "string" ? x : fail(p, "a list item is text in quotes"))) }),
    table: (v, path) => {
      shape(v, path, { head: "strings", rows: "array" });
      const rows = list(v.rows, [...path, "rows"], (r, p) => {
        if (!Array.isArray(r) || r.length !== v.head.length || !r.every((c) => typeof c === "string")) fail(p, `a row is a list of ${v.head.length} texts, one per heading`);
        return r;
      });
      return { type: "table", head: v.head, rows };
    },
    code: (v, path) => {
      shape(v, path, { lang: "string?", lines: "strings" });
      return { type: "code", lang: v.lang ?? "", lines: v.lines };
    },
  };
  const prose = (v, path, kinds) => {
    const [key, ...more] = Object.keys(v ?? {});
    if (!key || more.length || !kinds.includes(key)) fail(path, `each item here is one of ${kinds.map((k) => `{ "${k}": … }`).join(", ")}`);
    return { ...PROSE[key](v[key], [...path, key]), line: lineOf(path) };
  };

  const BLOCKS = {
    // One situation: for a change, how it runs today beside how it runs after; for how something works, one chart.
    case: (v, path) => {
      shape(v, path, { title: "string", gets: "string", today: "array?", after: "array?", steps: "array?" });
      const change = v.today !== undefined || v.after !== undefined;
      if (change && (v.today === undefined || v.after === undefined || v.steps !== undefined)) fail(path, 'a case has "today" and "after", for a change, or "steps" alone, for how something works');
      if (!change && v.steps === undefined) fail(path, 'a case has "today" and "after", for a change, or "steps" alone, for how something works');
      return {
        title: v.title, about: v.gets, change,
        chart: change
          ? { columns: [{ title: "Today", line: lineOf([...path, "today"]), items: steps(v.today, [...path, "today"]) }, { title: "After", line: lineOf([...path, "after"]), items: steps(v.after, [...path, "after"]) }] }
          : { items: steps(v.steps, [...path, "steps"]) },
      };
    },
    chart: (v, path) => {
      shape(v, path, { title: "string?", about: "string?", steps: "array?", columns: "array?" });
      return { title: v.title ?? null, about: v.about ?? null, chart: chart(v, path) };
    },
    question: (v, path) => {
      shape(v, path, { question: "string", steps: "array", options: "array", answer: "string", read: "string?", why: "string" });
      const right = "ABC".indexOf(v.answer);
      if (v.answer.length !== 1 || right < 0 || right >= v.options.length) fail([...path, "answer"], '"answer" is the right option\'s letter: "A", "B" or "C"');
      // The question's case, charted up to the step it asks about, and each option charted on from there.
      const options = list(v.options, [...path, "options"], (o, p) => {
        shape(o, p, { text: "string", steps: "array" });
        return { text: o.text, line: lineOf(p), items: steps(o.steps, [...p, "steps"]) };
      });
      return { question: v.question, case: steps(v.steps, [...path, "steps"]), options: options.map((o, k) => ({ ...o, right: k === right })), read: v.read ?? null, why: v.why, source: v.source ?? null };
    },
    choice: (v, path) => {
      shape(v, path, { number: "number?", question: "string", today: "array?", recommended: "string", alternatives: "strings", options: "array", why: "string" });
      const columns = list(v.options, [...path, "options"], (o) => o);
      return {
        number: v.number ?? null, question: v.question, today: v.today ? steps(v.today, [...path, "today"]) : null, recommended: v.recommended, alternatives: v.alternatives, why: v.why,
        names: columns.map((o) => (typeof o?.name === "string" ? o.name : "")),
        chart: {
          columns: columns.map((o, k) => {
            const p = [...path, "options", k];
            shape(o, p, { name: "string", steps: "array" });
            return { title: `${"ABCD"[k] ?? "?"} · ${o.name}${k === 0 ? " (recommended)" : ""}`, line: lineOf(p), items: steps(o.steps, [...p, "steps"]) };
          }),
        },
      };
    },
    settled: (v, path) => ({
      rows: list(v, path, (r, p) => {
        shape(r, p, { who: "string", how: "string?", at: "string?", from: "string?", text: "string", alternatives: "strings?" });
        if (r.how && !HOW.includes(r.how)) fail([...p, "how"], `"how" is one of ${HOW.map((h) => `"${h}"`).join(", ")}`);
        return { who: r.who, how: r.how ?? null, at: r.at ?? null, from: r.from ?? null, text: r.text, alternatives: r.alternatives ?? [], line: lineOf(p) };
      }),
    }),
    names: (v, path) => ({ rows: list(v, path, (r, p) => ({ ...shape(r, p, { name: "string", also: "strings?", text: "string" }), also: r.also ?? [], line: lineOf(p) })) }),
    flow: (v, path) => {
      shape(v, path, { name: "string", mark: "string?", steps: "array" });
      if (v.mark && !["+", "-"].includes(v.mark)) fail([...path, "mark"], 'a whole flow is marked "+" (new) or "-" (removed)');
      return { name: v.name, nameMark: v.mark ?? " ", items: steps(v.steps, [...path, "steps"], { mark: v.mark }) };
    },
  };
  const node = (v, path) => {
    const [key, ...more] = Object.keys(v ?? {});
    if (key in PROSE && !more.length) return prose(v, path, Object.keys(PROSE));
    if (!key || more.length || !(key in BLOCKS)) fail(path, `each item of "content" is one object with one key: ${[...Object.keys(PROSE), ...Object.keys(BLOCKS)].join(", ")}`);
    return { type: "block", kind: key, line: lineOf(path), ...BLOCKS[key](v[key], [...path, key]) };
  };

  const doc = {
    title: value.title, titleLine: lineOf(["title"]), approved: value.approved ?? null, reviewPage: value.reviewPage ?? null, about: value.about ?? null,
    pictures: [...pictures.values()],
    intro: value.intro ? list(value.intro, ["intro"], node) : [],
    sections: list(value.sections, ["sections"], (s, p) => {
      shape(s, p, { heading: "string", content: "array" });
      return { heading: s.heading, id: `s-${slug(s.heading)}`, line: lineOf(p), nodes: list(s.content, [...p, "content"], node) };
    }),
  };
  assignIds(doc);
  return { doc, value };
}

// Gives every heading, chart, case, flow, choice, name and first [where] the id links reach it by, each id once.
function assignIds(doc) {
  const used = new Set();
  const unique = (id) => {
    let out = id;
    for (let k = 2; used.has(out); k++) out = `${id}-${k}`;
    used.add(out);
    return out;
  };
  const prefix = { case: "k", chart: "h" };
  for (const s of doc.sections) s.id = unique(s.id);
  const wheres = new Set();
  for (const node of [...doc.intro, ...doc.sections.flatMap((s) => s.nodes)]) {
    if (node.type !== "block") continue;
    if (node.title) node.id = unique(`${prefix[node.kind]}-${slug(node.title)}`);
    if (node.kind === "choice") node.id = unique(`q-${node.number ?? slug(node.question)}`);
    if (node.kind === "names") for (const row of node.rows) row.id = unique(`n-${slug(row.name)}`);
    if (node.kind === "flow") {
      node.id = unique(`f-${slug(node.name)}`);
      const walk = (items) => items.forEach((b) => {
        if (b.where && !wheres.has(b.where)) {
          wheres.add(b.where);
          b.whereId = unique(`w-${slug(b.where)}`);
        }
        walk(b.inner ?? []);
        (b.lanes ?? []).forEach((l) => walk(l.items));
      });
      walk(node.items);
    }
  }
}
