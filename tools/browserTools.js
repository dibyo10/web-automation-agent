import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import config from '../config/index.js';
import browser from '../services/browser.js';
import { getVision } from '../services/vision.js';
import logger from '../utils/logger.js';

function run(name, fn) {
  return async (args = {}) => {
    logger.toolCall(name, args);
    try {
      const result = await fn(args);
      logger.toolResult(name, result);
      return result;
    } catch (err) {
      const result = { status: 'error', error: err.message };
      logger.toolResult(name, result);
      return result;
    }
  };
}

function classifyTarget(description) {
  const d = description.toLowerCase();
  if (/description|textarea|multi.?line|message|comment|details/.test(d))
    return { kind: 'textarea', text: null, snap: true };
  if (/submit/.test(d)) return { kind: 'button', text: 'submit', snap: true };
  if (/reset/.test(d)) return { kind: 'button', text: 'reset', snap: true };
  if (/accept|agree|allow/.test(d)) return { kind: 'button', text: null, snap: true };
  if (/\bbutton\b/.test(d)) return { kind: 'button', text: null, snap: true };
  if (/search|input|textbox|email|username|password|\bfield\b|\btitle\b|\bname\b/.test(d))
    return { kind: 'input', text: null, snap: true };
  return { kind: 'any', text: null, snap: false };
}

export const openBrowserTool = new FunctionTool({
  name: 'open_browser',
  description:
    'Launch a fresh Chromium browser window. Must be called once before any other browser action.',
  execute: run('open_browser', () => browser.openBrowser()),
});

export const navigateTool = new FunctionTool({
  name: 'navigate_to_url',
  description: 'Point the open browser at a URL and wait for the page to load.',
  parameters: z.object({
    url: z.string().describe('The full URL to open, including https://'),
  }),
  execute: run('navigate_to_url', ({ url }) => browser.navigateToUrl(url)),
});

export const readScreenTool = new FunctionTool({
  name: 'read_screen',
  description:
    'Take a screenshot and get a concise TEXT description of what is currently visible (page content, dialogs, search boxes, buttons, lists of results). Use it to understand the page or check state when unsure. Optionally pass a specific question.',
  parameters: z.object({
    question: z
      .string()
      .optional()
      .describe('Optional question about the screen, e.g. "is there a cookie consent dialog?"'),
  }),
  execute: run('read_screen', async ({ question }) => {
    const shot = await browser.takeScreenshot('read');
    const description = await getVision().describe(shot, question);
    return { status: 'ok', description };
  }),
});

export const listElementsTool = new FunctionTool({
  name: 'list_elements',
  description:
    'Return the ordered (top-to-bottom) list of clickable items currently on the page — index, role, and label/title — as plain text, with NO screenshot. Use this to find a target or to COUNT items (e.g. to pick "the 5th video") instead of repeatedly reading the screen. Then act on the chosen item with locate_element + click_on_screen.',
  parameters: z.object({
    filter: z
      .string()
      .optional()
      .describe('Optional case-insensitive substring to keep only matching items, e.g. "highlights".'),
  }),
  execute: run('list_elements', async ({ filter }) => {
    let els = await browser.getInteractiveElements(80);
    if (filter) {
      const f = filter.toLowerCase();
      els = els.filter(
        (e) => (e.name || '').toLowerCase().includes(f) || (e.role || '').toLowerCase().includes(f),
      );
    }
    return {
      status: 'ok',
      count: els.length,
      elements: els.map((e) => ({ index: e.index, role: e.role, name: e.name, inView: e.inView })),
    };
  }),
});

export const locateTool = new FunctionTool({
  name: 'locate_element',
  description:
    'Look at the current screen and return the pixel (x, y) to click or type into for a described element, e.g. "the search input box", "the 5th video result counting from the top", or "the Submit button". Always call this right before click_on_screen. If found:false, scroll or read_screen and try again.',
  parameters: z.object({
    description: z
      .string()
      .describe('Plain-English description of the element to find on screen.'),
  }),
  execute: run('locate_element', async ({ description }) => {
    const vision = getVision();
    const vh = config.browser.viewport.height;

    const elements = await browser.getInteractiveElements();
    if (elements.length) {
      const idx = await vision.pickElement(elements, description);
      if (idx >= 0 && elements[idx]) {
        let el = elements[idx];
        if (el.y < vh * 0.12 || el.y > vh * 0.88) {
          await browser.scroll(Math.round(el.y - vh / 2));
          const after = await browser.getInteractiveElements();
          const match = after.find((e) => e.role === el.role && e.name === el.name);
          if (match) el = match;
        }
        return {
          found: true,
          x: el.x,
          y: el.y,
          via: 'dom',
          element: { role: el.role, name: el.name },
        };
      }
    }

    let shot = await browser.takeScreenshot('locate');
    let found = await vision.locate(shot, description);
    if (!found.found) return found;

    const edgeMargin = shot.height * 0.22;
    if (found.y < edgeMargin || found.y > shot.height - edgeMargin) {
      const delta = Math.round(found.y - shot.height / 2);
      await browser.scroll(delta);
      shot = await browser.takeScreenshot('locate-centered');
      const recentered = await vision.locate(shot, description);
      if (recentered.found) found = recentered;
    }

    const { kind, text, snap } = classifyTarget(description);
    if (snap) {
      const snapped = await browser.snapToInteractive(found.x, found.y, kind, text);
      if (snapped && snapped.dist <= 250) {
        found = { ...found, x: snapped.x, y: snapped.y, snappedTo: snapped };
      }
    }

    return { ...found, via: 'vision' };
  }),
});

