import browser from '../services/browser.js';
import logger from '../utils/logger.js';

const URL = process.argv[2] || 'https://ui.shadcn.com/docs/forms/react-hook-form';

async function main() {
  logger.banner('Browser service smoke test (no AI)');

  logger.step(1, 'open_browser');
  logger.toolResult('open_browser', await browser.openBrowser());

  logger.step(2, `navigate_to_url -> ${URL}`);
  logger.toolResult('navigate_to_url', await browser.navigateToUrl(URL));

  logger.step(3, 'take_screenshot');
  const shot = await browser.takeScreenshot('smoke-test');
  logger.toolResult('take_screenshot', {
    path: shot.path,
    width: shot.width,
    height: shot.height,
    base64Bytes: shot.base64.length,
  });

  logger.step(4, 'scroll + screenshot');
  await browser.scroll(500);
  const shot2 = await browser.takeScreenshot('smoke-test-after-scroll');
  logger.toolResult('take_screenshot', { path: shot2.path });

  logger.step(5, 'press_key + wait (new primitives)');
  logger.toolResult('press_key', await browser.pressKey('End'));
  logger.toolResult('wait', await browser.wait(500));

  logger.step(6, 'close');
  await browser.close();

  logger.success('Smoke test passed. Look in the screenshots/ folder.');
}

main().catch((err) => {
  logger.error(err.stack || err.message);
  process.exit(1);
});
