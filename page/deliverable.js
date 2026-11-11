/* global addEventListener, document, navigator, scrollTo, sendPrompt, setTimeout */
// A card's title opens it, with the map kept beside it; Escape, the page's name or "Back to all cards" goes back to the
// map. A pick on a question and a verdict on an edge case go into one line of answers: sent to the chat where the page
// can send one (a page shown with a global sendPrompt), otherwise copied to paste.
(() => {
  const root = document.querySelector(".dv");
  if (!root) return;
  const map = root.querySelector(".map-view");
  const zoom = root.querySelector(".zoom");
  const panels = [...root.querySelectorAll(".panel")];
  const byId = new Map(panels.map((p) => [p.dataset.card, p]));
  const questions = panels.filter((p) => p.dataset.card.startsWith("q"));
  const edges = panels.filter((p) => p.dataset.card.startsWith("e"));
  const picks = new Map();
  const verdicts = new Map();
  const sends = typeof sendPrompt === "function";
  const button = root.querySelector(".send");
  const fallback = root.querySelector(".fallback");
  const label = sends ? "Send answers" : "Copy answers";
  button.textContent = label;
  let opened = "";

  const show = (id) => {
    const panel = byId.get(id) ?? null;
    map.hidden = Boolean(panel);
    zoom.hidden = !panel;
    for (const p of panels) p.hidden = p !== panel;
    root.querySelectorAll(".mini .it").forEach((b) => b.setAttribute("aria-current", String(b.dataset.open === id)));
    scrollTo(0, 0);
    if (panel) {
      const h = panel.querySelector("h2");
      h.tabIndex = -1;
      h.focus({ preventScroll: true });
      opened = id;
    } else if (opened) {
      map.querySelector(`[data-open="${opened}"]`)?.focus({ preventScroll: true });
    }
  };

  const nameOf = (panel, k) => panel.querySelector(`.ot[data-k="${k}"] .name`)?.textContent ?? "";
  const status = (panel) => {
    const id = panel.dataset.card;
    const picked = picks.get(id);
    if (picked) return ["st-you", `You picked ${picked}, ${nameOf(panel, picked)}`];
    const chosen = panel.dataset.chosen;
    if (chosen) return ["st-you", `You chose ${chosen}, ${nameOf(panel, chosen)}`];
    return ["st-rec", `Recommended: ${panel.dataset.rec}, ${nameOf(panel, panel.dataset.rec)}`];
  };
  const refreshQuestion = (panel) => {
    const id = panel.dataset.card;
    panel.querySelectorAll(".ot").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.k === picks.get(id))));
    const [cls, text] = status(panel);
    root.querySelectorAll(`[data-status="${id}"]`).forEach((el) => {
      el.className = `st ${cls}`;
      el.textContent = text;
    });
    root.querySelectorAll(`[data-pip="${id}"]`).forEach((el) => {
      el.className = `pip ${cls}`;
    });
  };
  const refreshEdge = (panel) => {
    const id = panel.dataset.card;
    const v = verdicts.get(id);
    panel.querySelectorAll(".tog").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v)));
    root.querySelectorAll(`[data-verdict="${id}"]`).forEach((el) => {
      el.replaceChildren(...(v ? ["You: ", Object.assign(document.createElement("b"), { textContent: v === "ok" ? "looks right" : "let's discuss" })] : []));
    });
  };

  const answers = () => {
    const parts = [];
    const picked = questions.filter((p) => picks.has(p.dataset.card)).map((p) => `${p.dataset.n} ${picks.get(p.dataset.card)}`);
    if (picked.length) parts.push(picked.join(", "));
    for (const p of edges) {
      const v = verdicts.get(p.dataset.card);
      if (v === "discuss") parts.push(`Let's discuss edge case ${p.dataset.n} (${p.dataset.title})`);
      if (v === "ok") parts.push(`Edge case ${p.dataset.n} looks right`);
    }
    return parts.join(". ");
  };
  const refreshBar = () => {
    const bar = root.querySelector(".picks");
    const items = questions.map((p) => [`${p.dataset.n} `, Object.assign(document.createElement("b"), { textContent: picks.get(p.dataset.card) ?? "–" })]);
    const discuss = [...verdicts.values()].filter((v) => v === "discuss").length;
    if (discuss) items.push(["discuss ", Object.assign(document.createElement("b"), { textContent: String(discuss) })]);
    bar.replaceChildren(...items.flatMap((item, k) => (k ? [" · ", ...item] : item)));
    button.disabled = !answers();
  };

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (target.closest("a, summary, .fallback")) return;
    const opener = target.closest("[data-open]");
    if (opener) {
      show(opener.dataset.open);
      return;
    }
    const option = target.closest(".opt");
    if (option) {
      const panel = option.closest(".panel");
      const id = panel.dataset.card;
      const k = option.dataset.k;
      if (picks.get(id) === k) picks.delete(id);
      else picks.set(id, k);
      refreshQuestion(panel);
      refreshBar();
      return;
    }
    const toggle = target.closest(".tog");
    if (toggle) {
      const panel = toggle.closest(".panel");
      const id = panel.dataset.card;
      if (verdicts.get(id) === toggle.dataset.v) verdicts.delete(id);
      else verdicts.set(id, toggle.dataset.v);
      refreshEdge(panel);
      refreshBar();
    }
  });
  addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !zoom.hidden) show("");
  });

  button.addEventListener("click", () => {
    const text = answers();
    if (!text) return;
    const done = (word) => {
      button.textContent = word;
      setTimeout(() => {
        button.textContent = label;
      }, 1600);
    };
    if (sends) {
      sendPrompt(text);
      done("Sent");
      return;
    }
    const paste = () => {
      fallback.value = text;
      fallback.hidden = false;
      fallback.focus();
      fallback.select();
    };
    try {
      navigator.clipboard.writeText(text).then(() => done("Copied"), paste);
    } catch {
      paste();
    }
  });

  refreshBar();
})();