export const clickTool = new FunctionTool({
  name: 'click_on_screen',
  description:
    'Left-click at an absolute pixel coordinate. Get the coordinate from locate_element first.',
  parameters: z.object({
    x: z.number().describe('X pixel coordinate (0 = left edge).'),
    y: z.number().describe('Y pixel coordinate (0 = top edge).'),
  }),
  execute: run('click_on_screen', ({ x, y }) => browser.clickOnScreen(x, y)),
});

export const doubleClickTool = new FunctionTool({
  name: 'double_click',
  description:
    'Double-click at a pixel coordinate, e.g. to select a word in a field before replacing it.',
  parameters: z.object({
    x: z.number().describe('X pixel coordinate.'),
    y: z.number().describe('Y pixel coordinate.'),
  }),
  execute: run('double_click', ({ x, y }) => browser.doubleClick(x, y)),
});

export const sendKeysTool = new FunctionTool({
  name: 'send_keys',
  description:
    'Type text into the field that currently has focus (i.e. the field you just clicked). Clears the field first by default. To submit a search after typing, call press_key("Enter").',
  parameters: z.object({
    text: z.string().describe('The text to type.'),
    clearFirst: z
      .boolean()
      .optional()
      .describe('Clear the field before typing. Defaults to true.'),
  }),
  execute: run('send_keys', ({ text, clearFirst }) =>
    browser.sendKeys(text, { clearFirst: clearFirst !== false }),
  ),
});

export const pressKeyTool = new FunctionTool({
  name: 'press_key',
  description:
    'Press a single keyboard key or combo, e.g. "Enter" to submit a search, "Escape", "Tab", "ArrowDown", "PageDown". Use "Enter" after typing in a search box.',
  parameters: z.object({
    key: z.string().describe('Key name, e.g. "Enter", "Escape", "Tab", "ArrowDown".'),
  }),
  execute: run('press_key', ({ key }) => browser.pressKey(key)),
});

export const scrollTool = new FunctionTool({
  name: 'scroll',
  description:
    'Scroll the page vertically by a pixel amount to reveal hidden elements. Positive = down, negative = up.',
  parameters: z.object({
    amount: z
      .number()
      .describe('Pixels to scroll. Positive scrolls down, negative scrolls up.'),
  }),
  execute: run('scroll', ({ amount }) => browser.scroll(amount)),
});

export const waitTool = new FunctionTool({
  name: 'wait',
  description:
    'Pause for a number of milliseconds to let a page load or new content appear, e.g. after navigating or clicking a link. Typical value: 2000.',
  parameters: z.object({
    ms: z.number().optional().describe('Milliseconds to wait (default 1500, max 15000).'),
  }),
  execute: run('wait', ({ ms }) => browser.wait(ms ?? 1500)),
});

export const takeScreenshotTool = new FunctionTool({
  name: 'take_screenshot',
  description:
    'Capture the current browser viewport as a PNG saved to disk. Use it to record the final result. Returns the file path and image size, not the pixels.',
  parameters: z.object({
    label: z.string().optional().describe('Short label for the file name, e.g. "done".'),
  }),
  execute: run('take_screenshot', async ({ label }) => {
    const shot = await browser.takeScreenshot(label || 'screenshot');
    return { status: shot.status, path: shot.path, width: shot.width, height: shot.height };
  }),
});

export const browserTools = [
  openBrowserTool,
  navigateTool,
  readScreenTool,
  listElementsTool,
  locateTool,
  clickTool,
  doubleClickTool,
  sendKeysTool,
  pressKeyTool,
  scrollTool,
  waitTool,
  takeScreenshotTool,
];

export default browserTools;
