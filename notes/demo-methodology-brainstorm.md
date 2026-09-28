# Agentic Demo Helper — Methodology Brainstorm

_Date: 2026-09-25 · Stage 1 (options) · Status: exploring_

## Problem statement
Solution consultants (SCs) need to demo agentic AI workflows, but:
- **Latency:** real runs take minutes (thinking + tool loops) → dead air on stage.
- **Fallback is worse:** pre-recorded chat has a huge context window → endless
  scrolling; the *value* is buried in the transcript.
- **Attention:** no way to point the audience at the moment that matters.
- **Reliability:** live API calls fail, cost money, and are non-deterministic on stage.

## Core reframe
The audience cares about the **work**, not the **conversation**. Agentic value =
1. **Decisions** (why the agent branched / chose a tool / rejected an option)
2. **Actions** (tool calls, API hits, side effects)
3. **Artifacts** (the report, chart, code, booking, PR — the actual output)

The chat transcript is exhaust. Every design below promotes signal (1–3) and demotes
noise (raw token stream, latency, scrolling).

## Design axes (to compare options)
- **Fidelity:** real live agent ←→ deterministic replay of a captured real run
- **Control:** linear playback ←→ interactive branching driven by the presenter
- **Attention:** raw chat ←→ curated, spotlighted "frames"
- **Time:** real-time ←→ compressed ←→ teleported to result
- **Surface:** overlay on an existing product ←→ own bespoke presentation canvas

---

## Options

### A. Demo Compiler (Capture → Author → Present)
Record ONE real agent run and capture everything (prompts, tool calls, outputs,
timings) into a portable "agent run" file — like a HAR for agent runs. Then replay
it in a UI that *looks* live but is deterministic and offline. The SC drives the
**clock** with a clicker: fast-forward boring tool loops, pause and dwell on value
moments.
- **Solves:** latency (teleport dead time), reliability (offline, no live API),
  authenticity (it IS a real run).
- **Innovation:** treat a demo like *code* — a compile pipeline, versionable, replayable.
- **Cost:** need a capture format + replay engine.
- **Form factor:** macOS app fits best (owns the engine, offline, presenter view).
- **Innovation rating:** ★★★★★ (this is the backbone)

