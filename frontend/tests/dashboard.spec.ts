import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: { error: { message: 'Войдите' } } }));
});

test('empty state, explicit demo, filters and responsive layout', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: /Каждый матч/ })).toBeVisible();
  await page.getByRole('button', { name: 'Посмотреть демо' }).click();
  await expect(page.getByText('Демо-режим', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Rise Player' })).toBeVisible();
  await expect(page.getByText('60%', { exact: true }).first()).toBeVisible();
  await page.getByLabel('Результат', { exact: true }).selectOption('win');
  await expect(page.locator('tbody tr')).toHaveCount(8);
  await expect(page.locator('tbody .loss')).toHaveCount(0);
  await page.getByLabel('Следующая страница').click();
  await expect(page.locator('tbody tr')).toHaveCount(4);
  await page.getByRole('button', { name: 'Сбросить' }).click();
  await page.getByLabel('Показатель графика').selectOption('kda');
  await expect(page.getByText('средний KDA по выборке')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(errors).toEqual([]);
});

test('invalid ID and upstream errors do not show invented data', async ({ page }) => {
  await page.route('**/api/players/123/dashboard', route => route.fulfill({ status: 503, json: { error: { message: 'OpenDota временно не отвечает.' } } }));
  await page.goto('/dashboard');
  await page.getByLabel('Steam ID или Dota Friend ID').fill('abc');
  await page.getByRole('button', { name: 'Найти игрока' }).click();
  await expect(page.getByRole('alert')).toContainText('Введите числовой');
  await page.getByLabel('Steam ID или Dota Friend ID').fill('123');
  await page.getByRole('button', { name: 'Найти игрока' }).click();
  await expect(page.getByRole('heading', { name: 'Не удалось загрузить профиль' })).toBeVisible();
  await expect(page.getByText('OpenDota временно не отвечает.')).toBeVisible();
  await expect(page.locator('.metrics-grid')).toHaveCount(0);
});

test('navigation and privacy work', async ({ page, isMobile }) => {
  await page.goto('/dashboard');
  if (isMobile) await page.getByRole('button', { name: 'Открыть меню' }).click();
  await page.getByRole('link', { name: 'Конфиденциальность' }).click();
  await expect(page.getByRole('heading', { name: 'Твои данные под контролем.' })).toBeVisible();
});

test('Steam errors are explained with a safe retry link', async ({ page }) => {
  await page.goto('/dashboard?auth_error=cancelled');
  await expect(page.getByRole('alert')).toContainText('Вход через Steam отменён');
  const link = page.getByRole('link', { name: 'Повторить вход' });
  await expect(link).toHaveAttribute('href', /\/api\/auth\/steam\/login$/);
  await page.getByRole('button', { name: 'Закрыть сообщение о входе' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page).not.toHaveURL(/auth_error/);
});

test('account can be deleted even when its public profile is unavailable', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ status: 200, json: { steam_id: '76561197960265851', account_id: 123, plan: 'free' } }));
  await page.route('**/api/players/123/dashboard', route => route.fulfill({ status: 404, json: { error: { message: 'Профиль недоступен' } } }));
  await page.route('**/api/auth/account', route => route.fulfill({ status: 204 }));
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Не удалось загрузить профиль' })).toBeVisible();
  await page.getByRole('button', { name: 'Удалить аккаунт', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Отмена' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Удалить аккаунт', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /Каждый матч/ })).toBeVisible();
});
