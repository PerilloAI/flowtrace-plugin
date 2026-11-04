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

// Every mention of a name becomes a link naming its line under Names on this page, which the tip below shows beside it,
// outside headings, buttons, links and a row's line, where a click opens the row.
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

// Pointing at a name or a step's change, moving to it with the keyboard, or clicking or tapping it shows its line or row
// beside the mention and lights the mention, so the reader keeps their place. Pointing shows it while the pointer is on the
// mention or the tip. A click or tap keeps it, so a link in it can be followed, until a click anywhere else or Esc.
(() => {
  const tip = document.createElement("div");
  tip.className = "tip";
  tip.id = "name-tip";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  document.body.append(tip);
  let shown = null, pinned = false, returning = false;
  const mentions = "a.term, a.to-change";
  // A name's line under Names, or a change's row of The changes and why, each cell under its heading.
  const words = (target) => {
    const strong = (text) => Object.assign(document.createElement("strong"), { textContent: text });
    const copy = (el) => [...el.childNodes].map((n) => n.cloneNode(true));
    if (target.matches("dt")) return [strong(target.textContent), " ", ...copy(target.nextElementSibling)];
    const heads = target.closest("table").querySelectorAll("th");
    return [strong(target.cells[0].textContent), ...[...target.cells].slice(1).map((cell, k) => {
      const part = document.createElement("div");
      part.append(Object.assign(document.createElement("span"), { className: "tag alt", textContent: heads[k + 1].textContent }), " ", ...copy(cell));
      return part;
    })];
  };
  const hide = () => {
    if (!shown) return;
    const within = tip.contains(document.activeElement);
    shown.classList.remove("lit");
    shown.removeAttribute("aria-describedby");
    shown = null;
    pinned = false;
    tip.hidden = true;
    // Focus in the tip goes back to the mention it opened from, without opening it again.
    if (within) {
      returning = true;
      tip.from.focus({ preventScroll: true });
      returning = false;
    }
  };
  const show = (term) => {
    const target = document.getElementById(decodeURIComponent(term.getAttribute("href").slice(1)));
    if (!target || shown === term) return;
    // Measured first: a name in the tip itself goes as the tip fills.
    const at = term.getBoundingClientRect();
    hide();
    // The mention on the page this tip opened from, which a name in the tip itself doesn't replace.
    if (!term.closest(".tip")) tip.from = term;
    // In the modal, which sits above everything else on the page, the tip goes with it and stays put as it does.
    const host = term.closest("dialog") || document.body;
    if (tip.parentElement !== host) host.append(tip);
    const [dx, dy] = host === document.body ? [scrollX, scrollY] : [0, 0];
    tip.style.position = host === document.body ? "" : "fixed";
    tip.replaceChildren(...words(target));
    tip.hidden = false;
    shown = term;
    term.classList.add("lit");
    term.setAttribute("aria-describedby", tip.id);
    const width = tip.offsetWidth;
    const left = Math.min(Math.max(8, at.left), document.documentElement.clientWidth - width - 8);
    // Below it where there's room, except over a step's How it's built, which the reader may want next.
    const roomBelow = at.bottom + 6 + tip.offsetHeight < innerHeight;
    const roomAbove = at.top - 6 - tip.offsetHeight >= 0;
    const below = roomBelow && !(roomAbove && term.closest(".n")?.querySelector(".to-flow"));
    tip.style.left = `${left + dx}px`;
    tip.style.top = `${(below ? at.bottom + 6 : at.top - 6 - tip.offsetHeight) + dy}px`;
    tip.classList.toggle("above", !below);
  };
  document.addEventListener("pointerover", (event) => {
    const mouse = event.pointerType === "mouse";
    if (event.target.closest(".tip") || (mouse && pinned)) return;
    const term = mouse && event.target.closest(mentions);
    if (term) show(term);
    else hide();
  });
  document.addEventListener("focusin", (event) => {
    if (returning || event.target.closest(".tip")) return;
    const term = event.target.closest(mentions);
    if (term) show(term);
    else hide();
  });
  document.addEventListener("click", (event) => {
    const term = event.target.closest(mentions);
    if (!term) {
      // A click on the tip's words leaves it, so they can be selected. A link in it is followed.
      if (!event.target.closest(".tip") || event.target.closest("a")) hide();
      return;
    }
    event.preventDefault();
    show(term);
    pinned = Boolean(shown);
    // From the keyboard, on to the first link in the tip, as Tab couldn't reach it from the mention. Esc comes back.
    if (!event.detail) tip.querySelector("a")?.focus({ preventScroll: true });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !shown) return;
    // Esc closes the tip alone, and leaves a modal under it for the next.
    event.preventDefault();
    hide();
  });
  // A scroller inside the page moves the mention from under its tip. The page itself carries the tip along.
  document.addEventListener("scroll", (event) => {
    if (event.target !== document) hide();
  }, true);
})();

