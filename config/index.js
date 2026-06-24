import 'dotenv/config';

const bool = (v, fallback) =>
  v === undefined ? fallback : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
const num = (v, fallback) => (v === undefined ? fallback : Number(v));

export const config = {
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
  brainModel: process.env.BRAIN_MODEL || 'gemini-3.5-flash',
  visionModel: process.env.VISION_MODEL || 'gemini-3.5-flash',

  task:
    process.env.TASK ||
    'Go to https://ui.shadcn.com/docs/forms/react-hook-form. Find the Bug Report form. ' +
      'Fill the "Bug Title" field with a short, realistic bug title (at most 30 characters) ' +
      'and the "Description" field with a realistic description (at most 95 characters), ' +
      'then click the Submit button.',

  browser: {
    headless: bool(process.env.HEADLESS, false),
    slowMo: num(process.env.SLOW_MO, 80),
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    typingDelayMs: num(process.env.TYPING_DELAY_MS, 5),
    navTimeoutMs: num(process.env.NAV_TIMEOUT_MS, 45000),
  },

  screenshotDir: process.env.SCREENSHOT_DIR || 'screenshots',
  maxIterations: num(process.env.MAX_ITERATIONS, 40),
  taskTimeoutMs: num(process.env.TASK_TIMEOUT_MS, 300000),
};

export function assertConfig() {
  if (!config.geminiApiKey) {
    throw new Error(
      'Missing GEMINI_API_KEY. Copy .env.example to .env and paste your paid Gemini key.',
    );
  }
}

export default config;