### B. Value Beats / Chapter Deck
Structure the run into named **beats** ("Ingested 3 contracts", "Flagged the
liability clause", "Drafted the redline"). Present like a slide deck: each beat
auto-scrolls to + spotlights the relevant transcript region with a callout. The
audience never sees scrolling — only curated frames. Keynote "Magic Move" over a chat.
- **Solves:** attention + scrolling.
- **Innovation:** demo authored as a *narrative*, not a log.
- **Cost:** authoring step to define beats (could be AI-assisted from the transcript).
- **Innovation rating:** ★★★★☆

### C. Artifact Cockpit
Invert the layout. Demote chat to a thin sidebar timeline; make the **work product**
the star. Center canvas shows the artifact *materializing* (report building,
chart filling in, code diff landing, a form getting booked). Right rail = compact
agent-activity graph (nodes for tool calls / decisions), NOT raw text.
- **Solves:** "show the work, not the tokens"; makes value visceral.
- **Innovation:** reframes what an "agent UI" even is for a demo.
- **Innovation rating:** ★★★★★

### D. Time-Lapse with a Credibility Dial
Keep it real but compress: collapse tool latency to ~0, reveal results at human pace.
Key nuance: audiences distrust things that are *too* fast ("is this fake?"). So keep
a short, believable "agent working" beat (live-looking tool trace / spinner) before
teleporting. A **credibility dial** trades speed vs. believability.
- **Solves:** latency without losing trust.
- **Innovation:** naming + tuning the authenticity/speed tradeoff explicitly.
- **Innovation rating:** ★★★☆☆ (great modifier on A, weak alone)

### E. Branching / What-If Mode
Pre-capture multiple branches so the SC can answer live audience questions
("what if the invoice is in EUR?") by jumping to a canned-but-real branch. Feels
interactive and live; each branch is deterministic.
- **Solves:** the "can it do X?" moment that kills scripted demos.
- **Innovation:** interactivity without live risk.
- **Cost:** capture N branches; UI to jump between them.
- **Innovation rating:** ★★★★☆

### F. Director Overlay (Chrome extension)
Inject a control layer over ANY existing web agent UI (ChatGPT/Claude/custom web app):
zoom into the value cell, dim/blur the rest, auto-scroll on cue, add spotlights &
redactions. Like Screen Studio / Loom, but for a *live* agent surface.
- **Solves:** attention, reuses the real product UI (max authenticity).
- **Innovation:** lowest lift, works on tools you don't control.
- **Cost:** still bound to live latency unless paired with A.
- **Form factor:** Chrome extension is the natural fit.
- **Innovation rating:** ★★★☆☆

---

## Synthesis — recommended north star
The strongest product is a **synthesis of A + C + B**, with D and E as modes:

> **A "demo compiler" that ingests a real agent run and renders it as an
> artifact-forward, chaptered, presenter-driven experience — deterministic and
> offline.** Pipeline: **Capture → Author → Present.**
> - Capture: run the real agent once; save a portable run file.
> - Author: auto-segment into value beats; SC tweaks pacing, spotlights, redactions;
>   optionally record what-if branches.
> - Present: presenter view (notes + next beat + timing) on one screen, clean
>   artifact cockpit on the audience screen; clicker-driven; credibility dial for pacing.

## Form-factor tradeoff (decide later)
- **Chrome extension:** overlay real web agent UIs (max authenticity, low lift);
  weak at offline determinism, native apps, presenter view. Best for Option F.
- **macOS app:** owns the replay engine, offline, dual-screen presenter view,
  can screen-capture any source. Best for A/B/C/E.

## Open questions for Stage 2
- What do SCs demo most (coding agent? research agent? ops/RPA? support?) — shapes the artifact canvas.
- Presentation context: live on stage, screen-share on Zoom, or self-serve links?
- Who authors the demo — the SC, or a central enablement team building a library?
- How much "live typing" of the prompt is needed for credibility?
- Reuse across prospects (parameterize names/logos/data per account)?

---

## Stage 2 — Concrete design (chosen: synthesis A+C+B, mode E)
_Context locked: **Zoom/Teams screen-share**. Agent type: left generic/pluggable._

### Form-factor decision: local-first WEB APP (not native macOS)
Screen-share = you share one window; audience sees pixels. A single-window web app is
trivial to window-share, cross-platform for viewers, and the same file becomes a
self-serve shareable link later. Can also wrap as a Chrome extension for Option F overlay.

### Pipeline: Capture -> Author -> Present

**Run file (Capture output).** Portable JSON timeline of typed events:
- `message` (user/assistant), `decision` (the "why" behind a branch/tool choice)
- `tool_call` / `tool_result` (with REAL duration captured)
- `artifact_patch` (incremental edit to a named output doc — lets the canvas build live)
- `beat_marker`, `branch_point`
Artifacts accumulate patches so output materializes step by step. Deterministic + offline.

**Present = TWO windows (critical for Zoom):**
- Audience window (the only one shared):
  - Center: the ARTIFACT materializing (report/diff/booking) — the star.
  - Left thin rail: agent activity as a vertical node timeline (decision/tool nodes,
    current pulsing) — NOT raw chat.
  - Bottom: one-line beat caption. Top: pinned goal.
  - Spotlight: dim all but focused region + big-type callout. No scrolling, ever.
- Presenter window (NOT shared; 2nd monitor / iPad / phone):
  next beat + note, timer, branch buttons, credibility dial, keyboard map.

**Interaction:** Space/Right = advance a beat -> teleport dead latency, play a short
believable "working" micro-beat (real tool name + spinner ~0.8s), reveal artifact delta.
Left = back. Number keys = jump to a what-if branch (mode E). Credibility dial tunes the
working-beat dwell 0-3s (fast but not suspiciously fake).

**Zoom constraints baked in:** big type + high contrast (compression smears small text);
discrete state changes over fast animation (encoders smear motion); keyboard-driven;
presenter notes never in the shared window.

### Thinnest slice to prove it (build order)
1. Hand-author one `demo.json` (skip capture tooling at first).
2. Present view: artifact canvas + activity rail + beat advance + spotlight.
3. Two-window presenter split.
4. Branching (E) -> capture recorder (A) -> auto-beat authoring (B).

---

## Scenario 1 (CHOSEN to prototype) — Chrome extension: left "director panel" over an executed LLM conversation
_Latency/reliability solved for free (run already happened). Problem reduces to ATTENTION + RANDOM ACCESS._
_Reframe: the left panel is a **director's timeline**, not a table of contents._

### Panel content models (pick one / combine)
- **Value Beats** — ~5 named value moments (DEFAULT, narrative demos).
- **Activity graph** — one node per tool-call/decision (RPA/ops demos).
- **Artifact index** — jump by deliverable produced (report/code/PR demos).
- **Dual-track timeline** — user turns vs agent actions (show autonomy).

### Navigation & attention mechanics
- Click beat -> smooth-scroll + spotlight (dim/blur the rest). No manual scrolling.
- Collapse noise by default (long reasoning + repetitive tool loops); expand on demand.
- Focus mode (f): current block full-width, panel becomes the remote.
- Keyboard: Up/Down through beats, number keys to jump, Right to reveal collapsed block.
- Minimap: thin full-conversation strip with beat markers (you-are-here).

### Demo methodology (how to present)
1. Payoff-first arc: open on the final ARTIFACT spotlighted, then rewind to "how".
2. 3-5 beat rule: ruthlessly curate; 40 turns -> 5 clicks.
3. Narrate the DECISION, not the text (one sentence of value per beat).
4. Collapse-by-default: raw tool JSON/thinking stays folded unless it's the hero.
5. Land on the artifact (end where you started).
6. Q&A random-access: panel = jump-to when asked "did it check X?" -> feels live.

### Authoring the beats (SC prep)
- Auto-extract candidates from DOM (tool calls, code blocks, headings, long turns).
- SC clicks a message to mark/rename beat, reorders, writes caption + private note.
- Persist beat-set keyed to conversation URL/hash; reuse across prospects (swap name/logo).

### Credibility + Zoom polish
- Keep native chat UI visible (clearly the real product) = authentic.
- Per-beat redaction (blur client names/secrets).
- Big-type captions, high contrast, discrete jumps (survive Zoom compression).

### Sharpest single move
Payoff-first + 5-beat spotlight walk. Kills the scrolling problem on its own.

### v1 feature (FIRST to build) — Prompt Navigator dropdown
Capture every USER prompt in the conversation -> dropdown list -> select = fast-scroll to it.
Key insight: user prompts ARE the natural chapter markers, so this gives auto-chapters with
ZERO authoring. Cheapest path to killing the scroll.

Design decisions:
- Label, don't dump: number badge + ~50-char truncation, not the full prompt.
- Scroll = fast-smooth + arrival flash (brief highlight pulse), NOT instant jump (Zoom-friendly).
- Keyboard is the stage tool: Alt+Up/Down walk prompt-to-prompt; Cmd/Ctrl+1..9 jump.
- "Now showing 3 / 12" position indicator.
- Live re-scan via MutationObserver (list stays correct as convo grows / chat switches).

Gotchas to design around:
- Virtualized chat DOM (ChatGPT/Claude lazy-render) -> offscreen prompt nodes may not exist;
  scrollIntoView fails. Mitigate: scroll container by estimated offset, or target full-DOM sites.
  BIGGEST technical risk — validate on the real target early.
- Sticky headers -> scrollIntoView needs top-margin offset.
- Edited/regenerated prompts (branches) -> list all versions or only active branch?

Evolution path: editable labels turn this dropdown INTO the Value Beats director panel.
v1 auto prompts -> v2 rename/curate -> v3 spotlight + collapse.

### Target UIs + auto-detect design (recon 2026-09-25)
Requirement: extension AUTO-DETECTS which UI is displayed, applies that UI's prompt-selector
profile automatically; Pick mode is the fallback for unknown UIs.

Registry model:
- profile = { id, matches(loc, doc) -> bool, container selector, userPrompt selector }
- Detect by URL + stable DOM markers (data-testid/role), NEVER hashed classes.

Coworker UI (experience.adobe.com/#/.../coworker/<id>):
- Chat lives in a SAME-ORIGIN iframe (src .../thunderbird/solutions/*coworker-ui*).
  => extension MUST set content_scripts all_frames: true.
- Fingerprint: host experience.adobe.com + [data-testid="chat-page"].
- Message turns render under [data-testid="episode-list-wrapper"].
- Classes are HASHED/unstable (sd171, Gs171) -> anchor on data-testid/role only.
- User-turn selector: UNKNOWN until a conversation has messages (test account was empty:
  "No conversations yet"). Need a populated convo to capture it.

aemcoder UI (aemcoder.adobe.io/chat/content/preview):
- Chat in MAIN frame (no iframe for messages). Input: textarea[aria-label="Chat message input"].
- Very few stable hooks: almost no data-testid; mostly aria-label/role. Anchor on aria/role.
- Has a CROSS-ORIGIN preview iframe (preview-aemcoder.adobe.io/content/...) = live artifact pane.
- User-turn selector: UNKNOWN (test account empty).

Fingerprints for auto-detect:
- coworker: host experience.adobe.com + [data-testid="chat-page"]; msgs in iframe under
  [data-testid="episode-list-wrapper"]; all_frames required.
- aemcoder: host aemcoder.adobe.io + textarea[aria-label="Chat message input"]; msgs in main frame.

Design conclusion: BOTH test accounts empty + markup unknown/sparse/hashed => do NOT hardcode
prompt selectors. Auto-detect UI by URL+DOM markers (easy), LEARN prompt selector at runtime via
Pick mode (click one user msg -> derive selector), with optional hardcoded fast-path once a real
populated conversation can be sampled.

Still blocked to finalize selectors:
1. Need a POPULATED conversation on either UI to capture the exact user-turn selector.

---

## Scenario 2 — REPLAY MODE (deterministic "fake-live" reveal)
Second mode of the same panel. Scenario 1 = Navigate (random access, jump+spotlight, Q&A).
Scenario 2 = Replay (linear fake-live reveal for the main narrative).
Solves latency + reliability + scrolling + credibility in ONE move.

Flow:
1. Enter Replay -> snapshot every executed turn's rendered content, then HIDE all turns.
2. Presenter selects first prompt (reuses Scenario 1 prompt list as the "script").
3. Enter -> brief "thinking..." beat -> response STREAMS in (animated, LLM-like), un-hidden.
4. Presenter narrates; Enter/click advances to next prompt. Repeat.

Key decisions (with recommendation):
1. Animation model: char-by-char breaks on rich content (code/tables/images) + drags on long
   answers. RECOMMEND hybrid: block-level progressive reveal (paragraph/code/table/tool-call one
   block at a time, quick fade + cursor); char-stream only for plain prose.
2. Pacing: RECOMMEND presenter-driven w/ auto-assist. Auto-stream, but Enter = complete-now/next
   block; held key fast-forwards. NEVER be trapped waiting on a long stream.
3. Prompt entry (KILLER MOVE): type the real prompt into the actual input box and INTERCEPT the
   submit (block the real API call), then play the recorded response. Looks 100% live. Fallback:
   prompt already shown, Enter reveals response.
4. Noise: reveal tool-calls/reasoning as compact animated "using tool X... -> result" chips (the
   VALUE). Long JSON/CoT collapsed by default.
5. Layout: cumulative reveal + auto-pin to streaming head (no manual scroll); optional focus-mode
   (only current turn visible).

Gotchas:
- Rich-content streaming = top technical risk -> block-level reveal, never naive char-typing into
  highlighted HTML.
- MUST hard-block the real submit in replay (intercept keydown/form submit) -> no live API call.
- Reserve layout space during reveal to avoid reflow jumps.
- Skip-to-end on every response is mandatory.

Presenter aids: control bar (Prev/Next turn, Play/Pause, Next-block, Skip-to-end, Speed);
per-turn notes (from Scenario 1 editable labels); "Turn 2 / 8" indicator.

INNOVATION CALLOUT: decision #3 (type real prompt -> intercept submit -> stream recorded response)
is the crux; collapses latency+reliability+credibility into one trick.

### Scenario 2 — LOCKED decisions + duration config
Locked:
- Reveal style: HYBRID block-level reveal + typewriter for plain prose.
- Prompt entry: prompt already shown, Enter reveals response (no input interception in v1).
- Pacing: presenter-driven + auto-assist (Enter = complete-now/next block; held key FF; skip-to-end).

Duration configuration (NEW requirement):
- Reveal duration = total time a response animates in, FIXED per reveal (default ~4s), distributed
  across its blocks. Predictable pacing regardless of response length.
- Scope: global default + PER-PROMPT override (stored with that turn's note/label). Slow-play the
  hero response, fast-play filler.
- Separate knobs: "thinking" beat before response (default ~0.8s, credibility pause); optional
  auto-advance gap between turns (default OFF, presenter drives with Enter).
- Interop: duration sets auto-stream speed; Enter still completes-now/advances; skip-to-end always
  available -> duration never traps the presenter.

### Persistence + import/export (NEW requirement)
Storage layer: use chrome.storage.local (NOT window.localStorage). Reason: coworker chat is in an
iframe + aemcoder has frames; localStorage is per-origin/per-frame and would NOT be shared, while
chrome.storage.local is shared across all extension frames and syncs via storage.onChanged.
Autosave debounced on any change.

Config holds SETTINGS ONLY (lean + portable); NEVER conversation content:
- Global: defaultRevealMs, thinkingMs, interTurnGapMs, revealStyle, hotkeys, flashMs, defaultMode.
- Per-conversation (key = uiId::convId): learned/auto promptSelector; prompts[] of
  { index, label, note, durationMs? }.
- Excluded on purpose: response HTML/text (comes from live DOM). Keeps files tiny + shareable.
  A full "captured replay bundle" (with responses) is a separate heavier artifact (future).

Export (two formats):
- JSON = canonical, full round-trip (schemaVersion for migration). File demo-<title>-<date>.json.
- MD = human-readable demo script (front-matter globals + "## Turn N" blocks: label/note/duration);
  for review/sharing; re-importable best-effort from the template.

Import: file picker -> read -> validate schemaVersion -> choose Replace-all OR Merge-into-current
-> save -> re-render. JSON fully supported; MD parsed from templated structure.

Payoff: author once, export script, share or swap client names per prospect -> reuse across prospects.

Schema sketch:
  { schemaVersion, exportedAt, appVersion,
    global: { defaultRevealMs, thinkingMs, interTurnGapMs, revealStyle, hotkeys, flashMs, defaultMode },
    conversations: { "uiId::convId": { url, title, uiProfile, promptSelector,
                                       prompts: [ { index, label, note, durationMs? } ] } } }

### Config picker + full-bundle export/import (NEW requirement)
Elevates the extension into the full Demo Compiler (Capture -> Author -> Present). A file carries
the whole demo -> plays anywhere, offline, no login, no original conversation.

1. Config picker (storage browser): modal listing every saved entry in chrome.storage.local; each
   row shows name/title, source URL, #prompts, lastSaved. Actions: Apply (load onto current page),
   Rename, Delete, Export. Replaces implicit current-conversation auto-key with explicit chooser.

2. Full-bundle export/import:
   - Export scope toggle: "Settings only" (lean) OR "Settings + conversation logs" (full bundle).
     Bundle adds per-conversation capture[]: ordered turns { role, html, meta } from rendered DOM.
   - Import replaces window content: if file has logs, render captured turns into the conversation
     area and Replay -> looks like a real LLM interaction, fully offline.

Rendering substrate (THE decision): host chat DOM is React-owned; manual inject/remove triggers
React reconciliation errors / crashes. Two substrates:
   - In-place hide/reveal (live conversation present): native nodes (authentic). = Scenario 2 as-is.
   - Overlay surface for imported bundles: our container above the host chat, NEVER mutating React
     DOM. Portable to ANY page (even blank), React-safe; must carry captured styles. RECOMMENDED.

Gotchas:
- Sanitize imported HTML (strip script/handlers) — security.
- Hashed CSS classes drift across host builds -> captured outerHTML looks native only same-build;
  mitigate by inlining computed styles for durability.
- chrome.storage.local ~5MB -> request unlimitedStorage and/or store big bundles as files.
- Coworker capture/inject happens inside its iframe (in-iframe content script).

Convergence: realizes Stage-2 north star (Demo Compiler) inside the Chrome extension.

### Substrate decision logic + capture/turn model (refinement)
Substrate LOCKED: Both — native when UI matches, overlay otherwise.
Decision logic per render:
- Native if page UI fingerprint == bundle uiProfile AND host message container found. Insert
  captured nodes into host container, GUARD with MutationObserver (React owns DOM, may wipe nodes).
- Auto-fallback to overlay on React instability (nodes removed/errors), UI mismatch, missing
  container, or blank page. Overlay is the reliable floor; "Both" = try native, fall back safely,
  never crash the demo.

Capture/turn model (foundational for full-bundle + Replay + both substrates):
Conversation = ordered turns under message container (coworker: episode-list-wrapper; aemcoder:
main chat log). Each captured turn:
  { role: "user"|"assistant"|"tool"|"reasoning",
    html: sanitizedOuterHTML,            // native/overlay render
    blocks: [ { type, html } ],          // paragraph|code|table|list|tool|image = reveal units
    meta: { toolName?, ts? } }
- Role detection: learned user-prompt selector marks user turns; spans between = assistant +
  tool/reasoning sub-blocks.
- Block segmentation drives hybrid reveal + fixed-duration timing: walk assistant child block
  elements -> each = reveal unit; ~4s reveal distributed across them; tool/reasoning render as
  compact "using tool X -> result" chips.
- Store BOTH html (render) and blocks (reveal timing) so Replay is identical on native/overlay.

### Refinements: Pick-mode, Panel UI, Shared state, Authoring, Artifact preview

1) Pick-mode + stable-selector derivation
- Interaction: "Pick a prompt" -> crosshair, hover-highlight -> click one user bubble; optionally
  click one assistant bubble to teach a NEGATIVE.
- Derivation (ranked, discard hashed classes): prefer stable [data-testid]/data-*/[role]/
  [aria-label]/semantic tags on node or nearest ancestor; reject class tokens matching hash
  heuristic (^[A-Za-z]{1,3}\d{2,}$ / random-looking).
- Contrastive: with 1 positive (+1 negative) find simplest predicate separating user vs assistant
  (differing attr value, non-hashed class, or structural position).
- Validate by generalization: run candidate -> highlight all matches -> "Found N prompts — correct?"
- aemcoder worst case (near-zero hooks): fall back to ALTERNATION model (odd child = user) or anchor
  on avatar/icon position. Hardest UI; contrastive + alternation covers it.

2) Panel UI / control surface
- Shadow-DOM panel (isolates from host hashed CSS); collapsible left rail ~300px -> thin tab so it
  never covers the artifact on Zoom.
- Sections: header (name, auto-detected UI badge, Navigate|Replay toggle) -> prompt list (numbered,
  editable label, note, per-prompt duration, jump/replay btn, drag-reorder, active highlight, N/M)
  -> Replay control bar (Prev, Play/Pause, Next-block, Skip-to-end, duration/speed, thinking-beat)
  -> footer (Config picker, Capture, Export, Import, Pick-mode, Settings).
- Hotkeys: Alt+Up/Down prev/next; Enter reveal/advance; Cmd/Ctrl+1..9 jump; f spotlight; Esc exit
  Replay/overlay; [ / ] speed; ? cheatsheet.

3) Navigate <-> Replay shared state
- Single source of truth: { mode, prompts[], currentIndex, revealProgress }; both modes share
  prompts[] + currentIndex.
- Toggle: Navigate->Replay hides all turns, positions at currentIndex, waits for Enter.
  Replay->Navigate un-hides full conversation, scrolls to currentIndex, spotlights it.
- Payoff: Replay to a point -> flip to Navigate for Q&A -> flip back and resume (index persists).

4) Authoring flow + capture trigger ("author once, replay anywhere")
1. Run the real agent once, OFF-stage (real latency fine).
2. Capture (manual button; optional auto-on-complete) -> snapshot all turns into a bundle.
3. Author: auto-segment prompts -> edit labels, presenter notes, per-prompt durations, mark
   spotlights, TRIM filler (hide turns to enforce 3-5 beat rule without deleting data).
