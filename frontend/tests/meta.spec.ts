import { test, expect } from '@playwright/test';

function sample(mode = 'pub', bracket = 'all') {
  const heroes = Array.from({ length: 15 }, (_, index) => {
    const id = index + 1;
    const picks = id === 3 ? 20 : 10000;
    const wins = id === 1 ? bracket === '1' ? 4000 : 6000 : id === 3 ? 20 : 5000;
    return { id, name: id === 1 ? 'Anti-Mage' : id === 2 ? 'Juggernaut' : id === 3 ? 'Crystal Maiden' : `Hero ${id}`,
      image: null, primary_attr: id === 3 ? 'int' : id === 15 ? 'all' : 'agi', attack_type: 'Melee', roles: id === 3 ? ['Support'] : ['Carry'],
      picks, wins, winrate: wins / picks * 100, pick_share: picks / 140020 * 100, pickrate: picks / 140020 * 1000,
      confidence_low: id === 3 ? 83.89 : id === 1 ? 59.04 : 49.02, confidence_high: id === 3 ? 100 : id === 1 ? 60.96 : 50.98, bans: null,
    };
  });
  return { mode, bracket, heroes, total_picks: 140020, distribution_complete: true, available_brackets: ['1', '7'],
    fetched_at: '2026-10-14T12:00:00Z', source: 'OpenDota /heroStats', source_url: 'https://docs.opendota.com/',
    period: 'Границы периода и патч выборки источник не передаёт.', pickrate_method: 'Оценка из 10 слотов.', notices: ['Теги не являются позициями в матче.'] };
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/meta/heroes**', route => {
    const url = new URL(route.request().url());
    return route.fulfill({ json: sample(url.searchParams.get('mode') || 'pub', url.searchParams.get('bracket') || 'all') });
  });
  await page.route('**/api/meta/patches', route => route.fulfill({ json: {
    patches: [{ id: 60, name: '7.41', date: '2026-03-24T00:00:00Z' }], fetched_at: '2026-10-14T12:00:00Z', source: 'OpenDota', notice: 'Справочник может отставать.',
  } }));
});

test('filters preserve the global sample and expose small samples explicitly', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/meta');
  await expect(page.getByRole('heading', { name: 'Meta Lab.' })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(14);
  await page.locator('.meta-chart-panel .recharts-scatter-symbol').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Закрыть детали героя' }).click();
  await expect(page.locator('.meta-recommendations').getByRole('button', { name: 'Crystal Maiden', exact: true })).toHaveCount(0);
  const denominator = await page.locator('.meta-summary .metric-card').first().locator('strong').innerText();
  await page.getByLabel('Тег героя', { exact: true }).selectOption('Support');
  await expect(page.getByRole('heading', { name: 'Нет героев для этих условий' })).toBeVisible();
  await page.getByLabel('Минимальная выборка').selectOption('0');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).toContainText('Crystal Maiden');
  await expect(page.locator('.meta-summary .metric-card').first().locator('strong')).toHaveText(denominator);
  await page.locator('tbody').getByRole('button', { name: 'Подробнее о Crystal Maiden' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('20');
  await expect(dialog).toContainText('Wilson показывает неопределённость');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.locator('.meta-filter-bar').getByRole('button', { name: 'Сбросить' }).click();
  await page.getByLabel('Атрибут героя').selectOption('all');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).toContainText('Hero 15');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(errors).toEqual([]);
});

test('pool persists and changing datasets resets unsupported rank filters', async ({ page }) => {
  await page.goto('/meta');
  await page.locator('.meta-recommendations').getByRole('button', { name: 'Добавить Anti-Mage в пул' }).click();
  await expect(page.getByRole('region', { name: 'Сохранённый пул' })).toContainText('Anti-Mage');
  await page.reload();
  await expect(page.getByRole('region', { name: 'Сохранённый пул' })).toContainText('Anti-Mage');
  await page.getByLabel('Ранг меты').selectOption('1');
  await expect(page).toHaveURL(/bracket=1/);
  await expect(page.locator('tbody tr').filter({ hasText: 'Anti-Mage' })).toContainText('40%');
  await page.getByRole('tab', { name: 'Про-сцена' }).click();
  await expect(page).toHaveURL(/mode=pro&bracket=all/);
  await expect(page.getByLabel('Ранг меты')).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Сохранённый пул' })).toContainText('Anti-Mage');
  await page.getByRole('region', { name: 'Сохранённый пул' }).getByRole('button', { name: 'Убрать Anti-Mage из пула' }).click();
  await expect(page.getByRole('region', { name: 'Сохранённый пул' })).toContainText('Добавь до пяти героев');
});

test('upstream failure is not replaced by demo statistics; patches fail independently', async ({ page }) => {
  await page.route('**/api/meta/heroes**', route => route.fulfill({ status: 503, json: { error: { message: 'OpenDota недоступен' } } }));
  await page.goto('/meta');
  await expect(page.getByRole('heading', { name: 'Мета временно недоступна' })).toBeVisible();
  await expect(page.locator('.meta-summary')).toHaveCount(0);
  await page.route('**/api/meta/heroes**', route => route.fulfill({ json: sample() }));
  await page.route('**/api/meta/patches', route => route.fulfill({ status: 503, json: { error: { message: 'Патчи недоступны' } } }));
  await page.reload();
  await expect(page.locator('tbody tr')).toHaveCount(14);
  await expect(page.getByText('Справочник сейчас недоступен. Мета работает независимо от него.')).toBeVisible();
});

test('hero pool synchronizes across browser tabs and handles corrupted storage', async ({ page, context }) => {
  await page.addInitScript(() => localStorage.setItem('dotarise_hero_pool_v1', '[1,1,-2,true,9007199254740992]'));
  await page.goto('/meta');
  const pool = page.getByRole('region', { name: 'Сохранённый пул' });
  await expect(pool).toContainText('1/5');
  const other = await context.newPage();
  // A same-origin tab updates storage without using this page's React state.
  await other.goto('/privacy');
  await other.evaluate(() => localStorage.setItem('dotarise_hero_pool_v1', '[2]'));
  await expect(pool).toContainText('Juggernaut');
  await expect(pool).not.toContainText('Anti-Mage');
  await other.evaluate(() => localStorage.clear());
  await expect(pool).toContainText('0/5');
  await other.close();
});
