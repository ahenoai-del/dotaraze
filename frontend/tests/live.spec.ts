import { test, expect } from '@playwright/test';

test('real backend, PostgreSQL and OpenDota reach the dashboard', async ({ page, request }) => {
  test.skip(process.env.RUN_LIVE_TESTS !== '1', 'Optional live integration: RUN_LIVE_TESTS=1, backend and internet required.');
  test.setTimeout(90_000);
  const api = process.env.LIVE_API_URL || 'http://localhost:8000/api';
  const health = await request.get(`${api}/health`);
  expect(health.ok()).toBe(true);
  expect((await health.json()).database).toBe('connected');
  const response = await request.get(`${api}/players/70388657/dashboard`, { timeout: 50_000 });
  expect(response.ok()).toBe(true);
  const data = await response.json();
  expect(data.source).toBe('OpenDota');
  expect(data.matches.length).toBeGreaterThan(0);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/dashboard?player=70388657');
  await expect(page.getByRole('heading', { name: data.profile.name, exact: true })).toBeVisible({ timeout: 50_000 });
  await expect(page.locator('.metric-card')).toHaveCount(4);
  await expect(page.locator('.metric-card').first().locator('strong')).toHaveText(`${data.summary.winrate.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`);
  await expect(page.locator('tbody tr')).toHaveCount(Math.min(8, data.matches.length));
  await expect(page.getByText('Демо-режим', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('real-dashboard.png'), fullPage: true });
});

test('real Meta Lab uses OpenDota and remains available without login', async ({ page, request }) => {
  test.skip(process.env.RUN_LIVE_TESTS !== '1', 'Optional live integration: RUN_LIVE_TESTS=1 required.');
  test.setTimeout(90_000);
  const api = process.env.LIVE_API_URL || 'http://localhost:8000/api';
  const response = await request.get(`${api}/meta/heroes`, { timeout: 50_000 });
  expect(response.ok()).toBe(true);
  const data = await response.json();
  expect(data.source).toBe('OpenDota /heroStats');
  expect(data.heroes.length).toBeGreaterThan(10);
  expect(data.total_picks).toBeGreaterThan(0);
  expect(data.heroes.every((hero: { winrate: number | null }) => hero.winrate == null || hero.winrate >= 0 && hero.winrate <= 100)).toBe(true);
  await page.goto('/meta');
  await expect(page.locator('.meta-summary .metric-card').first().locator('strong')).toHaveText(data.total_picks.toLocaleString('ru-RU'), { timeout: 50_000 });
  await expect(page.locator('tbody tr').first()).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Паблики' })).toHaveAttribute('aria-selected', 'true');
  await page.screenshot({ path: test.info().outputPath('real-meta-lab.png'), fullPage: true });
});
