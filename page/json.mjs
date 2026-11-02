// Reads JSON as JSON.parse does, and also keeps the line each value starts on, so every failure in a page's data can
// name the line to fix. A syntax error names its line too, with what was expected there.
export class PageError extends Error {
  constructor(line, message) {
    super(`line ${line}: ${message}`);
    this.line = line;
  }
}

/** @returns {{ value: unknown, lineOf: (path: (string|number)[]) => number }} */
export function readJson(text) {
  let i = 0;
  let line = 1;
  const lines = new Map();
  const fail = (message) => {
    throw new PageError(line, message);
  };
  const found = () => (i >= text.length ? "the end of the file" : JSON.stringify(text[i]));
  const space = () => {
    for (; i < text.length; i++) {
      const c = text[i];
      if (c === "\n") line++;
      else if (c !== " " && c !== "\t" && c !== "\r") break;
    }
  };
  const string = () => {
    const start = i++;
    for (; i < text.length && text[i] !== '"'; i++) {
      if (text[i] === "\\") i++;
      else if (text[i] === "\n") fail('a string runs past the end of its line: close it with ", or split long text into a list of lines');
    }
    if (i >= text.length) fail("a string is never closed");
    i++;
    try {
      return JSON.parse(text.slice(start, i));
    } catch {
      return fail(`this string has an escape JSON doesn't know: ${text.slice(start, i).slice(0, 60)}`);
    }
  };
  const value = (path) => {
    space();
    lines.set(path.join("\u0000"), line);
    const c = text[i];
    if (c === "{") return object(path);
    if (c === "[") return array(path);
    if (c === '"') return string();
    const literal = /^(true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i, i + 40));
    if (!literal) return fail(`expected a value (a "string", a number, true, false, null, [ or {), found ${found()}`);
    i += literal[1].length;
    return JSON.parse(literal[1]);
  };
  const object = (path) => {
    i++;
    const out = {};
    space();
    if (text[i] === "}") {
      i++;
      return out;
    }
    for (;;) {
      space();
      if (text[i] !== '"') fail(`expected a "key" in quotes, found ${found()}${text[i] === "}" ? " (a comma before } is not allowed)" : ""}`);
      const keyLine = line;
      const key = string();
      if (Object.hasOwn(out, key)) throw new PageError(keyLine, `"${key}" appears twice in one object`);
      space();
      if (text[i] !== ":") fail(`expected : after "${key}", found ${found()}`);
      i++;
      out[key] = value([...path, key]);
      space();
      if (text[i] === ",") {
        i++;
        continue;
      }
      if (text[i] === "}") {
        i++;
        return out;
      }
      fail(`expected , or } after the value of "${key}", found ${found()}`);
    }
  };
  const array = (path) => {
    i++;
    const out = [];
    space();
    if (text[i] === "]") {
      i++;
      return out;
    }
    for (;;) {
      out.push(value([...path, out.length]));
      space();
      if (text[i] === ",") {
        i++;
        space();
        if (text[i] === "]") fail("a comma before ] is not allowed");
        continue;
      }
      if (text[i] === "]") {
        i++;
        return out;
      }
      fail(`expected , or ] after an item, found ${found()}`);
    }
  };
  const result = value([]);
  space();
  if (i < text.length) fail(`expected the end of the file after the last }, found ${found()}`);
  const lineOf = (path) => {
    for (let p = [...path]; ; p = p.slice(0, -1)) {
      const at = lines.get(p.join("\u0000"));
      if (at !== undefined || !p.length) return at ?? 1;
    }
  };
  return { value: result, lineOf };
}

// Writes data the way a page's data file is kept: one item per line, and an object with nothing nested on one line,
// so a step, a row or a name is one line to read, diff and edit.
export function formatJson(value, indent = "") {
  const inner = `${indent}  `;
  const flat = (v) => v === null || typeof v !== "object";
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    return `[\n${value.map((v) => inner + formatJson(v, inner)).join(",\n")}\n${indent}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    if (entries.every(([, v]) => flat(v)) || entries.every(([, v]) => flat(v) || (Array.isArray(v) && v.every(flat) && JSON.stringify(v).length < 80))) {
      return `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(", ")} }`;
    }
    return `{\n${entries.map(([k, v]) => `${inner}${JSON.stringify(k)}: ${formatJson(v, inner)}`).join(",\n")}\n${indent}}`;
  }
  return JSON.stringify(value);
}
