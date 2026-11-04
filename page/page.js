/* global crypto, CSS, document, navigator, matchMedia, NodeFilter, sendPrompt, innerHeight, scrollX, scrollY */
// Each question locks on its first pick; once all are answered, the score says how many were right first time.
(() => {
  const cards = [...document.querySelectorAll(".qz")];
  const score = document.querySelector(".score");
  let answered = 0, right = 0;
  cards.forEach((card) => {
    const buttons = [...card.querySelectorAll("button.opt")];
    buttons.forEach((button) => button.addEventListener("click", () => {
      if (card.dataset.picked) return;
      card.dataset.picked = button.dataset.letter;
      const correct = button.dataset.letter === card.dataset.answer;
      buttons.forEach((other) => {
        other.disabled = true;
        if (other.dataset.letter === card.dataset.answer) other.classList.add("right");
      });
      if (!correct) button.classList.add("wrong");
      const fb = card.querySelector(".fb");
      fb.querySelector(".verdict").textContent = correct ? "Right." : "Not quite.";
      fb.hidden = false;
      answered += 1;
      if (correct) right += 1;
      if (score && answered === cards.length) {
        score.textContent = `${right} of ${cards.length} right first time.`;
        score.hidden = false;
      }
    }));
  });
})();

// Every mention of a name links to its line under Names on this page, outside headings, buttons, links and a row's
// line, where a click opens the row.
(() => {
  const spellings = [];
  document.querySelectorAll(".names dt[id]").forEach((dt) => {
    dt.textContent.split(",").concat((dt.dataset.also || "").split(","))
      .map((s) => s.trim()).filter(Boolean).forEach((s) => spellings.push({ s, id: dt.id }));
  });
  if (!spellings.length) return;
  spellings.sort((a, b) => b.s.length - a.s.length);
  const idOf = new Map(spellings.map(({ s, id }) => [s.toLowerCase().replace(/’/g, "'"), id]));
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/'/g, "['’]");
  const word = (s) => (/[a-z]/.test(s[0]) ? `[${s[0]}${s[0].toUpperCase()}]${esc(s.slice(1))}` : esc(s));
  const mention = new RegExp(`(?<![\\w/#-])(${spellings.map(({ s }) => word(s)).join("|")})(?:s['’]|['’]s|s|['’])?(?![\\w-])`, "g");
  const texts = [];
  const walk = document.createTreeWalker(document.querySelector(".wrap") || document.body, NodeFilter.SHOW_TEXT);
  while (walk.nextNode()) {
    if (!walk.currentNode.parentElement.closest("a, button, summary, header, h1, h2, h3, h4, dt, script, style")) texts.push(walk.currentNode);
  }
  texts.forEach((node) => {
    const dd = node.parentElement.closest(".names dd");
    const own = dd && dd.previousElementSibling ? dd.previousElementSibling.id : null;
    const text = node.nodeValue;
    let from = 0, linked = null;
    for (const m of text.matchAll(mention)) {
      const id = idOf.get(m[1].toLowerCase().replace(/’/g, "'"));
      if (!id || id === own) continue;
      linked = linked || document.createDocumentFragment();
      const a = document.createElement("a");
      a.className = "term";
      a.href = `#${id}`;
      a.textContent = m[0];
      linked.append(text.slice(from, m.index), a);
      from = m.index + m[0].length;
    }
    if (linked) {
      linked.append(text.slice(from));
      node.replaceWith(linked);
    }
  });
})();

// Pointing at a name, moving to it with the keyboard, or clicking or tapping it shows its line beside the mention and
// lights the mention, so the reader keeps their place. A click anywhere else, or Esc, closes it.
(() => {
  const tip = document.createElement("div");
  tip.className = "tip";
  tip.id = "name-tip";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  document.body.append(tip);
  let shown = null;
  const hide = () => {
    if (!shown) return;
    shown.classList.remove("lit");
    shown.removeAttribute("aria-describedby");
    shown = null;
    tip.hidden = true;
  };
  const show = (term) => {
    const dt = document.getElementById(decodeURIComponent(term.getAttribute("href").slice(1)));
    if (!dt || shown === term) return;
    // Measured first: a name in the tip itself goes as the tip fills.
    const at = term.getBoundingClientRect();
    hide();
    // In the modal, which sits above everything else on the page, the tip goes with it and stays put as it does.
    const host = term.closest("dialog") || document.body;
    if (tip.parentElement !== host) host.append(tip);
    const [dx, dy] = host === document.body ? [scrollX, scrollY] : [0, 0];
    tip.style.position = host === document.body ? "" : "fixed";
    const name = document.createElement("strong");
    name.textContent = dt.textContent;
    tip.replaceChildren(name, " ", ...[...dt.nextElementSibling.childNodes].map((n) => n.cloneNode(true)));
    tip.hidden = false;
    shown = term;
    term.classList.add("lit");
    term.setAttribute("aria-describedby", tip.id);
    const width = tip.offsetWidth;
    const left = Math.min(Math.max(8, at.left), document.documentElement.clientWidth - width - 8);
    const below = at.bottom + 6 + tip.offsetHeight < innerHeight;
    tip.style.left = `${left + dx}px`;
    tip.style.top = `${(below ? at.bottom + 6 : at.top - 6 - tip.offsetHeight) + dy}px`;
  };
  document.addEventListener("pointerover", (event) => {
    const term = event.pointerType === "mouse" && event.target.closest("a.term");
    if (term) show(term);
    else if (shown && !event.target.closest(".tip")) hide();
  });
  document.addEventListener("focusin", (event) => {
    const term = event.target.closest("a.term");
    if (term) show(term);
    else hide();
  });
  document.addEventListener("click", (event) => {
    const term = event.target.closest("a.term");
    if (!term) return hide();
    event.preventDefault();
    show(term);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hide();
  });
})();

