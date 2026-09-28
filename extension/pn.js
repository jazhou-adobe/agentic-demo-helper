/* AgentDemo — Prompt Navigator
 * Single-file content script. Works loaded as an extension (chrome.storage)
 * or included directly on a page for standalone verification (localStorage).
 * Runs only in the top frame's UI; capture/selectors operate on the local document.
 */
(function () {
  "use strict";
  if (window.__pnLoaded) return;
  window.__pnLoaded = true;

  const APP_VERSION = "0.1.0";
  const SCHEMA_VERSION = 1;

  // ---------------------------------------------------------------- storage
  const hasChromeStore =
    typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  const store = {
    async getAll() {
      if (hasChromeStore) return await chrome.storage.local.get(null);
      const o = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith("pn:")) {
          try { o[k] = JSON.parse(localStorage.getItem(k)); } catch (_) {}
        }
      }
      return o;
    },
    async get(key) {
      if (hasChromeStore) return (await chrome.storage.local.get(key))[key];
      const v = localStorage.getItem(key);
      return v == null ? undefined : JSON.parse(v);
    },
    async set(key, val) {
      if (hasChromeStore) return await chrome.storage.local.set({ [key]: val });
      localStorage.setItem(key, JSON.stringify(val));
    },
    async remove(key) {
      if (hasChromeStore) return await chrome.storage.local.remove(key);
      localStorage.removeItem(key);
    },
  };

  // Extension mode stays dormant until the toolbar button is clicked; standalone <script> auto-runs.
  const IS_EXTENSION = !!(typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id);
  let pnEnabled = !IS_EXTENSION;
  let booted = false;
  function setEnabled(on) {
    pnEnabled = on;
    if (on) {
      if (!booted) { booted = true; boot(); }
      else { renderPanel(); applyFrameVisibility(); }
    } else {
      try { host.style.display = "none"; } catch (_) {}
    }
  }

  // ---------------------------------------------------------------- defaults
  const DEFAULT_GLOBAL = {
    flashMs: 1200,
    defaultMode: "navigate",
    promptLabel: "Your Prompt",
  };

  const BUILTIN_TEMPLATES = [
    {
      id: "bullets",
      name: "Key bullet points",
      purpose: "Summarize the value of this exchange as 3–5 crisp bullets.",
      purpose_shape: "3–5 crisp bullet points",
    },
    {
      id: "diagram",
      name: "SVG flow diagram",
      purpose: "Illustrate the workflow/decision as a simple labeled diagram.",
      purpose_shape: "one clear labeled SVG diagram (boxes + arrows)",
    },
    {
      id: "value",
      name: "Value summary",
      purpose: "State the business value delivered in this step for an executive audience.",
      purpose_shape: "a bold headline + 2–3 supporting lines",
    },
  ];

  // ---------------------------------------------------------------- profiles
  // Query across light DOM AND shadow roots (Experience Workspace renders its chat inside
  // web-component shadow trees that document.querySelector can't reach).
  function deepQuery(sel, root) {
    root = root || document;
    const stack = [root];
    while (stack.length) {
      const r = stack.shift();
      let found = null;
      try { found = r.querySelector(sel); } catch (_) {}
      if (found) return found;
      const els = r.querySelectorAll ? r.querySelectorAll("*") : [];
      for (const el of els) if (el.shadowRoot) stack.push(el.shadowRoot);
    }
    return null;
  }
  // Resolve a profile's container element, piercing shadow DOM when needed.
  function getContainer(prof) {
    if (!prof || !prof.container) return null;
    return document.querySelector(prof.container) || deepQuery(prof.container);
  }
  const PROFILES = [
    {
      id: "coworker",
      test: () =>
        location.host === "experience.adobe.com" &&
        (!!document.querySelector('[data-testid="chat-page"]') || !!document.querySelector('[data-testid="episode-list-wrapper"]')),
      container: '[data-testid="chatlog-virtual-list-container"]',
      rowSelector: '[data-index]',
      userMatch: (row) => coworkerIsUser(row),
      userPrompt: null,
      preview: null,
    },
    {
      id: "workspace",
      test: () =>
        location.host === "da.live" &&
        location.pathname.startsWith("/canvas") &&
        !!deepQuery("nx-chat-ao"),
      container: ".chat-messages-container",
      rowSelector: ".message",
      userMatch: (row) => !!(row.classList && row.classList.contains("message-user")),
      userPrompt: ".message-user",
      preview: null,
    },
    {
      id: "aemcoder",
      test: () =>
        location.host === "aemcoder.adobe.io" &&
        /\/chat(\/|$)/.test(location.pathname),
      container: '[aria-label="Chat messages"]',
      rowSelector: '[role="row"]',
      userMatch: (row) => hasUserBubble(row),
      userPrompt: null,
      preview: "iframe[src*='preview-aemcoder']",
    },
    {
      id: "mock",
      test: () => !!document.querySelector('[data-pn-ui="mock"]'),
      container: "#chat-log",
      userPrompt: '[data-role="user"]',
      preview: null,
    },
  ];
  function detectProfile() {
    for (const p of PROFILES) {
      try { if (p.test()) return p; } catch (_) {}
    }
    return { id: "unknown", container: null, userPrompt: null, preview: null };
  }
  function getProfileById(id) { return PROFILES.find((p) => p.id === id) || null; }
  function resolveProfile() {
    if (S.forced) { const p = getProfileById(S.forced); if (p) return p; }
    return detectProfile();
  }
  // Re-run detection (or apply the forced profile); update profile/container/badge if it changed.
  function ensureProfile() {
    const p = resolveProfile();
    if (p.id !== "unknown" && (!S.profile || p.id !== S.profile.id)) {
      S.profile = p;
      S.convKey = p.id + "::" + convIdFromUrl();
      if (!S.userSelector && !S.userMatch) { S.userMatch = p.userMatch || null; S.rowSelector = p.rowSelector || null; S.userSelector = p.userPrompt || null; }
      S.container = p.container ? (getContainer(p) || S.container) : S.container;
      renderPanel();
      return true;
    }
    if (S.profile && S.profile.id !== "unknown" && S.profile.container && !S.container) {
      S.container = getContainer(S.profile);
    }
    return false;
  }
  async function setForced(id) {
    S.forced = id || null;
    try { await store.set("pn:forced:" + location.host, S.forced); } catch (_) {}
    // reset learned/derived detection so the chosen profile governs
    S.userMatch = null; S.rowSelector = null; S.userSelector = null; S.userColor = null;
    S.container = null; S.turns = []; S.steps = S.steps.filter((s) => s.type === "card");
    S.profile = { id: "unknown", container: null };
    ensureProfile();
    toast(S.forced ? ("Forced profile: " + S.profile.id) : "Auto-detect profile");
    renderPanel();
  }
  function openProfileMenu() {
    const cur = S.forced || null;
    const opts = [{ id: null, name: "Auto-detect" }].concat(PROFILES.map((p) => ({ id: p.id, name: p.id })));
    const rows = opts.map((o) => `<button data-p="${o.id === null ? "" : o.id}" class="${cur === (o.id || null) ? "primary" : ""}" style="display:block;width:100%;text-align:left;margin-bottom:6px">${o.id === null ? "🔄 " : "🔒 "}${escapeHtml(o.name)}${cur === (o.id || null) ? " ✓" : ""}</button>`).join("");
    const m = modal(`<h3>Force UI profile</h3><p style="color:#9aa4c8;font-size:12px">Override auto-detection if the badge shows the wrong UI. Saved for ${escapeHtml(location.host)}.</p>${rows}<div class="actions"><button data-x="cancel">Close</button></div>`);
    m.querySelector('[data-x="cancel"]').onclick = closeModal;
    m.querySelectorAll("[data-p]").forEach((b) => (b.onclick = async () => { await setForced(b.dataset.p || null); closeModal(); }));
  }

  // ---------------------------------------------------------- selector utils
  // Heuristic: is a class token a build-hashed / CSS-module name?
  function isHashedClass(tok) {
    if (!tok) return true;
    if (/\d/.test(tok) && tok.length <= 9) return true; // e.g. sd171, Gs171, _ta171
    if (/^[_-]/.test(tok)) return true;
    return false;
  }
  function stableClasses(el) {
    return (el.className && el.className.toString ? el.className.toString() : "")
      .split(/\s+/)
      .filter((t) => t && !t.startsWith("pn-") && !isHashedClass(t));
  }
  // Some UIs (e.g. aemcoder / React-Aria grids) mark the user turn ONLY by a colored
  // bubble, with no stable attribute or class. Detect that visually.
  function isTintedBg(bg) {
    const c = parseBg(bg); if (!c) return false;
    if (c.r >= 245 && c.g >= 245 && c.b >= 245) return false;          // white
    return (Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b)) >= 20;  // saturated / tinted, not grey
  }
  // The user turn is the row whose bubble has a tinted (colored, non-grey) background —
  // hue/theme agnostic. Small text guard avoids matching tiny colored chips/badges.
  function hasUserBubble(row) {
    if (!row || !row.querySelectorAll) return false;
    for (const el of row.querySelectorAll("*")) {
      if (isTintedBg(getComputedStyle(el).backgroundColor) && (el.innerText || "").trim().length >= 6) return true;
    }
    return false;
  }
  // Coworker (experience.adobe.com) marks no data-role; user vs. agent differ only by the agent's
  // affordances. An episode is a USER prompt when it has text but none of the agent-only widgets
  // (the "Coworker actions" toolbar, chain segments, or the per-message Copy/feedback controls).
  function coworkerIsUser(row) {
    if (!row || !row.querySelector) return false;
    if ((row.innerText || "").trim().length < 2) return false;
    if (row.querySelector('[aria-label="Coworker actions"]')) return false;
    if (row.querySelector('[data-omega-widget="chain segment"]')) return false;
    if (row.querySelector('[aria-label="Copy message"]')) return false;
    return true;
  }
  function parseBg(bg) {
    const m = bg && bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
    if (!m) return null;
    const a = m[4] === undefined ? 1 : +m[4];
    if (a <= 0) return null;
    return { r: +m[1], g: +m[2], b: +m[3] };
  }
  function colorClose(a, b, tol) { return a && b && Math.abs(a.r - b.r) <= tol && Math.abs(a.g - b.g) <= tol && Math.abs(a.b - b.b) <= tol; }
  function rowHasColor(row, sig, tol) {
    if (!row || !row.querySelectorAll) return false;
    if (colorClose(parseBg(getComputedStyle(row).backgroundColor), sig, tol)) return true;
    for (const el of row.querySelectorAll("*")) { if (colorClose(parseBg(getComputedStyle(el).backgroundColor), sig, tol)) return true; }
    return false;
  }
  function makeColorMatch(sig) { return (row) => rowHasColor(row, sig, 18); }
  function cssEscape(s) {
    return (window.CSS && CSS.escape) ? CSS.escape(s) : s.replace(/["\\]/g, "\\$&");
  }
  // Derive a selector for the "turn kind" of `el`, within container, optionally
  // contrasted against a negative example. Returns {selector, matches} or null.
  function deriveSelector(el, container, negativeEl) {
    if (!el) return null;
    const scope = container || document.body;
    // climb to the direct-ish turn node (child chain under container)
    let turn = el;
    while (turn.parentElement && turn.parentElement !== scope && turn.parentElement !== document.body) {
      if (container && turn.parentElement === container) break;
      turn = turn.parentElement;
      if (turn === scope) break;
    }
    const candidates = [];
    // 1. stable data-* / role / aria attributes on the turn node
    for (const a of turn.attributes || []) {
      if (/^(data-|aria-)/.test(a.name) || a.name === "role") {
        if (isHashedClass(a.value)) continue;
        candidates.push(`${turn.tagName.toLowerCase()}[${a.name}="${cssEscape(a.value)}"]`);
        candidates.push(`[${a.name}="${cssEscape(a.value)}"]`);
      }
    }
    // 2. stable classes
    for (const c of stableClasses(turn)) {
      candidates.push(`${turn.tagName.toLowerCase()}.${cssEscape(c)}`);
      candidates.push(`.${cssEscape(c)}`);
    }
    // score candidates: must match >1 and NOT match the negative example
    const tested = [];
    for (const sel of candidates) {
      let matches;
      try { matches = Array.from(scope.querySelectorAll(sel)); } catch (_) { continue; }
      if (matches.length < 1) continue;
      const hitsNeg = negativeEl ? matches.includes(negativeEl) : false;
      if (hitsNeg) continue;
      tested.push({ selector: sel, count: matches.length });
    }
    // prefer selectors matching multiple siblings (all user turns)
    tested.sort((a, b) => b.count - a.count);
    if (tested.length) {
      return { selector: tested[0].selector, matches: tested[0].count };
    }
    // 3. structural parity fallback (odd children = user, common in chat logs)
    if (container) {
      const kids = Array.from(container.children);
      const idx = kids.indexOf(turn);
      if (idx >= 0) {
        const parity = idx % 2 === 0 ? "even" : "odd"; // nth-child is 1-based
        const sel = `#${container.id ? cssEscape(container.id) : ""} > *:nth-child(${parity})`.replace(/^#\s?>/, "* >");
        return { selector: `:scope > *:nth-child(${parity})`, matches: kids.filter((_, i) => i % 2 === idx % 2).length, structural: true };
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- sanitize
  function sanitizeHTML(html) {
    const tpl = document.createElement("template");
    tpl.innerHTML = html;
    tpl.content.querySelectorAll("script,iframe,object,embed,link,meta").forEach((n) => n.remove());
    tpl.content.querySelectorAll("*").forEach((n) => {
      for (const a of Array.from(n.attributes)) {
        const name = a.name.toLowerCase();
        if (name.startsWith("on")) n.removeAttribute(a.name);
        if ((name === "href" || name === "src") && /^\s*javascript:/i.test(a.value))
          n.removeAttribute(a.name);
      }
    });
    return tpl.innerHTML;
  }

  // ---------------------------------------------------------------- capture
  // Build ordered turns from the live DOM using the user-prompt selector.
  function isUserNode(el, userSelector, userMatch) {
    if (userMatch) return !!userMatch(el);
    if (!userSelector) return false;
    return (el.matches && el.matches(userSelector)) || !!(el.querySelector && el.querySelector(userSelector));
  }
  // Build ordered turns from the live DOM. Detect user turns via a CSS selector OR a
  // predicate (profile.userMatch); optionally treat profile.rowSelector nodes as turns.
  function captureTurns(container, userSelector, opts) {
    opts = opts || { userMatch: S.userMatch || (S.profile && S.profile.userMatch), rowSelector: S.rowSelector || (S.profile && S.profile.rowSelector) };
    const userMatch = opts.userMatch, rowSelector = opts.rowSelector;
    const scope = container || document.body;
    let rows;
    if (rowSelector) rows = Array.from(scope.querySelectorAll(rowSelector));
    else rows = container ? Array.from(container.children) : [];
    const turns = [];
    if (rows.length && (rowSelector || userMatch || userSelector)) {
      let cur = null;
      for (const k of rows) {
        if (isUserNode(k, userSelector, userMatch)) {
          cur = { role: "user", promptEl: k, promptHtml: k.outerHTML, promptText: (k.innerText || "").trim(), responseEls: [] };
          turns.push(cur);
        } else if (cur) cur.responseEls.push(k);
      }
      if (turns.length || rowSelector) return turns;
    }
    // fallback: matched nodes + nextElementSiblings (CSS selector only)
    if (userSelector) {
      const nodes = Array.from(scope.querySelectorAll("*")).filter((el) => el.matches && el.matches(userSelector));
      for (const u of nodes) {
        const t = { role: "user", promptEl: u, promptHtml: u.outerHTML, promptText: (u.innerText || "").trim(), responseEls: [] };
        let s = u.nextElementSibling;
        while (s && !(s.matches && s.matches(userSelector))) { t.responseEls.push(s); s = s.nextElementSibling; }
        turns.push(t);
      }
    }
    return turns;
  }


  // ---------------------------------------------------------------- state
  const S = {
    profile: null,
    convKey: null,
    url: location.href,
    title: document.title,
    userSelector: null,
    container: null,
    turns: [],
    steps: [],        // {type:'prompt', turnIndex} | {type:'card', id, html, note}
    currentIndex: 0,
    mode: "navigate",
    global: { ...DEFAULT_GLOBAL },
    templates: [...BUILTIN_TEMPLATES],
    userMatch: null,
    rowSelector: null,
    userColor: null,
    _min: true,
    debug: null,
    showDebug: false,
    _scrollMeta: null,
    forced: null,
  };

  function convIdFromUrl() {
    const m = location.hash.match(/(\d{6,})/) || location.pathname.match(/([a-z0-9\-]{6,})\/?$/i);
    return m ? m[1] : location.pathname.replace(/\W+/g, "-").slice(-24) || "default";
  }

  function buildStepsFromTurns() {
    // preserve existing card steps, rebuild prompt steps
    const cards = S.steps.filter((s) => s.type === "card");
    const prompt = S.turns.map((_, i) => ({ type: "prompt", turnIndex: i, label: null, note: "" }));
    // simple: prompts first then cards appended is wrong; keep prior order if any
    if (!S.steps.length) { S.steps = prompt; return; }
    // merge: keep order, replace prompt steps in place, keep cards where anchored
    const merged = [];
    let pi = 0;
    for (const s of S.steps) {
      if (s.type === "prompt") { if (prompt[pi]) merged.push(Object.assign(prompt[pi], { label: s.label, note: s.note })); pi++; }
      else merged.push(s);
    }
    for (; pi < prompt.length; pi++) merged.push(prompt[pi]);
    S.steps = merged;
  }

  function promptLabel(step) {
    if (step.type === "card") return step.title || "🗂 Card";
    const t = S.turns[step.turnIndex];
    if (step.label) return step.label;
    const txt = (t && t.promptText) || `Prompt ${step.turnIndex + 1}`;
    return txt.length > 50 ? txt.slice(0, 49) + "…" : txt;
  }

  // ---------------------------------------------------------------- persistence
  function serializeConv(includeCapture) {
    const conv = {
      url: S.url, title: S.title, uiProfile: S.profile.id,
      promptSelector: S.userSelector,
      userColor: S.userColor || null,
      rowSelector: S.rowSelector || null,
      steps: S.steps.map((s) => s.type === "card"
        ? { type: "card", id: s.id, title: s.title, html: s.html, note: s.note || "" }
        : { type: "prompt", turnIndex: s.turnIndex, label: s.label || null, note: s.note || "" }),
    };
    if (includeCapture) {
      conv.capture = S.turns.map((t) => ({
        promptHtml: sanitizeHTML(t.promptHtml),
        promptText: t.promptText,
        responseHtml: t.responseEls.map((e) => sanitizeHTML(e.outerHTML)),
      }));
    }
    return conv;
  }
  async function save() {
    await store.set("pn:global", S.global);
    await store.set("pn:templates", S.templates);
    await store.set("pn:conv:" + S.convKey, serializeConv(false));
    toast("Saved");
  }
  async function loadGlobals() {
    const g = await store.get("pn:global");
    if (g) S.global = { ...DEFAULT_GLOBAL, ...g };
    const t = await store.get("pn:templates");
    if (t && t.length) S.templates = t;
  }
  async function loadConv(key) {
    const c = await store.get("pn:conv:" + key);
    if (!c) return false;
    applyConv(c);
    return true;
  }
  function applyConv(c) {
    // restore card steps + prompt-step metadata onto current turns
    S.userSelector = c.promptSelector || S.userSelector;
    if (c.userColor) { S.userColor = c.userColor; S.rowSelector = c.rowSelector || S.rowSelector; S.userMatch = makeColorMatch(c.userColor); }
    if (S.userMatch && !S.turns.length) {
      S.container = (S.profile.container && document.querySelector(S.profile.container)) || S.container || document.body;
      S.turns = captureTurns(S.container, null);
    }
    if (c.capture && c.capture.length && (!S.turns.length)) {
      // imported bundle: render captured turns onto an overlay surface
      renderImportedCapture(c.capture);
    }
    const cardSteps = (c.steps || []).filter((s) => s.type === "card");
    const promptMeta = (c.steps || []).filter((s) => s.type === "prompt");
    buildStepsFromTurns();
    // apply metadata
    let pi = 0;
    for (const s of S.steps) {
      if (s.type === "prompt" && promptMeta[pi]) {
        s.label = promptMeta[pi].label; s.note = promptMeta[pi].note;
        pi++;
      }
    }
    // re-insert card steps by their original position
    const orig = c.steps || [];
    const rebuilt = [];
    let p = 0;
    for (const s of orig) {
      if (s.type === "card") rebuilt.push({ ...s });
      else { const ns = S.steps.filter((x) => x.type === "prompt")[p]; if (ns) rebuilt.push(ns); p++; }
    }
    if (rebuilt.length) S.steps = rebuilt;
    renderPanel();
  }

  // ---------------------------------------------------------------- import/export
  function buildBundle(includeCapture) {
    return {
      schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), appVersion: APP_VERSION,
      global: S.global, templates: S.templates,
      conversations: { [S.convKey]: serializeConv(includeCapture) },
    };
  }
  function download(name, text, mime) {
    const blob = new Blob([text], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportJSON(includeCapture) {
    const b = buildBundle(includeCapture);
    download(`demo-${slug(S.title)}-${dateStr()}.json`, JSON.stringify(b, null, 2), "application/json");
    toast("Exported JSON" + (includeCapture ? " (with logs)" : ""));
  }
  function exportMD(includeCapture) {
    const b = buildBundle(includeCapture);
    let md = `# Demo Script: ${S.title}\n\n`;
    md += `_UI: ${S.profile.id} · ${S.steps.length} steps · ${dateStr()}_\n\n`;
    S.steps.forEach((s, i) => {
      md += `## Step ${i + 1} · ${s.type}\n`;
      md += `- label: ${promptLabel(s)}\n`;
      if (s.note) md += `- note: ${s.note}\n`;
      md += `\n`;
    });
    md += "<!-- pn-bundle (lossless; do not edit) -->\n```json pn-bundle\n" + JSON.stringify(b) + "\n```\n";
    download(`demo-${slug(S.title)}-${dateStr()}.md`, md, "text/markdown");
    toast("Exported Markdown" + (includeCapture ? " (with logs)" : ""));
  }
  function parseBundle(text) {
    text = text.trim();
    if (text.startsWith("{")) return JSON.parse(text);
    const m = text.match(/```json pn-bundle\s*([\s\S]*?)```/);
    if (m) return JSON.parse(m[1].trim());
    throw new Error("No pn-bundle found in file");
  }
  async function importFile(file, mode /* replace|merge */) {
    const text = await file.text();
    const bundle = parseBundle(text);
    if (bundle.global) S.global = { ...DEFAULT_GLOBAL, ...bundle.global };
    if (bundle.templates && bundle.templates.length) S.templates = bundle.templates;
    const convs = bundle.conversations || {};
    const firstKey = Object.keys(convs)[0];
    if (!firstKey) throw new Error("Bundle has no conversations");
    const conv = convs[firstKey];
    if (mode === "replace") { S.steps = []; }
    applyConv(conv);
    await save();
    toast("Imported (" + mode + ")");
  }

  // render an imported capture onto an overlay surface (React-safe substrate)
  function renderImportedCapture(capture) {
    let surface = document.getElementById("pn-overlay-surface");
    if (!surface) {
      surface = document.createElement("div");
      surface.id = "pn-overlay-surface";
      Object.assign(surface.style, {
        position: "fixed", inset: "0", background: "#0b1020",
        color: "#e6e9f2", overflow: "auto", zIndex: 2147483000, padding: "32px 8%",
        font: "16px/1.6 system-ui, sans-serif",
      });
      document.body.appendChild(surface);
    }
    surface.innerHTML = "";
    S.container = surface; S.userSelector = '[data-role="user"]';
    S.turns = [];
    capture.forEach((t, i) => {
      const u = document.createElement("div");
      u.setAttribute("data-role", "user");
      u.className = "pn-imp-user"; u.innerHTML = sanitizeHTML(t.promptHtml);
      surface.appendChild(u);
      const respEls = [];
      (t.responseHtml || []).forEach((h) => {
        const a = document.createElement("div");
        a.setAttribute("data-role", "assistant"); a.className = "pn-imp-assistant";
        a.innerHTML = sanitizeHTML(h); surface.appendChild(a); respEls.push(a);
      });
      S.turns.push({ role: "user", promptEl: u, promptHtml: t.promptHtml, promptText: t.promptText, responseEls: respEls });
    });
    buildStepsFromTurns();
  }

  // ---------------------------------------------------------------- helpers
  function slug(s) { return (s || "demo").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40); }
  function dateStr() { return new Date().toISOString().slice(0, 10); }
  let toastT;
  function toast(msg) {
    let el = shadow.getElementById("pn-toast");
    el.textContent = msg; el.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 1800);
  }

  // ---------------------------------------------------------------- Navigate
  function allTurnNodes() {
    const nodes = [];
    S.turns.forEach((t) => { nodes.push(t.promptEl); t.responseEls.forEach((e) => nodes.push(e)); });
    return nodes;
  }
  function clearRevealClasses() {
    allTurnNodes().forEach((n) => n && n.classList && n.classList.remove("pn-hidden", "pn-spot"));
    document.querySelectorAll(".pn-current").forEach((n) => n.classList.remove("pn-current"));
    if (S.container && S.container.classList) S.container.classList.remove("pn-dim");
  }
  function showAll() { clearRevealClasses(); }
  function spotlight(step) {
    if (!S.container) return;
    S.container.classList.add("pn-dim");
    allTurnNodes().forEach((n) => n && n.classList.remove("pn-spot"));
    const t = step.type === "prompt" ? S.turns[step.turnIndex] : null;
    if (t) { t.promptEl.classList.add("pn-spot"); t.responseEls.forEach((e) => e.classList.add("pn-spot")); }
  }
  function flash(el) {
    if (!el) return;
    ensureStylesIn(el);
    el.classList.add("pn-flash");
    setTimeout(() => el.classList.remove("pn-flash"), S.global.flashMs);
  }
  let _pnCurrentEl = null;
  function markCurrent(el) {
    if (_pnCurrentEl) { try { _pnCurrentEl.classList.remove("pn-current"); } catch (_) {} }
    document.querySelectorAll(".pn-current").forEach((n) => n.classList.remove("pn-current"));
    _pnCurrentEl = el || null;
    if (el) { ensureStylesIn(el); el.setAttribute("data-pn-label", (S.global && S.global.promptLabel) || "Your Prompt"); el.classList.add("pn-current"); }
  }
  const PN_PAGE_CSS = `
      .pn-hidden { display: none !important; }
      .pn-dim > * { opacity: .28 !important; filter: blur(.4px); transition: opacity .2s; }
      .pn-spot { opacity: 1 !important; filter: none !important; }
      .pn-flash { animation: pnFlash 1.2s ease-out; }
      @keyframes pnFlash { 0% { box-shadow: 0 0 0 3px rgba(68,87,214,.9); } 100% { box-shadow: 0 0 0 3px rgba(68,87,214,0); } }
      .pn-current { position: relative !important; outline: 3px solid #4457d6 !important; outline-offset: 3px; border-radius: 8px; scroll-margin-top: 28px; }
      .pn-current::before { content: attr(data-pn-label); position: absolute; top: -11px; left: 10px; background: #4457d6; color: #fff; font: 700 11px/1.5 system-ui, -apple-system, sans-serif; letter-spacing: .02em; padding: 1px 8px; border-radius: 6px; z-index: 2147483000; pointer-events: none; white-space: nowrap; }
    `;
  function injectPageStyles() {
    if (document.getElementById("pn-page-style")) return;
    const st = document.createElement("style");
    st.id = "pn-page-style";
    st.textContent = PN_PAGE_CSS;
    (document.head || document.documentElement).appendChild(st);
  }
  // Shadow-DOM UIs need the highlight rules injected into their shadow root, or .pn-current /
  // .pn-flash won't render on shadow-nested prompts.
  const _pnStyledRoots = new WeakSet();
  function ensureStylesIn(node) {
    const root = node && node.getRootNode ? node.getRootNode() : null;
    if (!root || root === document || root.nodeType === 9) return;
    if (_pnStyledRoots.has(root)) return;
    _pnStyledRoots.add(root);
    const st = document.createElement("style");
    st.textContent = PN_PAGE_CSS;
    try { root.appendChild(st); } catch (_) {}
  }
  function navigateTo(i) {
    S.currentIndex = Math.max(0, Math.min(S.steps.length - 1, i));
    const step = S.steps[S.currentIndex];
    if (step.type === "card") { showCard(step); renderPanel(); return; }
    const t = S.turns[step.turnIndex];
    if (t) {
      const virtualized = !!(S.rowSelector || (S.profile && S.profile.rowSelector));
      if (t.promptEl && t.promptEl.isConnected) {
        markCurrent(t.promptEl);
        t.promptEl.scrollIntoView({ behavior: "smooth", block: "start" });
        if (!virtualized && S.mode === "navigate") spotlight(step);
        flash(t.promptEl);
      } else {
        scrollToTurn(t);
      }
    }
    renderPanel();
  }
  // Scroll a virtualized grid back to a collected prompt (its DOM node was recycled), then flash it.
  async function scrollToTurn(t) {
    const scroller = getScrollParent(S.container || document.body);
    const rowSel = S.rowSelector || (S.profile && S.profile.rowSelector) || '[role="row"]';
    const scope = S.container || document;
    const needle = (t.promptText || "").slice(0, 30);
    const find = () => Array.from(scope.querySelectorAll(rowSel)).find((r) =>
      (t.key && r.getAttribute && r.getAttribute("data-key") === t.key) ||
      (needle && (r.innerText || "").replace(/\s+/g, " ").trim().startsWith(needle)));
    let el = find();
    if (!el && scroller) {
      const H = scroller.clientHeight || 600;
      // hint-jump near the recorded position, then search-scroll the whole list (react-aria virtualizer)
      if (t.scrollPos != null) { scroller.scrollTop = Math.max(0, t.scrollPos - H / 2); await new Promise((r) => setTimeout(r, 180)); el = find(); }
      for (let y = 0; !el && y <= scroller.scrollHeight + H; y += Math.round(H * 0.6)) {
        scroller.scrollTop = y; await new Promise((r) => setTimeout(r, 90)); el = find();
      }
    }
    if (el) { markCurrent(el); el.scrollIntoView({ behavior: "smooth", block: "start" }); t.promptEl = el; flash(el); }
  }
  function resetPrompts() {
    showAll();
    S.steps = []; S.turns = []; S.currentIndex = 0; S._scrollMeta = null;
    renderPanel();
    toast("Cleared all prompts");
  }


  // ---------------------------------------------------------------- cards
  function showCard(step) {
    const back = shadow.getElementById("pn-card-back");
    const box = shadow.getElementById("pn-card-box");
    box.innerHTML = sanitizeHTML(step.html || "<em>(empty card)</em>");
    back.classList.add("show");
  }
  function hideCard() { shadow.getElementById("pn-card-back").classList.remove("show"); }

  // ---------------------------------------------------------------- generator
  function buildCardPrompt(template, ctxPrompt, ctxResponse) {
    return (
`You are generating ONE self-contained HTML "insight card" for a live demo overlay.

PURPOSE: ${template.purpose}

SOURCE CONTEXT (the agent exchange this card summarizes):
--- USER PROMPT ---
${(ctxPrompt || "").slice(0, 1500)}
--- AGENT RESPONSE (trimmed) ---
${(ctxResponse || "").slice(0, 2500)}

CARD REQUIREMENTS (STRICT):
- Output ONLY one HTML fragment. No markdown fences, no commentary.
- Static HTML + inline CSS only. SVG allowed for diagrams. NO <script>, NO external URLs/fonts/images (data: URIs OK).
- Must render correctly inside a Shadow DOM with no external stylesheet.
- Fit a centered card up to 900x600px; large, high-contrast, Zoom-legible type.
- ${template.purpose_shape}.
- Neutral modern styling (system font stack), rounded card, generous padding.

Return the HTML now.`);
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (_) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
        return true;
      } catch (e) { return false; }
    }
  }

  // ================================================================ UI
  const host = document.createElement("div");
  host.id = "pn-host";
  host.style.cssText = "all:initial;";
  const shadow = host.attachShadow({ mode: "open" });
  document.documentElement.appendChild(host);
  host.style.display = "none"; // hidden until enabled (toolbar click, or auto in standalone)
  injectPageStyles();
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: system-ui, -apple-system, Segoe UI, sans-serif; }
      #panel { position: fixed; top: 16px; left: 16px; width: 320px; height: 560px;
        min-width: 220px; min-height: 160px; max-width: 96vw; max-height: calc(100vh - 24px);
        background: #11162a; color: #e7ebf5; z-index: 2147483600; display: flex; flex-direction: column;
        border: 1px solid #2a3252; border-radius: 12px; overflow: hidden; resize: both; box-shadow: 0 14px 44px rgba(0,0,0,.5); }
      #panel header { cursor: move; user-select: none; }
      #panel.min { top: auto; left: auto; right: 16px; bottom: 16px; width: 56px; height: 56px;
        min-width: 0; min-height: 0; max-width: none; border: none; border-radius: 50%; resize: none;
        overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,.5); }
      .pn-icon { width: 100%; height: 100%; border: none; background: #4457d6; color: #fff; font-size: 26px;
        cursor: pointer; display: grid; place-items: center; padding: 0; }
      .pn-icon:hover { background: #5566e8; }
      header { padding: 12px 14px; border-bottom: 1px solid #2a3252; }
      .row { display: flex; align-items: center; gap: 8px; }
      .brand { font-weight: 700; font-size: 14px; }
      .badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; background: #2a3252; font-weight: 600; }
      .badge.known { background: #1f7a4d; color: #eafff2; }
      .badge.unknown { background: #5a2140; color: #ffd9e6; }
      #list { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 6px; }
      .item { display: flex; gap: 8px; align-items: flex-start; padding: 8px; border-radius: 8px; cursor: pointer; }
      .item:hover { background: #1a2140; }
      .item.active { background: #223066; outline: 1px solid #4457d6; }
      .num { min-width: 22px; height: 22px; border-radius: 11px; background: #2a3252; display: grid; place-items: center; font-size: 12px; }
      .item.card .num { background: #6b4bd6; }
      .lbl { flex: 1; font-size: 13px; line-height: 1.35; }
      .lbl input { width: 100%; background: #0c1024; color: #e7ebf5; border: 1px solid #2a3252; }
      .meta { font-size: 11px; color: #97a0c4; margin-top: 2px; }
      .mini { font-size: 11px; padding: 2px 6px; border-radius: 5px; border: 1px solid #2a3252; background: #1a2140; color: #cfd6ee; cursor: pointer; }
      footer { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px; border-top: 1px solid #2a3252; }
      footer button { flex: 1 0 30%; padding: 7px 4px; font-size: 11px; border: 1px solid #2a3252; background: #151b34; color: #cfd6ee; border-radius: 6px; cursor: pointer; }
      .pos { font-size: 12px; color: #97a0c4; }
      .hbtn { background: none; border: none; color: #9aa4c8; cursor: pointer; font-size: 15px; line-height: 1; padding: 0 2px; }
      .dbg { font: 11px/1.45 ui-monospace, SFMono-Regular, monospace; color: #9aa4c8; padding: 6px 8px; border-top: 1px solid #2a3252; background: #0c1024; white-space: pre-wrap; max-height: 140px; overflow: auto; }
      .dbg b { color: #cfe0ff; }
      /* card overlay */
      #pn-card-back { position: fixed; inset: 0; background: rgba(6,9,20,.72); display: none; place-items: center; z-index: 2147483700; }
      #pn-card-back.show { display: grid; }
      #pn-card-box { max-width: 900px; max-height: 80vh; overflow: auto; background: #fff; color: #111; border-radius: 16px; padding: 8px; box-shadow: 0 20px 60px rgba(0,0,0,.5); animation: pop .18s ease-out; }
      @keyframes pop { from { transform: scale(.94); opacity: 0 } to { transform: scale(1); opacity: 1 } }
      /* modal */
      #pn-modal-back { position: fixed; inset: 0; background: rgba(6,9,20,.6); display: none; place-items: center; z-index: 2147483710; }
      #pn-modal-back.show { display: grid; }
      #pn-modal { width: 640px; max-width: 92vw; max-height: 84vh; overflow: auto; background: #151b34; color: #e7ebf5; border-radius: 12px; padding: 18px; }
      #pn-modal h3 { margin: 0 0 12px; }
      #pn-modal textarea { width: 100%; min-height: 120px; background: #0c1024; color: #e7ebf5; border: 1px solid #2a3252; border-radius: 8px; padding: 8px; font-family: ui-monospace, monospace; font-size: 12px; }
      #pn-modal input, #pn-modal select { background: #0c1024; color: #e7ebf5; border: 1px solid #2a3252; border-radius: 6px; padding: 6px; }
      #pn-modal .actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
      #pn-modal button { padding: 7px 12px; border-radius: 6px; border: 1px solid #2a3252; background: #1a2140; color: #cfd6ee; cursor: pointer; }
      #pn-modal button.primary { background: #4457d6; color: #fff; border-color: #4457d6; }
      .picker-row { display: flex; gap: 8px; align-items: center; padding: 8px; border: 1px solid #2a3252; border-radius: 8px; margin-bottom: 6px; }
      .picker-row .grow { flex: 1; }
      #pn-toast { position: fixed; bottom: 20px; right: 20px; background: #223066; color: #fff; padding: 8px 14px; border-radius: 8px; z-index: 2147483720; opacity: 0; transition: opacity .2s; }
      #pn-toast.show { opacity: 1; }
    </style>
    <div id="panel"></div>
    <div id="pn-card-back"><div id="pn-card-box"></div></div>
    <div id="pn-modal-back"><div id="pn-modal"></div></div>
    <div id="pn-toast"></div>
  `;

  const panel = shadow.getElementById("panel");
  (function setupDrag() {
    let sx, sy, ox, oy, drag = false;
    panel.addEventListener("mousedown", (e) => {
      const h = e.target.closest("header");
      if (!h || e.target.closest("button,select,input,textarea")) return;
      drag = true; const r = panel.getBoundingClientRect(); ox = r.left; oy = r.top; sx = e.clientX; sy = e.clientY;
      panel.style.left = ox + "px"; panel.style.top = oy + "px"; panel.style.right = "auto"; e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!drag) return;
      let nl = ox + (e.clientX - sx), nt = oy + (e.clientY - sy);
      nl = Math.max(0, Math.min(window.innerWidth - 60, nl));
      nt = Math.max(0, Math.min(window.innerHeight - 30, nt));
      panel.style.left = nl + "px"; panel.style.top = nt + "px";
    });
    window.addEventListener("mouseup", () => { drag = false; });
  })();
  shadow.getElementById("pn-card-back").onclick = () => hideCard();

  function modal(html) {
    const back = shadow.getElementById("pn-modal-back");
    shadow.getElementById("pn-modal").innerHTML = html;
    back.classList.add("show");
    return shadow.getElementById("pn-modal");
  }
  function closeModal() { shadow.getElementById("pn-modal-back").classList.remove("show"); }

  function renderPanel() {
    if (S._min) {
      panel.classList.add("min");
      panel.innerHTML = `<button class="pn-icon" data-a="min" title="Open AgentDemo (${S.steps.length} steps)">🎬</button>`;
      panel.querySelector('[data-a="min"]').onclick = () => action("min");
      return;
    }
    panel.classList.remove("min");
    const g = S.global;
    const _prevListTop = (shadow.getElementById("list") || {}).scrollTop || 0;
    panel.innerHTML = `
      <header>
        <div class="row">
          <span class="brand">🎬 AgentDemo</span>
          <span class="badge ${S.profile && S.profile.id !== "unknown" ? "known" : "unknown"}" data-a="profile" title="Click to force UI profile" style="cursor:pointer">${S.profile ? (S.profile.id === "unknown" ? "no UI match" : "UI: " + S.profile.id) : "…"}${S.forced ? " 🔒" : ""}</span>
          <span class="pos" style="margin-left:auto">${S.steps.length ? (S.currentIndex + 1) + " / " + S.steps.length : "0"}</span>
          <button class="hbtn" data-a="min" title="Minimize / expand">${S._min ? "▢" : "⚊"}</button>
          <button class="hbtn" data-a="close" title="Close toolbar">✕</button>
        </div>
      </header>
      <div id="list"></div>
      ${S.showDebug && S.debug ? debugHTML(S.debug) : ""}
      <footer>
        <button data-a="analyze">🔍 Analyze</button>
        <button data-a="settings" title="Settings">⚙ Settings</button>
        <button data-a="debug" title="Toggle debug info">🐞 Debug</button>
        <button data-a="reset" title="Clear all prompts">🧹 Reset</button>
      </footer>
    `;
    const list = shadow.getElementById("list");
    S.steps.forEach((s, i) => {
      const el = document.createElement("div");
      el.className = "item" + (s.type === "card" ? " card" : "") + (i === S.currentIndex ? " active" : "");
      el.innerHTML = `<div class="num">${i + 1}</div>
        <div class="lbl">${escapeHtml(promptLabel(s))}
          ${s.note ? `<div class="meta">📝 ${escapeHtml(s.note)}</div>` : ""}
        </div>
        <button class="mini" data-edit="${i}" title="Edit">✎</button>
        <button class="mini" data-del="${i}" title="Delete">🗑</button>`;
      el.querySelector(".num").onclick = () => navigateTo(i);
      el.querySelector(".lbl").onclick = () => navigateTo(i);
      el.querySelector("[data-edit]").onclick = (e) => { e.stopPropagation(); editStep(i); };
      el.querySelector("[data-del]").onclick = (e) => { e.stopPropagation(); deleteStep(i); };
      list.appendChild(el);
    });
    panel.querySelectorAll("[data-a]").forEach((b) => (b.onclick = () => action(b.dataset.a)));
    panel.classList.toggle("min", !!S._min);
    { const _nl = shadow.getElementById("list"); if (_nl) { _nl.scrollTop = _prevListTop; const _a = _nl.querySelector(".item.active"); if (_a) { const lr = _nl.getBoundingClientRect(), ar = _a.getBoundingClientRect(); if (ar.top < lr.top) _nl.scrollTop -= (lr.top - ar.top) + 8; else if (ar.bottom > lr.bottom) _nl.scrollTop += (ar.bottom - lr.bottom) + 8; } } }
  }

  function escapeHtml(s) { return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }


  function action(a) {
    switch (a) {
      case "addcard": addCard(); break;
      case "export": openExport(); break;
      case "import": openImport(); break;
      case "save": save(); break;
      case "settings": openSettings(); break;
      case "min": toggleMin(); break;
      case "analyze": analyzeSession(); break;
      case "profile": openProfileMenu(); break;
      case "debug": S.showDebug = !S.showDebug; if (S.showDebug) setDebug("debug"); renderPanel(); break;
      case "reset": resetPrompts(); break;
      case "close": host.style.display = "none"; break;
    }
  }
  // Toggle minimized icon (bottom-right) ↔ full panel (centered on screen).
  function toggleMin() {
    S._min = !S._min;
    // Reset inline position AND size (resize:both leaves inline w/h that would bloat the icon),
    // so each state falls back to its CSS size: 56px icon vs. 320×560 panel.
    panel.style.left = panel.style.top = panel.style.right = panel.style.bottom = "";
    panel.style.width = panel.style.height = "";
    renderPanel();
    if (!S._min) {
      const r = panel.getBoundingClientRect();
      panel.style.left = Math.max(8, (window.innerWidth - r.width) / 2) + "px";
      panel.style.top = Math.max(8, (window.innerHeight - r.height) / 2) + "px";
    }
  }
  function openSettings() {
    const g = S.global;
    const m = modal(`
      <h3>Settings</h3>
      <label>Selected-prompt label<br><input id="s-label" style="width:260px" value="${escapeHtml(g.promptLabel || "Your Prompt")}"></label>
      <div class="actions"><button data-x="cancel">Cancel</button><button class="primary" data-x="ok">Save</button></div>`);
    m.querySelector('[data-x="cancel"]').onclick = closeModal;
    m.querySelector('[data-x="ok"]').onclick = async () => {
      g.promptLabel = m.querySelector("#s-label").value.trim() || "Your Prompt";
      try { await store.set("pn:global", g); } catch (_) {}
      if (_pnCurrentEl) _pnCurrentEl.setAttribute("data-pn-label", g.promptLabel);
      closeModal(); toast("Settings saved");
    };
  }

  // ---- actions impl
  function deleteStep(i) {
    if (i < 0 || i >= S.steps.length) return;
    S.steps.splice(i, 1);
    if (S.currentIndex >= S.steps.length) S.currentIndex = Math.max(0, S.steps.length - 1);
    renderPanel();
  }
  function guessUserSelector() {
    if (S.userSelector) return S.userSelector;
    if (S.profile.userPrompt) return S.profile.userPrompt;
    const CAND = ['[data-role="user"]', '[data-message-author-role="user"]', '[data-author="user"]',
      '[data-testid*="user"]', '.user-message', '.message.user', '.chat-message--user'];
    let best = null;
    for (const c of CAND) {
      let els; try { els = Array.from(document.querySelectorAll(c)).filter((e) => (e.innerText || "").trim().length > 1); } catch (_) { continue; }
      if (els.length && (!best || els.length > best.count)) best = { sel: c, count: els.length };
    }
    return best ? best.sel : null;
  }
  function commonAncestor(nodes) {
    if (!nodes.length) return null;
    let a = nodes[0];
    for (const n of nodes) { while (a && !a.contains(n)) a = a.parentElement; }
    return a;
  }
  function getScrollParent(el) {
    let n = el;
    while (n && n !== document.body) {
      const s = getComputedStyle(n);
      if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 4) return n;
      n = n.parentElement || (n.getRootNode && n.getRootNode() instanceof ShadowRoot ? n.getRootNode().host : null);
    }
    return document.scrollingElement || document.documentElement;
  }
  // Sweep a virtualized list, collecting every user row (deduped by data-key) as it renders.
  async function scrollCollectTurns(container, userMatch, rowSelector) {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const scroller = getScrollParent(container) || container;
    const rowSel = rowSelector || '[role="row"]';
    const seen = new Map();
    const keyOf = (r) => (r.getAttribute && (r.getAttribute("data-key") || r.id)) || ("t:" + (r.innerText || "").slice(0, 40));
    const scan = () => {
      Array.from((container || document).querySelectorAll(rowSel)).forEach((r) => {
        if (!userMatch(r)) return;
        const k = keyOf(r);
        if (!seen.has(k)) seen.set(k, { role: "user", promptEl: r, promptHtml: r.outerHTML, promptText: (r.innerText || "").replace(/\s+/g, " ").trim(), responseEls: [], key: k, scrollPos: r.getBoundingClientRect().top + scroller.scrollTop });
      });
    };
    const prev = scroller.scrollTop, H = scroller.clientHeight || 600;
    let passes = 0;
    scroller.scrollTop = 0; await wait(150); scan(); passes++;
    for (let t = 0; t <= scroller.scrollHeight + H; t += Math.round(H * 0.6)) { scroller.scrollTop = t; await wait(140); scan(); passes++; }
    scroller.scrollTop = prev; await wait(60); scan();
    S._scrollMeta = { passes, scrollH: scroller.scrollHeight, clientH: scroller.clientHeight, virtualized: scroller.scrollHeight > scroller.clientHeight + 50 };
    const turns = Array.from(seen.values()).sort((a, b) => a.scrollPos - b.scrollPos);
    return turns;
  }
  function describeEl(el) {
    if (!el) return "null";
    if (el === document.body) return "body";
    if (el.id) return "#" + el.id;
    const al = el.getAttribute && el.getAttribute("aria-label");
    if (al) return `[aria-label="${al.slice(0, 24)}"]`;
    return el.tagName ? el.tagName.toLowerCase() : String(el);
  }
  function countRows() {
    const prof = S.profile || {};
    const rowSel = S.rowSelector || prof.rowSelector;
    const scope = S.container || document.body;
    try { return rowSel ? scope.querySelectorAll(rowSel).length : (S.container ? S.container.children.length : 0); } catch (_) { return 0; }
  }
  function setDebug(action) {
    const prof = S.profile || {};
    const mode = S.userMatch ? "visual (tinted bubble)" : (S.userSelector ? "css" : (prof.userMatch ? "visual (profile)" : "none"));
    S.debug = {
      action, at: new Date().toLocaleTimeString(),
      profile: prof.id || "unknown", mode,
      selector: S.userSelector || (S.userMatch ? "(predicate)" : "-"),
      rowSelector: S.rowSelector || prof.rowSelector || "(children)",
      container: describeEl(S.container),
      rowsInView: countRows(), prompts: S.turns.length, scroll: S._scrollMeta,
    };
  }
  function debugHTML(d) {
    if (!d) return "";
    const s = d.scroll ? `\nscroll: <b>${d.scroll.passes}</b> passes · ${d.scroll.scrollH}/${d.scroll.clientH}px${d.scroll.virtualized ? " · <b>virtualized</b>" : ""}` : "";
    return `<div class="dbg">🐞 <b>${d.action}</b> @ ${d.at}
profile: <b>${escapeHtml(d.profile)}</b>  ·  mode: <b>${escapeHtml(d.mode)}</b>
selector: ${escapeHtml(String(d.selector))}
rowSel: ${escapeHtml(String(d.rowSelector))}  ·  container: ${escapeHtml(String(d.container))}
rows in view: <b>${d.rowsInView}</b>  ·  prompts: <b>${d.prompts}</b>${s}</div>`;
  }
  // Analyze an existing session: discover + capture every user prompt, show a summary.
  async function analyzeSession() {
    ensureProfile();
    const prof = S.profile || {};
    let sel = null, container = null;
    const userMatch = S.userMatch || prof.userMatch;
    if (userMatch) {
      container = getContainer(prof) || document.body;
      S.container = container; S.userSelector = null;
      toast("Analyzing… scrolling the session");
      S.turns = await scrollCollectTurns(container, userMatch, S.rowSelector || prof.rowSelector);
      sel = "(visual: user bubble)";
    } else {
      sel = guessUserSelector();
      if (!sel) { toast("No user prompts found on this page"); return; }
      const users = Array.from(document.querySelectorAll(sel)).filter((e) => (e.innerText || "").trim());
      container = S.container || getContainer(prof) || commonAncestor(users) || document.body;
      S.userSelector = sel; S.container = container;
      S.turns = captureTurns(container, sel);
      S._scrollMeta = null;
    }
    if (!S.turns.length) { toast("No user prompts found — use 🎯 Pick"); return; }
    buildStepsFromTurns(); S.currentIndex = 0; S._min = false;
    let agent = 0, tools = 0, chars = 0;
    S.turns.forEach((t) => {
      agent += t.responseEls.length ? 1 : 0;
      t.responseEls.forEach((e) => { tools += e.querySelectorAll('[data-tool],[class*="tool"]').length; chars += (e.innerText || "").length; });
    });
    setDebug("analyze");
    renderPanel();
    const rows = S.turns.map((t, i) => `<div class="picker-row"><div class="num">${i + 1}</div><div class="grow">${escapeHtml((t.promptText || "").replace(/\s+/g, " ").slice(0, 140))}</div></div>`).join("") || "<p>No prompts found.</p>";
    const m = modal(`<h3>Session analysis</h3>
      <p style="color:#9aa4c8;font-size:13px">Selector <code>${escapeHtml(sel)}</code> · <b>${S.turns.length}</b> user prompts${agent ? ` · ${agent} agent turns · ${tools} tool calls · ${chars.toLocaleString()} chars` : ` · full session (auto-scrolled)`}</p>
      ${rows}
      <div class="actions"><button data-x="copy">Copy prompts</button><button class="primary" data-x="ok">Done</button></div>`);
    m.querySelector('[data-x="ok"]').onclick = closeModal;
    m.querySelector('[data-x="copy"]').onclick = async () => {
      const ok = await copyText(S.turns.map((t, i) => `${i + 1}. ${t.promptText}`).join("\n"));
      toast(ok ? "Prompts copied" : "Copy failed");
    };
  }
  function addCard() {
    const step = { type: "card", id: "c" + Date.now(), title: "New card", html: "<div style='padding:40px;font:600 28px system-ui'>New card</div>", note: "" };
    S.steps.splice(S.currentIndex + 1, 0, step);
    renderPanel();
    editCard(S.steps.indexOf(step));
  }
  function editStep(i) {
    const s = S.steps[i];
    if (s.type === "card") return editCard(i);
    const m = modal(`
      <h3>Edit prompt step</h3>
      <label>Label<br><input id="e-label" style="width:100%" value="${escapeHtml(s.label || promptLabel(s))}"></label><br><br>
      <label>Presenter note<br><textarea id="e-note">${escapeHtml(s.note || "")}</textarea></label><br><br>
      <div class="actions"><button data-x="cancel">Cancel</button><button class="primary" data-x="ok">Save</button></div>`);
    m.querySelector('[data-x="cancel"]').onclick = closeModal;
    m.querySelector('[data-x="ok"]').onclick = () => {
      s.label = m.querySelector("#e-label").value.trim() || null;
      s.note = m.querySelector("#e-note").value.trim();
      closeModal(); renderPanel();
    };
  }
  function editCard(i) {
    const s = S.steps[i];
    const m = modal(`
      <h3>Edit card</h3>
      <div class="row" style="gap:8px">
        <input id="c-title" placeholder="title" value="${escapeHtml(s.title || "")}">
        <select id="c-tpl">${S.templates.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("")}</select>
        <button class="primary" data-x="gen">Generate prompt → clipboard</button>
      </div><br>
      <label>Card HTML<br><textarea id="c-html" style="min-height:160px">${escapeHtml(s.html || "")}</textarea></label><br><br>
      <label>Paste Claude's HTML here (paste-back)<br><textarea id="c-paste" placeholder="paste generated HTML"></textarea></label><br>
      <label>Presenter note<br><textarea id="c-note">${escapeHtml(s.note || "")}</textarea></label>
      <div class="actions"><button data-x="cancel">Cancel</button><button data-x="preview">Preview</button><button class="primary" data-x="ok">Save</button></div>`);
    m.querySelector('[data-x="cancel"]').onclick = closeModal;
    m.querySelector('[data-x="preview"]').onclick = () => showCard({ html: m.querySelector("#c-html").value });
    m.querySelector('[data-x="gen"]').onclick = async () => {
      const tpl = S.templates.find((t) => t.id === m.querySelector("#c-tpl").value) || S.templates[0];
      const near = nearestPromptContext(i);
      const prompt = buildCardPrompt(tpl, near.prompt, near.response);
      const ok = await copyText(prompt);
      toast(ok ? "Prompt copied — paste into Claude" : "Copy failed — showing prompt");
      m.querySelector("#c-paste").value = ok ? m.querySelector("#c-paste").value : prompt;
      if (!ok) m.querySelector("#c-paste").placeholder = "(clipboard blocked) prompt shown above";
    };
    m.querySelector('[data-x="ok"]').onclick = () => {
      const pasted = m.querySelector("#c-paste").value.trim();
      s.html = sanitizeHTML(pasted || m.querySelector("#c-html").value);
      s.title = m.querySelector("#c-title").value.trim() || "Card";
      s.note = m.querySelector("#c-note").value.trim();
      closeModal(); renderPanel();
    };
  }
  function nearestPromptContext(stepIndex) {
    for (let i = stepIndex; i >= 0; i--) {
      const s = S.steps[i];
      if (s && s.type === "prompt") {
        const t = S.turns[s.turnIndex];
        return { prompt: t ? t.promptText : "", response: t ? t.responseEls.map((e) => e.innerText).join("\n\n") : "" };
      }
    }
    return { prompt: "", response: "" };
  }

  function openExport() {
    const m = modal(`
      <h3>Export configuration</h3>
      <label><input type="checkbox" id="x-logs"> Include full conversation logs (portable bundle)</label><br><br>
      <div class="actions">
        <button data-x="cancel">Cancel</button>
        <button data-x="md">Export .md</button>
        <button class="primary" data-x="json">Export .json</button>
      </div>`);
    m.querySelector('[data-x="cancel"]').onclick = closeModal;
    m.querySelector('[data-x="json"]').onclick = () => { exportJSON(m.querySelector("#x-logs").checked); closeModal(); };
    m.querySelector('[data-x="md"]').onclick = () => { exportMD(m.querySelector("#x-logs").checked); closeModal(); };
  }
  function openImport() {
    const m = modal(`
      <h3>Import configuration</h3>
      <input type="file" id="i-file" accept=".json,.md,application/json,text/markdown"><br><br>
      <label><input type="radio" name="imode" value="merge" checked> Merge into current</label>
      <label style="margin-left:12px"><input type="radio" name="imode" value="replace"> Replace all</label>
      <div class="actions"><button data-x="cancel">Cancel</button><button class="primary" data-x="ok">Import</button></div>`);
    m.querySelector('[data-x="cancel"]').onclick = closeModal;
    m.querySelector('[data-x="ok"]').onclick = async () => {
      const f = m.querySelector("#i-file").files[0];
      if (!f) { toast("Choose a file"); return; }
      const mode = m.querySelector('input[name="imode"]:checked').value;
      try { await importFile(f, mode); closeModal(); } catch (e) { toast("Import failed: " + e.message); }
    };
  }

  // ---------------------------------------------------------------- hotkeys
  document.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) || "";
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable)) return;
    if (host.contains(e.target)) {}
    if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.altKey && e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if ((e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key)) { e.preventDefault(); jump(+e.key - 1); }
    else if (e.key === "Escape") { if (shadow.getElementById("pn-card-back").classList.contains("show")) hideCard(); }
    else if (e.key === "f" || e.key === "F") { const s = S.steps[S.currentIndex]; if (s && s.type === "prompt") spotlight(s); }
  }, false);
  function move(d) { const i = S.currentIndex + d; if (i < 0 || i >= S.steps.length) return; navigateTo(i); }
  function jump(i) { if (i < 0 || i >= S.steps.length) return; navigateTo(i); }

  // ---------------------------------------------------------------- boot
  // The coworker chat lives in a same-origin child iframe, so the extension mounts in BOTH the top
  // frame and the iframe. Keep a single toolbar: the frame that owns a known UI wins; the top frame
  // hides itself when a child owns the UI, and unknown child frames stay hidden.
  function docHasKnownUI(doc) {
    try {
      return !!doc.querySelector('[data-testid="chatlog-virtual-list-container"],[data-testid="episode-list-wrapper"],[data-testid="chat-page"],[aria-label="Chat messages"],[data-pn-ui="mock"]');
    } catch (_) { return false; }
  }
  function anyChildFrameHasUI() {
    for (const f of document.querySelectorAll("iframe")) {
      let d; try { d = f.contentDocument; } catch (_) { continue; }
      if (d && docHasKnownUI(d)) return true;
    }
    return false;
  }
  // Show/hide this frame's toolbar per the single-toolbar policy. Returns true when settled.
  function applyFrameVisibility() {
    if (!pnEnabled) { host.style.display = "none"; return false; }
    const isTop = (() => { try { return window.top === window.self; } catch (_) { return true; } })();
    const known = S.profile && S.profile.id !== "unknown";
    if (known) {
      host.style.display = "";
      if (!isTop) { try { const th = window.top.document.getElementById("pn-host"); if (th) th.style.display = "none"; } catch (_) {} }
      return true;
    }
    if (!isTop) { host.style.display = "none"; return false; } // unknown child: quiet, keep polling
    const childOwns = anyChildFrameHasUI();
    host.style.display = childOwns ? "none" : "";
    return childOwns;
  }
  async function boot() {
    S.forced = (await store.get("pn:forced:" + location.host)) || null;
    S.profile = resolveProfile();
    S.convKey = S.profile.id + "::" + convIdFromUrl();
    S.userSelector = S.profile.userPrompt;
    S.container = getContainer(S.profile);
    await loadGlobals();
    S.mode = S.global.defaultMode;
    // auto-capture if selector known
    if (S.userMatch || S.profile.userMatch) {
      S.container = getContainer(S.profile);
      S.turns = captureTurns(S.container, null);
      buildStepsFromTurns();
    } else if (S.userSelector && (S.container || document.querySelector(S.userSelector))) {
      S.turns = captureTurns(S.container, S.userSelector);
      buildStepsFromTurns();
    }
    // restore saved conv metadata/cards
    await loadConv(S.convKey);
    renderPanel();
    applyFrameVisibility();
    if (S.profile.id === "unknown") {
      let tries = 0;
      const iv = setInterval(() => {
        tries++;
        ensureProfile();
        if (applyFrameVisibility() || tries > 40) clearInterval(iv);
      }, 700);
    }
    window.__PN = { S, store, deriveSelector, captureTurns, buildCardPrompt, buildBundle, parseBundle, serializeConv, save, importFile }; // test hook
  }
  if (IS_EXTENSION) {
    try { chrome.runtime.onMessage.addListener((msg) => { if (msg && msg.type === "pn-toggle") setEnabled(!pnEnabled); }); } catch (_) {}
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setEnabled(true));
  } else {
    setEnabled(true);
  }
})();
