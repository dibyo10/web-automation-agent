import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import config from '../config/index.js';
import logger from '../utils/logger.js';

export class BrowserService {
  constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
    this.screenshotCount = 0;
  }

  _requirePage() {
    if (!this.page) {
      throw new Error('No page is open. Call open_browser first.');
    }
    return this.page;
  }

  async openBrowser() {
    if (this.browser) {
      return { status: 'already_open', message: 'Browser already running.' };
    }

    this.browser = await chromium.launch({
      headless: config.browser.headless,
      slowMo: config.browser.slowMo,
    });

    this.context = await this.browser.newContext({
      viewport: config.browser.viewport,
      deviceScaleFactor: config.browser.deviceScaleFactor,
    });

    this.page = await this.context.newPage();

    return {
      status: 'ok',
      message: 'Browser launched.',
      viewport: config.browser.viewport,
    };
  }

  async navigateToUrl(url) {
    const page = this._requirePage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: config.browser.navTimeoutMs });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    return { status: 'ok', url: page.url(), title: await page.title() };
  }

  async takeScreenshot(label = 'screenshot') {
    const page = this._requirePage();
    await mkdir(config.screenshotDir, { recursive: true });

    this.screenshotCount += 1;
    const safe = label.replace(/[^a-z0-9-_]/gi, '_');
    const file = path.join(
      config.screenshotDir,
      `${String(this.screenshotCount).padStart(2, '0')}-${safe}.png`,
    );

    const buffer = await page.screenshot({ path: file, fullPage: false });
    const { width, height } = page.viewportSize();

    return {
      status: 'ok',
      path: file,
      base64: buffer.toString('base64'),
      width,
      height,
    };
  }

  async clickOnScreen(x, y) {
    const page = this._requirePage();
    await page.mouse.move(x, y);
    await page.mouse.click(x, y);
    return { status: 'ok', clicked: { x, y } };
  }

  async doubleClick(x, y) {
    const page = this._requirePage();
    await page.mouse.move(x, y);
    await page.mouse.dblclick(x, y);
    return { status: 'ok', doubleClicked: { x, y } };
  }

  async sendKeys(text, { clearFirst = true } = {}) {
    const page = this._requirePage();

    const focusedTag = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const tag = (el.tagName || '').toLowerCase();
      return tag === 'input' || tag === 'textarea' || el.isContentEditable ? tag : null;
    });
    if (!focusedTag) {
      return {
        status: 'error',
        error:
          'No editable field is focused — the previous click missed. Call locate_element again and click the returned (x, y) before send_keys.',
      };
    }

    if (clearFirst) {

      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.press('Backspace');
    }
    await page.keyboard.type(text, { delay: config.browser.typingDelayMs });
    return { status: 'ok', typed: text, focusedElement: focusedTag };
  }

  async scroll(deltaY = 600, deltaX = 0) {
    const page = this._requirePage();
    await page.mouse.wheel(deltaX, deltaY);
    await page.waitForTimeout(400);
    return { status: 'ok', scrolledBy: { deltaX, deltaY } };
  }

  async pressKey(key) {
    const page = this._requirePage();
    await page.keyboard.press(key);
    await page.waitForTimeout(300);
    return { status: 'ok', pressed: key };
  }

  async wait(ms = 1500) {
    const page = this._requirePage();
    const clamped = Math.min(Math.max(Number(ms) || 0, 0), 15000);
    await page.waitForTimeout(clamped);
    return { status: 'ok', waitedMs: clamped };
  }

  async readValueAt(x, y) {
    const page = this._requirePage();
    return page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      return el.value ?? el.textContent ?? null;
    }, { x, y });
  }

    async snapToInteractive(x, y, kind = 'any', text = null) {
    const page = this._requirePage();
    return page.evaluate(({ x, y, kind, text }) => {
      const sel = 'input, textarea, button, select, [role="button"], a[href]';
      const vh = window.innerHeight;
      const vw = window.innerWidth;

      const visible = [...document.querySelectorAll(sel)].filter((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.width > 1 && r.height > 1 &&
          r.bottom > 0 && r.top < vh &&
          r.right > 0 && r.left < vw
        );
      });

      const tagOf = (el) => el.tagName.toLowerCase();
      const isKind = (el) => {
        if (kind === 'any') return true;
        if (kind === 'input') return tagOf(el) === 'input';
        if (kind === 'textarea') return tagOf(el) === 'textarea';
        if (kind === 'button')
          return tagOf(el) === 'button' || el.type === 'submit' || el.getAttribute('role') === 'button';
        return true;
      };
      const labelOf = (el) =>
        (el.textContent || el.value || el.placeholder || el.getAttribute('aria-label') || '').trim();

      let pool = visible.filter(isKind);
      if (text) {
        const t = text.toLowerCase();
        const byText = pool.filter((el) => labelOf(el).toLowerCase().includes(t));
        if (byText.length) pool = byText;
      }
      if (!pool.length) pool = visible;

      let best = null;
      let bestD = Infinity;
      for (const el of pool) {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const d = (cx - x) ** 2 + (cy - y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = {
            x: Math.round(cx),
            y: Math.round(cy),
            tag: tagOf(el),
            id: el.id || null,
            label: labelOf(el).slice(0, 40),
            dist: Math.round(Math.sqrt(d)),
          };
        }
      }
      return best;
    }, { x, y, kind, text });
  }

  async getInteractiveElements(limit = 60) {
    const page = this._requirePage();
    return page.evaluate((limit) => {
      const SEL = [
        'a[href]', 'button', 'input:not([type="hidden"])', 'textarea', 'select',
        '[role="button"]', '[role="link"]', '[role="tab"]', '[role="menuitem"]',
        '[role="option"]', '[role="checkbox"]', '[contenteditable=""]',
        '[contenteditable="true"]', 'summary',
      ].join(', ');
      const vh = window.innerHeight;
      const vw = window.innerWidth;

      const labelFor = (el) => {
        if (el.labels && el.labels.length) return el.labels[0].innerText || '';
        const lb = el.getAttribute('aria-labelledby');
        if (lb) {
          const n = document.getElementById(lb);
          if (n) return n.innerText || '';
        }
        return '';
      };

      const out = [];
      const seen = new Set();
      for (const el of document.querySelectorAll(SEL)) {
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        if (r.right < 0 || r.left > vw) continue;
        const s = getComputedStyle(el);
        if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) continue;

        const isField = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
        const img = el.querySelector ? el.querySelector('img') : null;
        const raw =
          el.getAttribute('aria-label') ||
          labelFor(el) ||
          (isField ? (el.value || el.placeholder) : '') ||
          el.innerText || el.textContent || el.title || (img ? img.alt : '') || '';
        const name = String(raw).replace(/\s+/g, ' ').trim().slice(0, 90);
        const role = el.getAttribute('role') || el.tagName.toLowerCase();

        const key = role + '|' + name + '|' + Math.round(r.top / 8);
        if (seen.has(key)) continue;
        seen.add(key);

        out.push({
          role,
          tag: el.tagName.toLowerCase(),
          name,
          x: Math.round(r.left + r.width / 2),
          y: Math.round(r.top + r.height / 2),
          top: Math.round(r.top),
          inView: r.top >= 0 && r.bottom <= vh,
        });
      }

      out.sort((a, b) => a.top - b.top);
      const sliced = out.slice(0, limit);
      sliced.forEach((e, i) => (e.index = i));
      return sliced;
    }, limit);
  }

  async getFilledFields() {
    const page = this._requirePage();
    return page.evaluate(() => {
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const skip = new Set([
        'hidden', 'checkbox', 'radio', 'submit', 'button',
        'reset', 'file', 'image', 'range', 'color',
      ]);
      const inView = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
      };

      const fields = [...document.querySelectorAll('input, textarea')]
        .filter((el) => el.tagName.toLowerCase() === 'textarea' || !skip.has((el.type || 'text').toLowerCase()))
        .filter(inView)
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          name: el.name || null,
          placeholder: el.placeholder || null,
          value: (el.value || '').trim(),
        }))
        .filter((f) => f.value.length > 0);

      const toast = document.querySelector('[data-sonner-toast], [role="status"]');
      return { fields, toastText: toast ? (toast.textContent || '').trim().slice(0, 200) : null };
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = this.context = this.page = null;
      logger.dim('Browser closed.');
    }
    return { status: 'ok' };
  }
}

export const browser = new BrowserService();
export default browser;
