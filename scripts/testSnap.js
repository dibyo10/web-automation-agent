import browser from '../services/browser.js';
import logger from '../utils/logger.js';

const URL = 'https://ui.shadcn.com/docs/forms/react-hook-form';

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass });
  (pass ? logger.success : logger.error)(`${pass ? 'PASS' : 'FAIL'} — ${name}  ${detail}`);
};

async function main() {
  logger.banner('snapToInteractive test (no AI)');

  await browser.openBrowser();
  await browser.navigateToUrl(URL);
  await browser.scroll(450);
  await browser.page.waitForTimeout(500);

  const truth = await browser.page.evaluate(() => {
    const center = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    };
    const submit = [...document.querySelectorAll('button')].find(
      (b) => (b.textContent || '').trim().toLowerCase() === 'submit',
    );
    return {
      title: center(document.getElementById('form-rhf-demo-title')),
      desc: center(document.getElementById('form-rhf-demo-description')),
      submit: center(submit),
    };
  });
  logger.info(`ground-truth centers: ${JSON.stringify(truth)}`);

  if (!truth.title || !truth.desc || !truth.submit) {
    throw new Error('Form not fully in view — adjust the scroll amount in this test.');
  }

  const a = await browser.snapToInteractive(truth.title.x, truth.title.y + 110, 'input');
  check('title snap ignores textarea', a?.id === 'form-rhf-demo-title', JSON.stringify(a));

  const b = await browser.snapToInteractive(truth.desc.x, truth.desc.y - 20, 'textarea');
  check('description snaps to textarea', b?.id === 'form-rhf-demo-description', JSON.stringify(b));

  const c = await browser.snapToInteractive(truth.submit.x - 80, truth.submit.y, 'button', 'submit');
  check('submit snaps to Submit (not Reset)', (c?.label || '').toLowerCase().includes('submit'), JSON.stringify(c));

  await browser.close();

  const passed = results.filter((r) => r.pass).length;
  if (passed === results.length) logger.success(`ALL ${passed}/${results.length} snap tests passed.`);
  else {
    logger.error(`${passed}/${results.length} passed.`);
    process.exit(1);
  }
}

main().catch((err) => {
  logger.error(err.stack || err.message);
  process.exit(1);
});
