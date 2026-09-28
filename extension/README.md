# AgentDemo — Prompt Navigator

A Chrome (MV3) extension that turns an already-executed LLM conversation into a clean,
presenter-driven demo: **navigate** to any prompt with no latency and no scrolling — ideal for
solution consultants who need agentic-AI demos that highlight *value* instead of scrolling through a
long chat.

## Install (unpacked)
1. `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select this `extension/` folder.
3. Pin **AgentDemo** from the toolbar puzzle-piece menu (optional, for one-click access).

## Activate on a page
AgentDemo is **dormant until you click its toolbar button** — it never injects UI on its own.

- **Click the toolbar button** → a floating **🎬 icon** appears in the bottom-right corner.
- **Click the 🎬 icon** → the panel opens **centered on screen**.
- **Minimize** (⚊ in the panel header) → collapses back to the icon.
- **Click the toolbar button again** → hides AgentDemo entirely on that tab (click once more to bring
  it back).
- **✕** in the header closes the toolbar for the session (toggle the toolbar button to reopen).

Drag the panel header to reposition it; drag the bottom-right corner to resize.

The header badge shows the **detected UI** (`UI: coworker` / `UI: workspace` / `UI: aemcoder`, green;
`no UI match`, red). **Click the badge to force a profile** (Auto / coworker / workspace / aemcoder /
mock) if auto-detect is wrong — the choice is saved per host and shown with a 🔒.

## Use it
The panel footer has four controls:

- **🔍 Analyze** — scans the current page, auto-discovers **every user prompt** (auto-scrolling
  virtualized/long chats), and lists them as ordered steps with a summary (prompt count, agent turns,
  tool calls, char count). This is the one action that builds your demo steps.
- **⚙ Settings** — set the label shown on the highlighted prompt (the box that reads **"Your Prompt"**
  by default). Saved to `chrome.storage`.
- **🐞 Debug** — toggles a diagnostic box (detected profile, detection mode, selector/predicate,
  container, rows in view, prompts found, scroll passes / virtualized flag). Populated after Analyze.
- **🧹 Reset** — clears all captured prompts.

Per step: **✎** edit label/note, **🗑** delete.

### Navigate
Click any step (or use hotkeys) to jump to that prompt: the page smooth-scrolls and the prompt is
aligned to the top with a **highlight box** (label configurable in Settings). On virtualized grids
(aemcoder) clicking a prompt **search-scrolls the chat back** to the recycled row and flashes it.

**Hotkeys:** `Alt+↑/↓` prev/next · `Cmd/Ctrl+1..9` jump · `f` spotlight · `Esc` dismiss card.

## UI auto-detection
The extension auto-detects the host UI and applies the right prompt selector:

- **coworker** (`experience.adobe.com`) — chat runs inside a same-origin iframe as a **virtualized
  list** (`[data-testid="chatlog-virtual-list-container"]`, episodes = `[data-index]`). It has **no**
  `data-role` marker; a USER episode is one with text but none of the agent-only affordances (the
  `Coworker actions` toolbar, `chain segment` widgets, or per-message Copy/feedback controls), so
  detection uses that predicate and auto-scrolls to collect every prompt. Because the chat is in an
  iframe, AgentDemo runs in both frames but shows a **single toolbar** in the frame that owns the chat.
- **workspace** (Experience Workspace, `da.live/canvas`) — the left chat panel lives inside a web
  component's **shadow DOM** (`nx-chat-ao` → `.chat-messages-container[role=log]`). Messages are
  cleanly classed: user = `.message-user`, agent = `.message-assistant`. Detection/capture pierce
  shadow roots (`deepQuery`) and the highlight styles are injected into the shadow root so the prompt
  highlight box renders there too.
- **aemcoder** (`aemcoder.adobe.io`) — chat is a React-Aria **grid** (`[aria-label="Chat messages"]`
  → `role="row"`) in the main frame. It emits **no** `data-role`/class/aria sender marker — user vs.
  assistant differ **only** by the user bubble's background color — so aemcoder is detected with a
  **visual predicate** (tinted-bubble test: the row whose bubble has a saturated, non-grey
  background), hue/theme-agnostic — not a CSS selector.
- **mock** (`demo/mock-agent-ui.html`) — the bundled offline test page (`[data-role="user"]`).
- Anything else — reports `no UI match`; force a profile from the badge if needed.

### Add a new UI profile
Add an entry to `pn.js` → `PROFILES` with `{ id, test, container, rowSelector?, userMatch?,
userPrompt? }`. `test()` runs in the page (use `deepQuery(sel)` to reach shadow DOM); `container`
resolves through shadow roots automatically via `getContainer`.

## Notes
- aemcoder's grid is **virtualized** (only ~15 rows in the DOM at once), so Analyze auto-scrolls the
  whole conversation to collect every prompt (deduped by `data-key`); capture is **prompt-only**.
- `window.__PN` is exposed as a debug/support hook.

See `../notes/demo-methodology-brainstorm.md` for the full design rationale.