// A link within the page (a change, Seen in) scrolls to what it names and lights it; Back returns to the link
// clicked. Links followed from inside Names on this page add to the way back, so Back retraces them in turn.
// A link to a flow or a flow's step (How it's built, Where to look, See it) opens a copy of the flow in a modal over the
// page instead, whole, with the step lit. Esc, the close button or a click outside closes it, and the page is where it
// was. A link inside the modal to anywhere else leaves it, and Back returns to the link that opened it.
(() => {
  const back = document.createElement("button");
  back.type = "button";
  back.className = "back";
  back.textContent = "↩ Back to where you were";
  back.hidden = true;
  document.body.append(back);
  const modal = document.createElement("dialog");
  modal.className = "flow-modal";
  modal.innerHTML = '<div class="modal-bar"><div class="modal-title"></div><button type="button" class="modal-close">✕ Close</button></div><div class="modal-body"></div>';
  document.body.append(modal);
  const body = modal.querySelector(".modal-body");
  const copies = new Map();
  let opener = null;
  const trail = [];
  const motion = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  let lit = [];
  const show = (target, light) => {
    lit.forEach((el) => el.classList.remove("hit"));
    lit = light;
    light.forEach((el) => el.classList.add("hit"));
    // A link on a row's line is in view with the row closed, so going back to one leaves the row as it is.
    const row = target.closest("summary") ? null : target.closest("details");
    if (row) row.open = true;
    target.scrollIntoView({ behavior: motion, block: "center" });
    if (!target.matches("a, button")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    back.hidden = !trail.length;
  };
  // What a flow's line says and its chart, each id kept as data-from so the page's links still reach the page's own parts.
  // One copy for each flow, kept while the page is open, so a comment begun in it stays.
  const copyOf = (row) => {
    if (!copies.has(row)) {
      const copy = document.createElement("section");
      copy.className = "flowbox";
      copy.append(row.querySelector(".row-meta").cloneNode(true), row.querySelector("figure").cloneNode(true));
      copy.querySelectorAll("[id]").forEach((el) => {
        el.dataset.from = el.id;
        el.removeAttribute("id");
      });
      copy.querySelectorAll(".cmt-box").forEach((el) => el.remove());
      copies.set(row, copy);
    }
    return copies.get(row);
  };
  const openFlow = (row, target, link) => {
    const copy = copyOf(row);
    copy.querySelectorAll(".hit").forEach((el) => el.classList.remove("hit"));
    body.replaceChildren(copy);
    // The flow's name stays in the bar as the flow scrolls under it to the step.
    const name = row.querySelector("h3");
    modal.querySelector(".modal-title").replaceChildren(name.cloneNode(true));
    modal.setAttribute("aria-label", name.textContent);
    if (!modal.open) {
      opener = link;
      modal.showModal();
    }
    const step = target === row ? null : copy.querySelector(`[data-from="${CSS.escape(target.id)}"]`);
    if (step) step.classList.add("hit");
    body.scrollTop = step ? body.scrollTop + step.getBoundingClientRect().top - body.getBoundingClientRect().top - body.clientHeight / 3 : 0;
  };
  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]:not(.term)');
    const target = link && document.getElementById(decodeURIComponent(link.getAttribute("href").slice(1)));
    if (!target) return;
    event.preventDefault();
    const row = target.closest("details.flowbox");
    if (row) return openFlow(row, target, link);
    const from = modal.contains(link) ? opener : link;
    opener = null;
    modal.close();
    if (!from.closest(".names")) trail.length = 0;
    trail.push(from);
    show(target, target.matches(".names dt") ? [target, target.nextElementSibling] : [target]);
  });
  // A browser gives the focus back only where a click on a link gave it to the link, which Safari's doesn't.
  modal.addEventListener("close", () => {
    if (opener) opener.focus({ preventScroll: true });
    opener = null;
  });
  modal.querySelector(".modal-close").addEventListener("click", () => modal.close());
  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.close();
  });
  back.addEventListener("click", () => {
    const link = trail.pop();
    if (link) show(link, [link]);
  });
})();

