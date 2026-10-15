import { test, expect } from '@playwright/test';
import { demoDashboard, demoHeroes } from '../src/features/dashboard/demo';

function detail(id = 123) {
  return { match_id: id, start_time: 1700000000, duration: 120, radiant_win: true, radiant_score: 8, dire_score: 0,
    game_mode: 22, lobby_type: 7, parsed: true, notices: [], fetched_at: '2026-10-15T00:00:00Z', source: 'OpenDota', source_url: `https://www.opendota.com/matches/${id}`,
    advantage: [{ seconds: 0, gold: 0, xp: 0 }, { seconds: 60, gold: -500, xp: null }, { seconds: 120, gold: 1000, xp: 20 }],
    players: [0, 128].map((slot, i) => ({ player_slot: slot, side: i ? 'dire' : 'radiant', account_id: i ? null : 123, name: i ? null : 'Selected Player',
      hero_id: 1, kills: i ? null : 0, deaths: 0, assists: 4, gold_per_min: 500, xp_per_min: 600, hero_damage: 1000, tower_damage: null,
      hero_healing: 0, items: [1, 0, null, 0, 0, 0], backpack: [0, 0, 0], neutral_item: null })) };
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: { error: { message: 'Войдите' } } }));
  await page.route('**/api/heroes', route => route.fulfill({ json: demoHeroes }));
  await page.route('**/api/match-items', route => route.fulfill({ json: [{ id: 1, name: 'Blink Dagger', image: null }] }));
  await page.route('**/api/matches/*', route => route.fulfill({ json: detail(Number(route.request().url().split('/').pop())) }));
});

test('history opens details and restores filters and pagination after reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/players/123/dashboard', route => route.fulfill({ json: { ...demoDashboard, profile: { ...demoDashboard.profile, account_id: 123 } } }));
  await page.goto('/dashboard?player=123');
  await page.getByLabel('Результат', { exact: true }).selectOption('win');
  await page.getByLabel('Следующая страница', { exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(4);
  const first = page.getByRole('link', { name: /^Открыть матч/ }).first();
  const href = await first.getAttribute('href');
  await first.click();
  await expect(page.getByRole('heading', { name: 'Победа Radiant' })).toBeVisible();
  await expect(page.getByRole('row', { name: 'Выбранный игрок' })).toContainText('Selected Player');
  await expect(page.getByRole('img', { name: 'График преимущества Radiant' })).toBeVisible();
  await expect(page.getByLabel('Blink Dagger').first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Победа Radiant' })).toBeVisible();
  await page.getByRole('link', { name: 'Вернуться к истории' }).click();
  await expect(page.getByLabel('Результат', { exact: true })).toHaveValue('win');
  await expect(page).toHaveURL(/page=1/);
  await expect(page.locator('tbody tr')).toHaveCount(4);
  await expect(page.getByRole('link', { name: /^Открыть матч/ }).first()).toHaveAttribute('href', href!);
  expect(errors).toEqual([]);
});

test('partial match has unknown fields, no invented graph, and independent catalogs', async ({ page }) => {
  await page.route('**/api/matches/*', route => route.fulfill({ json: { ...detail(), radiant_win: null, duration: null, start_time: null, parsed: false, advantage: [] } }));
  await page.route('**/api/match-items', route => route.fulfill({ status: 503, json: { error: { message: 'Unavailable' } } }));
  await page.goto('/matches/123?from=https://example.com');
  await expect(page.getByRole('heading', { name: 'Результат неизвестен' })).toBeVisible();
  await expect(page.getByText('Матч не разобран:', { exact: false })).toBeVisible();
  await expect(page.getByText('Источник не предоставил временной ряд. График не строится.')).toBeVisible();
  await expect(page.locator('.selected-player')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Вернуться к истории' })).toHaveAttribute('href', '/dashboard');
  await expect(page.getByLabel('Предмет #1').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('invalid IDs do not request API and transient errors can be retried', async ({ page }) => {
  const calls: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/matches/')) calls.push(request.url()); });
  await page.goto('/matches/no');
  await expect(page.getByRole('heading', { name: 'Некорректный ID матча' })).toBeVisible();
  expect(calls).toEqual([]);
  await page.route('**/api/matches/*', route => route.fulfill({ status: 404, json: { error: { message: 'Матч не найден' } } }));
  await page.goto('/matches/123');
  await expect(page.getByRole('alert')).toContainText('Матч не найден');
  await page.route('**/api/matches/*', route => route.fulfill({ json: detail() }));
  await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Победа Radiant' })).toBeVisible();
});

test('demo has no match-detail links or match API calls', async ({ page }) => {
  const calls: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/matches/')) calls.push(request.url()); });
  await page.goto('/dashboard?demo=1');
  await expect(page.locator('tbody tr')).toHaveCount(8);
  await expect(page.getByRole('link', { name: /^Открыть матч/ })).toHaveCount(0);
  expect(calls).toEqual([]);
  await page.goto('/matches/9000000000?demo=1');
  await expect(page.getByRole('heading', { name: 'Детали недоступны в демо-режиме' })).toBeVisible();
  expect(calls).toEqual([]);
});
