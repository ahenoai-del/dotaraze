import { chromium, devices } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../../.local/screenshots/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const scenes = [
    ['welcome', 1440, 1050, '/dashboard'],
    ['dashboard', 1440, 1100, '/dashboard?demo=1'],
    ['mobile', 390, 844, '/dashboard?demo=1'],
    ['meta', 1440, 1100, '/meta'],
    ['meta-mobile', 390, 844, '/meta'],
  ];
  for (const [name, width, height, route] of scenes.filter(scene => !process.argv.includes('--meta-only') || scene[0].startsWith('meta'))) {
    const page = await browser.newPage(name.endsWith('mobile') ? { ...devices['iPhone 13'] } : { viewport: { width, height }, deviceScaleFactor: 1 });
    await page.goto(`${process.env.PREVIEW_BASE_URL || 'http://localhost:5173'}${route}`);
    await page.locator(name.startsWith('meta') ? '.meta-table-panel' : name === 'welcome' ? '.welcome-hero' : '.match-panel').waitFor();
    await page.evaluate(() => { for (const img of document.images) img.loading = 'eager'; });
    await page.waitForFunction(() => [...document.images].every(img => img.complete), null, { timeout: 15000 }).catch(() => {});
    console.log(name, 'loaded images:', await page.evaluate(() => [...document.images].filter(img => img.naturalWidth > 0).length));
    await page.screenshot({ path: `${output}/${name}.png`, fullPage: true, animations: 'disabled' });
    await page.close();
  }
  console.log(`Screenshots: ${output}`);
} finally { await browser.close(); }