// Comment and Approve give the chat a line: sent where the page can send a message to the chat (a page shown with a
// global sendPrompt), otherwise copied, and shown ready to paste.
const give = async (line, code, desc, button) => {
  if (typeof sendPrompt === "function") {
    sendPrompt(line);
    desc.textContent = "Sent to the chat.";
  } else {
    code.textContent = line;
    code.hidden = false;
    let copied = false;
    try {
      await navigator.clipboard.writeText(line);
      copied = true;
    } catch {}
    desc.textContent = copied ? "Copied: paste it into the chat." : "Copy this line and paste it into the chat.";
  }
  desc.hidden = false;
  if (button) button.textContent = typeof sendPrompt === "function" ? "Sent" : "Copied";
};

// Comment, on every box of a plan, on the page or in the modal: a place under the box for the author's words, given to
// the chat with the box's words and where it sits.
document.addEventListener("click", (event) => {
  const button = event.target.closest("button.cmt");
  if (!button) return;
  const cell = button.closest(".cell");
  let box = cell.querySelector(".cmt-box");
  if (box) {
    box.hidden = !box.hidden;
    return;
  }
  box = document.createElement("div");
  box.className = "cmt-box";
  const area = document.createElement("textarea");
  area.setAttribute("aria-label", "Your comment");
  const go = document.createElement("button");
  go.type = "button";
  go.textContent = typeof sendPrompt === "function" ? "Send" : "Copy";
  const code = document.createElement("code");
  code.hidden = true;
  const desc = document.createElement("p");
  desc.className = "desc";
  desc.hidden = true;
  box.append(area, go, code, desc);
  cell.append(box);
  area.focus();
  go.addEventListener("click", () => {
    if (!area.value.trim()) return;
    give(`Comment on "${button.dataset.words}" (${button.dataset.at}): ${area.value.trim()}`, code, desc);
  });
});

const approve = document.querySelector(".approve-btn");
if (approve) {
  const box = approve.closest(".approve");
  approve.addEventListener("click", () => give(approve.dataset.line, box.querySelector("code"), box.querySelector(".desc"), approve));
}

// Picking an option of a question for the author gives the chat its answer. Where the line is copied, every question's
// pick so far goes in one line, "1 A, 3 B", so one paste answers them all; a pick made again replaces that question's.
(() => {
  const cards = [...document.querySelectorAll(".decision")].filter((card) => card.querySelector("button.pick"));
  const picked = new Map();
  cards.forEach((card) => {
    const buttons = [...card.querySelectorAll("button.pick")];
    buttons.forEach((button) => button.addEventListener("click", async () => {
      buttons.forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
      picked.set(card, button.dataset.line);
      const sends = typeof sendPrompt === "function";
      const line = sends ? button.dataset.line : cards.filter((c) => picked.has(c)).map((c) => picked.get(c)).join(", ");
      const desc = card.querySelector(".picked .desc");
      await give(line, card.querySelector(".picked code"), desc);
      const open = cards.length - picked.size;
      if (!sends && open > 0) desc.textContent += ` ${open} question${open === 1 ? "" : "s"} still to pick; picking ${open === 1 ? "it" : "them"} adds to this line.`;
    }));
  });
})();

// Send answers, on a page whose data asks for it: once every question is answered, gives the chat this page load's
// first picks as one line, which the skill that drew the page sends on.
(() => {
  const box = document.querySelector(".send");
  if (!box) return;
  const load = crypto.randomUUID();
  const cards = [...document.querySelectorAll(".qz")];
  document.addEventListener("click", (event) => {
    if (event.target.closest("button.opt") && cards.every((card) => card.dataset.picked)) box.hidden = false;
  });
  const go = box.querySelector("button");
  go.addEventListener("click", () => {
    const picks = cards.map((card, k) => `${k + 1} ${card.dataset.picked} ${card.dataset.picked === card.dataset.answer ? "right" : "wrong"}`);
    give(`pr-review picks ${load}: ${picks.join("; ")}`, box.querySelector("code"), box.querySelector(".desc"), go);
  });
})();
