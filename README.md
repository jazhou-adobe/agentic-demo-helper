# AgentDemo

A Chrome extension (Manifest V3) that turns an already-executed LLM conversation into a clean,
**presenter-driven demo**. Instead of scrolling through a long agentic chat live (with all its
latency), a solution consultant runs the conversation once, then uses AgentDemo to **jump between
prompts** with a highlight box — no waiting, no scrolling, focus on the value.

It auto-detects several Adobe agent UIs and reads the prompts directly from the page, so there's
nothing to copy/paste.

## Repository layout

| Path | What it is |
| --- | --- |
| `extension/` | The Chrome extension (load this folder unpacked). |
| `extension/manifest.json` | MV3 manifest (toolbar action + background worker + content script). |
| `extension/pn.js` | The entire extension logic (single-file content script). |
| `extension/bg.js` | Background service worker — toggles the UI when the toolbar button is clicked. |
| `extension/README.md` | Full feature docs (activation, controls, UI detection). |
| `demo/mock-agent-ui.html` | Offline mock chat UI for testing without any Adobe login. |
| `notes/demo-methodology-brainstorm.md` | Design rationale and methodology. |

## Install the extension

1. Clone or download this repo.
2. Open **`chrome://extensions`** in Chrome (or any Chromium browser).
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the **`extension/`** folder in this repo.
5. (Optional) Click the toolbar puzzle-piece icon and **pin AgentDemo** for one-click access.

To update after pulling changes: return to `chrome://extensions` and click **Reload** on the
AgentDemo card.

## Use it

AgentDemo stays **dormant until you click its toolbar button** — it never injects UI on its own.

1. Open a supported page (see below) or the bundled `demo/mock-agent-ui.html`.
2. **Click the AgentDemo toolbar button** → a floating **🎬 icon** appears (bottom-right).
3. **Click the icon** to open the panel, then **🔍 Analyze** to capture every user prompt.
4. Click any prompt (or `Alt+↑/↓`, `Cmd/Ctrl+1..9`) to jump to it during your demo.
5. Click the toolbar button again to hide AgentDemo on that tab.

Full controls, hotkeys, and settings are documented in
[`extension/README.md`](extension/README.md).

### Supported UIs (auto-detected)

- **coworker** — `experience.adobe.com`
- **workspace** — Experience Workspace at `da.live/canvas`
- **aemcoder** — `aemcoder.adobe.io`
- **mock** — the bundled `demo/mock-agent-ui.html` (for offline testing)

If auto-detection is wrong, click the badge in the panel header to force a profile.

## Try it offline (no login)

Open `demo/mock-agent-ui.html` directly in Chrome after loading the extension, click the toolbar
button, then **🔍 Analyze** — you'll see the mock conversation's prompts captured as steps.

> For a `file://` page, enable **Allow access to file URLs** on the AgentDemo card in
> `chrome://extensions`, or serve the folder locally (e.g. `python3 -m http.server` then open
> `http://localhost:8000/demo/mock-agent-ui.html`).
