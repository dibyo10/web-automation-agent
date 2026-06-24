# Website Automation Agent 🤖

> Assignment 04 — an intelligent, AI-driven, **general-purpose** browser
> automation agent (a mini [Browser Use](https://github.com/browser-use/browser-use)).
> Built with **Google ADK** (Agent Development Kit for TypeScript/JavaScript) +
> **Gemini** + **Playwright**, in plain JavaScript (ESM, Node.js).

You give the agent a **goal in plain English** and it accomplishes it by driving a
real browser — taking screenshots, asking Gemini *what is on screen* and *where*
each element is, and acting via pixel coordinates. Nothing is hard-coded with CSS
selectors; the agent "sees, decides, and acts" in a loop (the ReAct pattern).

```bash
node index.js "open youtube, search world cup 2026, and play the 5th video"
node index.js "go to the shadcn react-hook-form page and fill + submit the bug report form"
```

The default goal (no argument) fills and submits the assignment's shadcn Bug Report form.

---

## 🧠👀✋ The core idea: Brain + Eyes + Hands

An automation agent is just three responsibilities, cleanly separated:

| Layer | Role | Technology | File |
|-------|------|------------|------|
| 🧠 **Brain** | Decides *what to do next* by calling tools | Google ADK `LlmAgent` + Gemini | `agents/automationAgent.js` |
| 👀 **Eyes** | Reads the screen (`read_screen`) and finds elements' pixel `(x, y)` (`locate_element`) | Gemini vision (`@google/genai`) | `services/vision.js` |
| ✋ **Hands** | Clicks / types / presses keys / scrolls in a real browser | Playwright | `services/browser.js` |

The **Brain is blind** — it cannot see pixels directly. It perceives the page only
through the Eyes: `read_screen(question)` returns a *text description* of what's
visible (great for orienting or handling pop-ups), and `locate_element(description)`
returns the *pixel coordinate* of any element it describes — even ordinal ones like
"the 5th video result". The Hands then act on those coordinates.

### The agent loop (what Google ADK runs for you)

```
        ┌─────────────────────────────────────────────┐
        │  Goal: "search YouTube and play the 5th video"│
        └─────────────────────────────────────────────┘
                          │
                          ▼
   ┌──────────────────────────────────────────────────────┐
   │  Gemini (Brain) picks ONE tool to call next           │◀────┐
   └──────────────────────────────────────────────────────┘     │
                          │                                       │
                          ▼                                       │
   ┌──────────────────────────────────────────────────────┐     │
   │  ADK Runner executes the tool (Hands / Eyes)          │     │
   │  e.g. locate_element → click_on_screen → send_keys    │     │
   └──────────────────────────────────────────────────────┘     │
                          │  tool result fed back to the model    │
                          └───────────────────────────────────────┘
                          (repeats until the model says "done")
```

---

## 🗂️ Project structure (modular by design)

```
web-auto-agent/
├── index.js                  # ENTRY POINT: reads the goal, runs the ADK loop
├── config/
│   └── index.js              # single source of truth for all settings + default goal
├── agents/
│   └── automationAgent.js    # 🧠 the ADK LlmAgent (general ReAct instruction + tools)
├── services/
│   ├── browser.js            # ✋ Playwright wrapper = all the action tools
│   └── vision.js             # 👀 Gemini vision = locate_element + read_screen
├── tools/
│   └── browserTools.js       # ADK FunctionTool wrappers (Brain ↔ Hands/Eyes bridge)
├── utils/
│   ├── coords.js             # box_2d (0–1000) → pixel math
│   └── logger.js             # colored play-by-play logging
├── scripts/
│   ├── testBrowser.js        # smoke-test the Hands with NO AI  (npm run test:browser)
│   ├── testSnap.js           # prove vision-coordinate snapping  (no AI)
│   └── verifyWiring.js       # prove the ADK stack constructs    (no network)
└── screenshots/              # PNGs the agent captures
```

---

## ✅ The tools (all in `services/browser.js`, exposed as ADK `FunctionTool`s)

The seven tools the assignment requires, plus the extras that make it a *general*
agent:

| Tool | Implementation | Required by assignment |
|------|----------------|:--:|
| `open_browser` | `chromium.launch()` + fixed 1280×800 viewport | ✅ |
| `navigate_to_url` | `page.goto(url)` | ✅ |
| `take_screenshot` | `page.screenshot()` → saved PNG | ✅ |
| `click_on_screen(x, y)` | `page.mouse.click(x, y)` | ✅ |
| `double_click` | `page.mouse.dblclick(x, y)` | ✅ |
| `send_keys` | `page.keyboard.type(text)` | ✅ |
| `scroll` | `page.mouse.wheel(0, amount)` | ✅ |
| `locate_element(desc)` | Gemini vision → pixel `(x, y)` (the "intelligence") | extra |
| `read_screen(question)` | Gemini vision → text description of the page | extra |
| `press_key(key)` | `page.keyboard.press(key)` — e.g. Enter to submit a search | extra |
| `wait(ms)` | pause for a page/SPA to load after navigation | extra |

---

## 🚀 Setup & run

**Prerequisites:** Node.js 18+ and a paid **Gemini API key**.

```bash
# 1. install dependencies
npm install

# 2. install the Chromium browser Playwright drives
npx playwright install chromium

# 3. add your key
cp .env.example .env
#   then edit .env and paste GEMINI_API_KEY=...

# 4a. run the default goal (fills + submits the shadcn bug report form)
npm start

# 4b. or give it ANY goal
node index.js "open youtube, search world cup 2026, and play the 5th video"
```

Useful checks that do **not** need an API key:

```bash
npm run test:browser   # drives the browser end-to-end, no AI (proves the Hands work)
node scripts/verifyWiring.js   # proves the ADK agent + tools + runner construct
node scripts/testSnap.js       # proves vision-coordinate snapping on the real page
```

---

## 🔍 What happens during a run — "play the 5th YouTube video"

1. `open_browser` → Chromium launches at a fixed 1280×800 (so screenshot pixels
   equal mouse coordinates).
2. `navigate_to_url("https://www.youtube.com")` → then `wait(2000)` for it to render.
3. `locate_element("the search box")` → `click_on_screen(x, y)` → `send_keys("world cup 2026")`
   → `press_key("Enter")` → `wait(2000)` for results.
4. `locate_element("the 5th video result counting from the top")` — vision counts
   the results and returns that one's pixel — then `click_on_screen(x, y)`.
5. `wait` for the watch page, `take_screenshot("done")`, and the Brain summarises.

If anything is unclear mid-run (a pop-up, an unexpected layout), the Brain calls
`read_screen` to get a text description and adapts. This is the **ReAct loop**:
think → act with one tool → observe → repeat.

---

## 🔁 Run it on any task

It's a reusable **engine**, not a one-page script. Two ways to set the goal:

```bash
node index.js "your goal in plain English"   # command-line argument
# or set TASK=... in .env, or edit the default `task` in config/index.js
```

Everything is generic: the instruction describes a *method* (perceive → locate →
act), not a specific page. `locate_element` finds anything you describe (including
"the Nth item"), `read_screen` gives the Brain situational awareness, and the form
example is just the *default goal* — not baked into the code.

**Honest limits (good to mention in the viva):** it handles standard pages well
(links, inputs, buttons, search, lists). Harder cases that would need more work:
custom non-native widgets, multi-step flows behind logins, `<iframe>`/shadow-DOM
content, and sites with aggressive bot detection.

---

## 🎓 Viva cheat-sheet (likely questions)

**Q. What is Google ADK?**
A code-first framework from Google for building AI agents. It manages the agent
loop (model → tool call → result → model). We use its TypeScript/JS package
`@google/adk`: `LlmAgent` (the agent), `FunctionTool` (a callable tool), and
`InMemoryRunner` (runs the loop with an in-memory session/event store).

**Q. How does the agent "see" the page?**
It doesn't see pixels directly. `take_screenshot` saves a PNG; `locate_element`
sends that PNG to Gemini's multimodal model and asks for the bounding box of a
described field. We convert that box to a click point.

**Q. What coordinate format does Gemini return, and how do you click it?**
Gemini returns `box_2d = [ymin, xmin, ymax, xmax]`, normalized to a **0–1000**
grid with the origin at the top-left. We take the box center, divide by 1000, and
multiply by the screenshot's real width/height (`utils/coords.js`). Because the
viewport is fixed at `deviceScaleFactor: 1`, one screenshot pixel = one CSS pixel
= one mouse coordinate, so the click lands accurately.

**Q. What is the ReAct loop?**
Reason → Act → Observe, repeated. Each turn the Brain reasons about the goal,
takes ONE tool action, observes the result, and decides the next action — until the
goal is done. Google ADK's `Runner` drives exactly this loop for us.

**Q. How does the agent handle an arbitrary task like "play the 5th YouTube video"?**
It's not scripted per-site. The Brain reads the goal, navigates, and uses
`read_screen` to understand the page and `locate_element("the 5th video result
counting from the top")` to get a pixel coordinate — Gemini's vision does the
ordinal counting — then clicks it. The same tools handle any site.

**Q. Why split vision into its own service instead of letting the agent see screenshots?**
Feeding live images back into an ADK agent's context needs the Artifacts service
and model callbacks — powerful but fragile. Two focused vision tools (`read_screen`
for a text description, `locate_element` for a coordinate) are more reliable and
easy to reason about: the Brain *delegates* perception to a specialist.

**Q. How do tool calls keep state between them (e.g. the open page)?**
`services/browser.js` exports a **singleton** instance holding the browser /
context / page. Every tool acts on that same instance, so a click acts on the
page a previous tool opened.

**Q. What stops an infinite loop / runaway cost?**
`runAsync` is given an `AbortSignal.timeout` (default 5 min, `TASK_TIMEOUT_MS`), and
the model is instructed to stop and summarize when the goal is done.

**Q. Vision coordinates are imprecise — how do you click the right thing reliably?**
After vision returns an approximate point, `locate_element` **centers** the target
(scrolls it away from the screen edge, where vision is least accurate) and, for
form-like targets, **snaps** the click to the precise center of the nearest matching
element (`<input>` / `<textarea>` / the button labelled "Submit"). This fixes the
classic ~100px drift onto an adjacent field, and it's how production agents like
Browser Use stay reliable: they fuse the *visual* and *structural* (DOM) views
rather than trusting raw pixels. For general clicks (e.g. a video) it trusts the
vision center, since there's no single "right element type" to snap to.

**Q. Would this work on a different website?**
Yes — give it any goal on the command line. The instruction describes a *method*,
not a page; `locate_element`/`read_screen` work on any site.

---

## 🧩 Tech stack

- **Language:** JavaScript (ESM), Node.js
- **Agent framework:** `@google/adk` (Google Agent Development Kit, TS/JS)
- **LLM:** Gemini (`gemini-3.5-flash`) for both reasoning and vision, via `@google/genai`
- **Browser automation:** Playwright (Chromium)
- **Validation:** Zod (tool parameter schemas)
