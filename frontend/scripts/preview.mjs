import { chromium, devices } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../../.local/screenshots/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  for (const [name, width, height, route] of [
    ['welcome', 1440, 1050, '/dashboard'],
    ['dashboard', 1440, 1100, '/dashboard?demo=1'],
    ['mobile', 390, 844, '/dashboard?demo=1'],
  ]) {
    const page = await browser.newPage(name === 'mobile' ? { ...devices['iPhone 13'] } : { viewport: { width, height }, deviceScaleFactor: 1 });
    await page.goto(`http://localhost:5173${route}`);
    await page.locator(name === 'welcome' ? '.welcome-hero' : '.match-panel').waitFor();
    await page.waitForFunction(() => [...document.images].every(img => img.complete), null, { timeout: 15000 }).catch(() => {});
    console.log(name, 'images:', await page.evaluate(() => [...document.images].map(img => ({ loaded: img.naturalWidth > 0, host: new URL(img.src).hostname }))));
    await page.screenshot({ path: `${output}/${name}.png`, fullPage: true, animations: 'disabled' });
    await page.close();
  }
  console.log(`Screenshots: ${output}`);
} finally { await browser.close(); }
