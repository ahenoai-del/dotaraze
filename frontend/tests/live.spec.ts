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