// A link to a part of the page (How it's built, Where to look, See it, Seen in) opens a copy of it in a modal over the
// page, which stays where it is: a flow whole with the step lit, a chart, or a section. Esc, the close button or a click
// outside closes the modal. Inside it, a link to somewhere the reader has been goes back there, so going round in a circle
// never builds up, and a link naming the part that holds the link that opened the modal just closes it, while one naming
// a step in that part shows the step. The modal's own Back retraces the rest. A link to anything else (a table's row, say) closes the modal and scrolls to what it names, lit, and
// the page's Back returns to the link clicked. Links followed from inside Names on this page add to that way back.
(() => {
  const back = document.createElement("button");
  back.type = "button";
  back.className = "back";
  back.textContent = "↩ Back to where you were";
  back.hidden = true;
  document.body.append(back);
  const modal = document.createElement("dialog");
  modal.className = "modal";
  modal.innerHTML = '<div class="modal-bar"><button type="button" class="modal-back" hidden>↩ Back</button><div class="modal-title"></div><button type="button" class="modal-close">✕ Close</button></div><div class="modal-body"></div>';
  document.body.append(modal);
  const modalBack = modal.querySelector(".modal-back");
  const close = modal.querySelector(".modal-close");
  const title = modal.querySelector(".modal-title");
  const body = modal.querySelector(".modal-body");
  const copies = new Map();
  const way = [];
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
  // What the modal can show of a link's target: the flow around a step, or a chart's or section's heading.
  const partOf = (target) => target.closest(".flowbox") || (target.matches("h2, h3") ? target : null);
  // A part's heading, and what it holds under it.
  const contents = (part) => {
    if (part.matches(".flowbox")) return { heading: part.querySelector("h3"), held: [part.querySelector(".row-meta"), part.querySelector("figure")].filter(Boolean) };
    if (part.matches("h2")) return { heading: part, held: [...part.parentElement.children].filter((el) => el !== part) };
    const held = [];
    for (let n = part.nextElementSibling; n && !n.matches("h2, h3"); n = n.nextElementSibling) {
      held.push(n);
      if (n.matches("figure")) break;
    }
    return { heading: part, held };
  };
  // Whether closing the modal leaves the reader at this part, which holds the link that opened the modal and isn't a closed row.
  const around = (part) => {
    const { heading, held } = contents(part);
    return part.open !== false && [heading, ...held].some((el) => el.contains(opener));
  };
  // What a part holds, each id kept as data-from so the page's links still reach the page's own parts. Copied afresh each
  // time it's shown, so what has been answered on the page since is there, and a comment begun in the last copy moves over.
  // A question in a copy is answered on the page, and a copy holding an open one says so.
  const copyOf = (part) => {
    const copy = document.createElement("div");
    copy.append(...contents(part).held.map((el) => el.cloneNode(true)));
    copy.querySelectorAll("[id]").forEach((el) => {
      el.dataset.from = el.id;
      el.removeAttribute("id");
    });
    copy.querySelectorAll(".cmt-box").forEach((el) => el.remove());
    const asks = [...copy.querySelectorAll("button.opt, button.pick, .approve-btn, .send button")];
    if (asks.some((button) => !button.disabled)) copy.prepend(Object.assign(document.createElement("p"), { className: "desc modal-note", textContent: "To answer, close this and use the page." }));
    asks.forEach((button) => {
      button.disabled = true;
    });
    const cells = copy.querySelectorAll(".cell");
    copies.get(part)?.querySelectorAll(".cell").forEach((cell, k) => {
      const box = cell.querySelector(":scope > .cmt-box");
      if (box) cells[k].append(box);
    });
    copies.set(part, copy);
    return copy;
  };
  // Shows the last place on the way, where the reader left it, or else at its step.
  const showPlace = () => {
    const { part, target, y } = way[way.length - 1];
    const copy = copyOf(part);
    copy.querySelectorAll(".hit").forEach((el) => el.classList.remove("hit"));
    body.replaceChildren(copy);
    // The name stays in the bar as the part scrolls under it.
    const { heading } = contents(part);
    title.replaceChildren(...[...heading.childNodes].map((n) => n.cloneNode(true)));
    modal.setAttribute("aria-label", heading.textContent);
    modalBack.hidden = way.length < 2;
    if (!modal.open) modal.showModal();
    const step = target === part ? null : copy.querySelector(`[data-from="${CSS.escape(target.id)}"]`);
    if (step) step.classList.add("hit");
    body.scrollTop = y ?? (step ? body.scrollTop + step.getBoundingClientRect().top - body.getBoundingClientRect().top - body.clientHeight / 3 : 0);
    // A wide chart scrolls sideways on its own, so the step may need bringing in that way too.
    const chart = step && step.closest(".chart");
    if (chart) chart.scrollLeft += step.getBoundingClientRect().left - chart.getBoundingClientRect().left - (chart.clientWidth - step.offsetWidth) / 2;
    // The keys scroll what holds the focus, and Tab carries on from it.
    const focused = step || body;
    focused.setAttribute("tabindex", "-1");
    focused.focus({ preventScroll: true });
  };
  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]:not(.term, .to-change)');
    const target = link && document.getElementById(decodeURIComponent(link.getAttribute("href").slice(1)));
    if (!target) return;
    event.preventDefault();
    // A link in a tip is gone once the tip closes, so the way back is to the mention the tip opened from.
    const clicked = link.closest(".tip")?.from ?? link;
    const part = partOf(target);
    if (part) {
      if (!modal.open) {
        opener = clicked;
        way.length = 0;
      } else if (target === part && around(part)) {
        return modal.close();
      } else {
        way[way.length - 1].y = body.scrollTop;
      }
      const been = way.findIndex((place) => place.part === part);
      if (been < 0) way.push({ part, target });
      else {
        way.length = been + 1;
        if (way[been].target !== target) way[been] = { part, target };
      }
      return showPlace();
    }
    const from = modal.contains(link) ? opener : clicked;
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
  modalBack.addEventListener("click", () => {
    way.pop();
    showPlace();
    if (!modalBack.hidden) modalBack.focus({ preventScroll: true });
  });
  close.addEventListener("click", () => modal.close());
  // A press that began inside isn't a click outside, wherever it's let go: a drag, or a comment box being resized.
  let pressedInside = false;
  modal.addEventListener("pointerdown", (event) => {
    pressedInside = event.target !== modal;
  });
  modal.addEventListener("click", (event) => {
    if (event.target === modal && !pressedInside) modal.close();
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
