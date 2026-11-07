// Checks a step's picture: the HTML or SVG a skill draws of its example. A picture may only draw. It runs nothing, loads
// nothing from elsewhere, styles nothing outside itself, links nowhere (links stay in the step's words), and leaves no tag
// open, so the page around it keeps its layout and its links.

const HTML = ["div", "span", "p", "b", "strong", "i", "em", "u", "s", "small", "sub", "sup", "mark", "abbr", "del", "ins", "q", "kbd", "time",
  "br", "hr", "wbr", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col", "ul", "ol", "li", "dl", "dt", "dd",
  "figure", "figcaption", "h4", "h5", "h6"];
const SVG = ["svg", "g", "rect", "circle", "ellipse", "line", "polyline", "polygon", "path", "text", "tspan", "defs", "marker", "lineargradient",
  "radialgradient", "stop", "clippath", "mask", "pattern", "symbol", "title", "desc"];
const DRAWS = new Set([...HTML, ...SVG]);
// Tags with no closing tag, those a picture may hold and those it may not, so a refused one is refused once.
const VOID = new Set(["br", "hr", "wbr", "col", "img", "source", "input", "meta", "link", "base", "embed"]);
// Why a tag that doesn't draw is refused, for the tags a picture is most likely to reach for.
const REFUSED = {
  script: "runs code", style: "styles the whole page", link: "loads from elsewhere", meta: "changes the page", base: "changes where the page's links go",
  iframe: "loads another page", frame: "loads another page", frameset: "loads another page", object: "loads from elsewhere", embed: "loads from elsewhere",
  img: "loads an image", image: "loads an image", picture: "loads an image", source: "loads from elsewhere", video: "loads from elsewhere", audio: "loads from elsewhere",
  use: "draws from elsewhere", foreignobject: "holds a page inside the picture", a: "is a link; links stay in the step's words",
  form: "sends a form", input: "takes input", button: "is a control", select: "is a control", textarea: "takes input",
};
const LOADS = new Set(["href", "xlink:href", "src", "srcset", "action", "formaction", "poster", "background", "ping", "data"]);
const TAG = /<(\/?)([A-Za-z][\w:.-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/y;
const ATTR = /([^\s=>/]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g;

/**
 * @param {string[]} lines the picture, one string a line
 * @returns {{ k: number, message: string }[]} what is wrong, each with the index of its line
 */
export function pictureProblems(lines) {
  const text = lines.join("\n");
  const starts = [];
  for (let k = 0, at = 0; k < lines.length; at += lines[k].length + 1, k++) starts.push(at);
  const lineAt = (i) => {
    let k = 0;
    while (k + 1 < starts.length && starts[k + 1] <= i) k++;
    return k;
  };
  const problems = [];
  const say = (i, message) => problems.push({ k: lineAt(i), message });
  const open = [];
  for (let i = text.indexOf("<"); i >= 0; i = text.indexOf("<", i + 1)) {
    if (text.startsWith("<!--", i)) {
      const end = text.indexOf("-->", i + 4);
      if (end < 0) {
        say(i, "a comment `<!--` is never closed with `-->`");
        break;
      }
      i = end + 2;
      continue;
    }
    TAG.lastIndex = i;
    const m = TAG.exec(text);
    if (!m) {
      say(i, "a `<` that starts no tag: write it as `&lt;`");
      continue;
    }
    const [, closing, raw, attrs, selfClosing] = m;
    const name = raw.toLowerCase();
    if (!DRAWS.has(name) && !closing) say(i, REFUSED[name] ? `a picture holds no \`<${raw}>\`: it ${REFUSED[name]}` : `\`<${raw}>\` doesn't draw: a picture uses HTML boxes and tables, or SVG shapes and text`);
    if (closing) {
      const last = open.map((o) => o.name).lastIndexOf(name);
      if (last < 0) say(i, `\`</${raw}>\` closes no tag that is open`);
      else {
        for (const left of open.slice(last + 1)) say(left.at, `\`<${left.raw}>\` is never closed`);
        open.length = last;
      }
    } else {
      for (const [, attr, value = ""] of attrs.matchAll(ATTR)) {
        const key = attr.toLowerCase();
        const words = value.replace(/^["']|["']$/g, "");
        if (key === "id") say(i, "a picture holds no `id`: the page's links find their places by id");
        else if (key.startsWith("on")) say(i, `a picture holds no \`${attr}\`: it runs code`);
        else if (LOADS.has(key)) say(i, `a picture holds no \`${attr}\`: it links or loads elsewhere, and links stay in the step's words`);
        else if (key === "style" && /url\s*\(|@import|expression\s*\(|image-set/i.test(words)) say(i, "a picture's `style` loads nothing from elsewhere");
      }
      if (!selfClosing && !VOID.has(name)) open.push({ name, raw, at: i });
    }
    i += m[0].length - 1;
  }
  for (const left of open) say(left.at, `\`<${left.raw}>\` is never closed`);
  return problems;
}
