(async () => {
const { chromium } = require('playwright');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = process.argv[2];
const times = process.argv.slice(3).map(Number);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', e => console.error('PAGE ERROR', e.message));
await page.goto('file://' + root + '/composition.html');
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
for (const t of times) {
  await page.evaluate(t => window.render(t), t);
  await page.screenshot({ path: `${out}/f_${t.toFixed(2)}.jpg`, type: 'jpeg', quality: 80 });
}
await browser.close();
})();