4. Export bundle -> 5. Present anywhere (native on matching UI, overlay elsewhere).
- Solves empty-account problem: author on a populated run once; bundle carries it -> demos run even
  though shared test accounts are empty.

5) aemcoder artifact-preview angle (show-the-artifact move)
- aemcoder cross-origin preview iframe (preview-aemcoder.adobe.io/content/...) = the live built
  artifact = the actual value.
- Capture preview src per turn (can't read cross-origin internals, but CAN set iframe src). On
  Replay, navigate preview to that turn's captured URL as the response reveals -> page/block
  materializes in SYNC = Artifact Cockpit realized on aemcoder.
- Navigate mode: a beat can spotlight the preview pane instead of a message.
- Caveat: captured src navigations need preview URLs still served (session). Fully-offline needs
  snapshotting rendered artifacts (screenshot/HTML) — heavier; optional.

### Enhancement: interstitial HTML cards between prompts
Author arbitrary HTML that pops up CENTERED between prompts (bullets, diagrams) to state the value
explicitly. Turns the tool into fake-live agent replay + slides hybrid. Serves the core goal
(draw attention to value).

- First-class timeline items: prompts[] generalizes to steps[]; each step is
  { type:"prompt", ... } or { type:"card", html, note, durationMs? }. Prompt list shows prompts AND
  cards inline, drag-reorderable; place a card anywhere between prompts.
- Authoring (config window): HTML editor per card + live preview; drop between prompt N and N+1.
  Anchor cards by step id/position, NOT numeric index (survives trim/reorder).
- Playback: on a card step, fade/scale into center over dimmed backdrop (reuses spotlight dim);
  presenter narrates; Enter/click dismisses -> next step. Auto-advance after durationMs optional
  (presenter-driven default). Navigate mode: card is a jumpable list entry.
- Rendering + safety: render inside panel Shadow DOM (isolated from host hashed CSS). Allow static
  HTML + inline CSS + SVG (diagrams). Scripts STRIPPED (safety + extension CSP blocks injected JS).
  For dynamic diagrams (Mermaid) pre-render to SVG and paste.
- Portable: card HTML travels in export bundle -> works offline, native or overlay, any page.

Schema update — conversations[key].steps[]:
  { type:"prompt", index, label, note, durationMs? }
  { type:"card",   id,    html,  note, durationMs? }

Innovation: interstitials = the explicit "here's why this matters" beat between agent turns; the
attention anchor missing from raw chat replays.

### Enhancement: card-prompt generator (paste into Claude)
Extension builds a ready-to-paste Claude prompt encoding the card's purpose + format requirements
and injecting the surrounding prompt/response as source material; copies to clipboard. SC pastes
into their own Claude, gets HTML back, drops it into the card. Keeps generation in the SC's Claude
session (no API keys / CSP issues in the extension).

- Template library: built-in (Key-bullets, SVG diagram, Value summary, Comparison table) +
  user-editable/saved (travel in export bundle). Template = { id, name, purpose, formatSpec, body }
  with placeholders.
- Context injection: card sits between steps -> generator pulls adjacent prompt + response text
  (from captured turn model), truncates long responses to token budget, fills {{CONTEXT}}.
- Assemble -> clipboard: fill placeholders -> navigator.clipboard.writeText -> toast "copied".
- Paste-back (recommended): field to paste Claude's HTML -> sanitize -> becomes card.html. Closes
  the loop without leaving the panel.

Format-requirement spec (crux — what the prompt tells Claude):
  You are generating ONE self-contained HTML "insight card" for a live demo overlay.
  PURPOSE: {{purpose}}
  SOURCE CONTEXT:
  --- USER PROMPT ---   {{prompt_text}}
  --- AGENT RESPONSE (trimmed) ---   {{response_text}}
  CARD REQUIREMENTS (STRICT):
  - Output ONLY one HTML fragment. No markdown fences, no commentary.
  - Static HTML + inline CSS only. SVG allowed. NO <script>, NO external URLs/fonts/images (data: OK).
  - Must render inside a Shadow DOM with no external stylesheet.
  - Fit centered card up to 900x600px; large, high-contrast, Zoom-legible type.
  - {{purpose_shape}}  (e.g. "3-5 crisp bullets" OR "one labeled SVG diagram")
  - Neutral modern styling (system font stack), rounded card, generous padding.
  Return the HTML now.

Schema addition: promptTemplates[]: { id, name, purpose, formatSpec, body } (built-in + user, exportable).
Generator = fill(template.body, { purpose, prompt_text, response_text, purpose_shape }) -> clipboard.
Why: format spec tuned to renderer constraints (Shadow-DOM-safe, no-scripts CSP, offline, Zoom) so
Claude's output drops in and just works.

### BUILT (v0.1.0) — verified 2026-09-25
Files: extension/manifest.json, extension/pn.js (single content script), extension/README.md,
demo/mock-agent-ui.html (verification fixture).
Verified in headless Chromium against the mock UI:
- Auto-detect (mock profile), capture 5 prompts, prompt list + N/M indicator.
- Navigate: jump + smooth-scroll + spotlight/dim + flash (pos 3/5, 2 spots).
- Pick-mode core: deriveSelector -> div[data-role="user"] (5), ignores our pn-* classes.
- Replay from step 0: hide all 10 turns, reveal prompt + 4 blocks over ~4s, later turns stay hidden.
- Interstitial card: add/edit/preview overlay (centered, dimmed backdrop), save.
- Card-prompt generator: buildCardPrompt includes strict format spec.
- Export/import: JSON + MD round-trip WITH full capture logs (6 steps incl. card, 5 turns).
- Persistence: pn:conv/pn:global/pn:templates saved; config picker lists + Apply.
Not yet wired (needs populated real conversation): aemcoder artifact-preview src sync; real-UI
user-turn selectors (learned via Pick at runtime).

### v0.1.1 — floating toolbar + Analyze (verified 2026-09-25)
- Panel is now a FLOATING, draggable, minimizable card (not a full-height rail). Starts MINIFIED
  as a compact toolbar (height ~50px, top-left); click ▢ / drag header to expand/reposition so it
  never overlays page content. State tracked in S._min; overlay import surface inset fixed to 0.
  Verified: hasMin=true at start, modes hidden, glyph ▢; expand -> footer visible; drag moved panel +200/+152.
- 🔍 Analyze: analyzeSession() auto-discovers user prompts (guessUserSelector: profile -> common
  candidates), captures all, and shows a summary modal (prompt list + counts) with "Copy prompts".
  Verified on mock: selector [data-role="user"], 5 prompts / 5 agent turns / 3 tool calls / 1,184 chars.

### aemcoder diagnosis: "no user prompts found" (2026-09-25)
Root cause: aemcoder chat is a React-Aria GRID ([aria-label="Chat messages"] -> role="row").
User and assistant rows are byte-identical: same hashed class (_Le16...), same "Copy message"
button, same alignment, NO data-role/testid/aria sender marker, and NOT alternating (one user
prompt -> many agent messages). The ONLY distinguisher is the user bubble background color
rgb(203,226,254) on an inner div with hashed classes. Our CSS candidate selectors all returned 0.

Fix (shipped): visual predicate detection.
- pn.js: isBluishBg()/hasUserBubble(); aemcoder profile now { container:'[aria-label="Chat messages"]',
  rowSelector:'[role="row"]', userMatch: hasUserBubble }.
- Generalized captureTurns(container, userSelector, opts) to support rowSelector + userMatch predicate;
  doCapture/analyzeSession/boot accept predicate profiles (userSelector may be null).
Verified on the REAL aemcoder DOM (relay): predicate found the user prompt(s) among role=row rows
(e.g. "push it and open a PR"); previously 0. Mock CSS path unchanged (5 prompts).

Remaining limitation: the grid is VIRTUALIZED — only currently-rendered rows are in the DOM, so a
single capture sees a partial conversation. Follow-up: auto-scroll the grid to materialize all rows
before capture (react-aria virtualizer).

### Fix: Pick "can't derive selector" + Analyze 0 on aemcoder (2026-09-25)
Two symptoms, one root cause = aemcoder has NO stable selector AND a virtualized grid.
- Pick failed: deriveSelector found no stable attr/class (all hashed) -> null -> "can't derive".
- Analyze 0: at rest the rendered window (~15 of ~35+ rows) often shows ONLY assistant messages, so
  the blue-bubble predicate matched nothing.
Fixes (shipped):
1. Pick color fallback: when no CSS selector derivable, learn the clicked user bubble's background
   COLOR (bubbleColorOf) -> makeColorMatch predicate; set S.userMatch/S.rowSelector/S.userColor;
   persisted in config (userColor/rowSelector) and rebuilt on load.
2. Analyze auto-scroll: scrollCollectTurns() sweeps the scroll container top->bottom, collecting all
   user rows deduped by data-key. analyzeSession is now async; Pick-color routes through it too.
Verified on REAL aemcoder DOM (relay): scroll-collect returned 35 user prompts (was 0 at rest);
assistant rows are not blue -> no false positives. Mock CSS path unchanged (5).
Limitation: rows recycle under virtualization -> aemcoder capture is prompt-only (index); reliable
response Replay needs full-bundle export.

### Tinted-bubble detection + panel debug box (2026-09-25)
- User bubble hue varies by theme; replaced hardcoded "bluish" with SATURATION test: user row =
  the row whose bubble bg is tinted (max-min channel >= 20, not white/grey) + text >= 6 chars.
  Hue/theme-agnostic. Verified on real aemcoder: user prompt bg rgb(203,226,254) sat 51 matches;
  assistant grey rgb(233,233,233) sat 0 excluded; scroll-collect found the prompts, 0 false pos.
- Panel 🐞 debug box: setDebug() populates S.debug on Capture/Analyze; renderPanel shows profile,
  mode (css | visual), selector/predicate, rowSel, container, rows-in-view, prompts, and scroll
  meta (passes, scrollH/clientH, virtualized). Verified on mock: shows "profile: mock · mode: css …".

### UX fixes (2026-09-25): capture-all, delete, resize, profile badge
- "Capture always = first prompt" bug: doCapture did a single DOM pass, so on the virtualized
  aemcoder grid it saw only the on-screen user row; buildStepsFromTurns then collapsed the list to 1.
  Fix: doCapture is now async and scroll-collects (scrollCollectTurns) whenever a userMatch predicate
  is active — same as Analyze. CSS UIs unchanged (single pass).
- Delete: each list item has a 🗑 (deleteStep) to remove a prompt/card; ✎ edits. Verified mock 5->4.
- Resize: #panel is resize:both (min 220x160, max 96vw/100vh); .min disables resize + collapses.
- Profile badge: header shows UI: <profile> (green known / red "no UI match"). Verified "UI: mock".

### Detection robustness + manual profile override (2026-09-25)
- "no UI match" on aemcoder: detectProfile ran at document_idle before the SPA mounted; aemcoder
  test required a late-mounted textarea. Fixes:
  - Host/path-based tests: aemcoder = host aemcoder.adobe.io + path /chat; coworker = host
    experience.adobe.com + (chat-page OR episode-list-wrapper). No dependency on mounted input.
  - ensureProfile() re-detects before each Capture/Analyze/Pick and on a boot retry loop (20x700ms)
    until a known profile matches; updates badge/container live.
- Manual override: click the header badge -> menu (Auto / coworker / aemcoder / mock). setForced()
  persists to pn:forced:<host> and forces resolveProfile() regardless of auto-detect. Badge shows 🔒.
  Verified on mock: force aemcoder -> "UI: aemcoder 🔒"; back to Auto -> "UI: mock".

### Navigate scroll-to-prompt (virtualized) + Reset (2026-09-25)
- Bug: clicking a prompt in Navigate didn't scroll on aemcoder — prompts came from scroll-collect,
  and the virtualized grid recycled the DOM nodes, so stored promptEl was detached (scrollIntoView no-op).
- Fix: store scrollPos + data-key per collected turn; navigateTo detects a detached promptEl and calls
  scrollToTurn(), which hint-jumps to scrollPos then SEARCH-SCROLLS the grid until the row (by data-key
  or text prefix) renders, then scrollIntoView + flash. Pixel offset alone was unreliable (react-aria
  auto-adjusts scrollTop mid-sweep). Verified on real aemcoder: target row found + in view.
- Reset: 🧹 footer button (resetPrompts) empties S.steps/S.turns. Verified mock 5 -> 0.

### Navigate polish (2026-09-25): preserve list scroll + arrow keys
- renderPanel now saves/restores #list.scrollTop, so clicking/keying a prompt no longer jumps the
  prompt list to the top — only the conversation scrolls. Verified: list.scrollTop 45 -> 45 across nav.
- Plain ↑/↓ navigate prev/next in Navigate mode (Alt+↑/↓ still works in both modes). Verified 0->1->0.

### Highlight box + top-align + alt-only + focus (2026-09-25)
- Injected PAGE-level styles (pn-page-style) for pn-hidden/dim/spot/flash — these apply to page
  elements (were previously only in shadow, so highlights never showed). Added .pn-current: outline
  box + ::before label "Your Prompt".
- Clicking/selecting a prompt now scrolls it to the TOP (scrollIntoView block:start + scroll-margin)
  and marks it with the Your Prompt box; spotlight-dim only on non-virtualized UIs.
- Reverted to Alt+↑/↓ only (removed plain-arrow nav).
- Focus selected in panel list: renderPanel restores #list scroll then rect-adjusts so the active
  item is brought into view (scrollIntoView on shadow list was unreliable). Verified visually:
  Alt+Down to 5/5 scrolled list to show highlighted item 5; Your Prompt box at top of conversation.

### Replay parity (2026-09-25)
- revealStep now applies the same logic: markCurrent (Your Prompt box) + scrollIntoView block:start
  (top-align) on the revealed prompt; renderPanel focuses the active item in the list.
- Verified on mock: at reveal start prompt rectTop 28 with "Your Prompt" label; view then follows
  the streaming response (expected).

### Replay redesign (Start/Reveal) + close button (2026-09-25)
- Entering Replay no longer hides the conversation. New flow: select a prompt -> ▶ Start hides that
  prompt's response + everything below -> Reveal ▶ (or Enter) streams the response between this prompt
  and the next, then surfaces the next prompt (revealCursor advances). Repeat Reveal to walk forward.
- Removed Prev/Next; ctlbar = Start / Reveal / Skip end. startReveal now takes an onDone callback.
- ✕ close button in header hides the toolbar (host.style.display=none; reload to reopen).
- Verified on mock: enter replay hides nothing; select prompt 1 + Start -> hidden [3..9]; Reveal ->
  hidden [5..9] (response revealed + next prompt shown); ✕ -> host display none.

### Replay refactor: button-less click/alt reveal (2026-09-26)
- Removed all Replay control buttons (Start/Reveal/Skip). Entering Replay hides every turn (prompt +
  response) so only content before the first prompt shows.
- replayReveal(i): clicking a prompt (or Alt+↑/↓) reveals turns 0..i (cumulative — prompt + response
  until the next prompt) and hides the rest; markCurrent + top-scroll on the selected prompt.
- move/jump + list clicks route to replayReveal in replay; Enter -> move(1). navigate unchanged.
- Verified mock: enter -> hidden[0..9]; click p0 -> [2..9]; Alt+Down -> [4..9]; Alt+Up -> [2..9];
  ctlbar buttons = 0; Your Prompt box present.

### Replay hide-all fix (row-based) (2026-09-26)
- Problem: hide/reveal keyed off captured turn nodes (promptEl + responseEls). On real UIs capture is
  PROMPT-ONLY (responseEls empty), so LLM response rows stayed visible.
- Fix: replayRows() = container rows (rowSelector) or container.children. enterReplay hides all rows
  from the first prompt onward; replayReveal(i) shows rows up to the next prompt's index (prompt +
  its response rows), hides the rest; exitReplay un-hides all rows.
- Verified on mock with responseEls forced empty: enter -> hidden[0..9] (incl. response rows);
  click p0 -> [2..9] (prompt + response row shown); exit -> []. Works without captured responses.
