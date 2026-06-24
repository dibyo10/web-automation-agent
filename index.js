import {
  InMemoryRunner,
  getFunctionCalls,
  isFinalResponse,
} from '@google/adk';

import config, { assertConfig } from './config/index.js';
import rootAgent from './agents/automationAgent.js';
import browser from './services/browser.js';
import logger from './utils/logger.js';

const APP_NAME = 'web-auto-agent';
const USER_ID = 'student';
const SESSION_ID = 'viva-demo';

function extractText(event) {
  const parts = event?.content?.parts || [];
  return parts
    .map((p) => p.text)
    .filter(Boolean)
    .join(' ')
    .trim();
}

async function main() {
  assertConfig();

  const goal = process.argv.slice(2).join(' ').trim() || config.task;

  logger.banner('Web Automation Agent — Google ADK + Gemini + Playwright');
  logger.info(`Brain model : ${config.brainModel}`);
  logger.info(`Vision model: ${config.visionModel}`);
  logger.info(`Headless    : ${config.browser.headless}`);
  logger.step('GOAL', goal);

  const runner = new InMemoryRunner({ agent: rootAgent, appName: APP_NAME });

  await runner.sessionService.createSession({
    appName: APP_NAME,
    userId: USER_ID,
    sessionId: SESSION_ID,
  });

  const abortSignal = AbortSignal.timeout(config.taskTimeoutMs);

  try {
    for await (const event of runner.runAsync({
      userId: USER_ID,
      sessionId: SESSION_ID,
      newMessage: { role: 'user', parts: [{ text: goal }] },
      abortSignal,
    })) {
      const text = extractText(event);
      const calls = getFunctionCalls(event);

      if (text && calls.length === 0) {
        if (isFinalResponse(event)) logger.success('Agent finished.');
        logger.model(text);
      }
    }

    try {
      const shot = await browser.takeScreenshot('final');
      logger.info(`Final screenshot: ${shot.path}`);
    } catch {
      void 0;
    }
  } catch (err) {
    if (err?.name === 'TimeoutError' || /abort/i.test(err?.message || '')) {
      logger.warn(`Task hit the ${config.taskTimeoutMs}ms time limit and was stopped.`);
    } else {
      throw err;
    }
  } finally {
    await browser.close();
  }

  logger.info(`Screenshots saved in: ${config.screenshotDir}/`);
}

main().catch((err) => {
  logger.error(err.stack || err.message);
  process.exit(1);
});
