import { test, expect } from '@playwright/test';
import { demoDashboard, demoHeroes } from '../src/features/dashboard/demo';

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

test('search follows browser history', async ({ page }) => {
  await page.route('**/api/players/*/dashboard', route => route.fulfill({ json: demoDashboard }));
  await page.route('**/api/heroes', route => route.fulfill({ json: demoHeroes }));
  await page.goto('/dashboard?player=123');
  const input = page.getByLabel('Steam ID или Dota Friend ID');
  await expect(input).toHaveValue('123');
  await input.fill('456');
  await page.getByRole('button', { name: 'Найти игрока' }).click();
  await expect(page).toHaveURL(/player=456/);
  await page.goBack();
  await expect(input).toHaveValue('123');
  await page.goForward();
  await expect(input).toHaveValue('456');
});

test('demo date filters use the sample period and leaving demo clears the search', async ({ page }) => {
  await page.goto('/dashboard?demo=1');
  await page.getByLabel('Период', { exact: true }).selectOption('7');
  await expect(page.locator('tbody tr')).toHaveCount(8);
  await page.getByLabel('Следующая страница', { exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await expect(page.getByText(/В демо период отсчитывается/)).toBeVisible();
  await page.getByLabel('Steam ID или Dota Friend ID').fill('456');
  await page.getByRole('button', { name: 'Выйти из демо' }).click();
  await expect(page.getByLabel('Steam ID или Dota Friend ID')).toHaveValue('');
});

test('mobile navigation keeps keyboard focus visible and closes on Escape', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile drawer behavior');
  await page.goto('/dashboard?demo=1');
  await expect(page.locator('#main-sidebar')).toHaveAttribute('inert', '');
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toBeFocused();
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('.mobile-header').getByRole('button', { name: 'Закрыть меню' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Открыть меню' })).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  await page.getByRole('link', { name: 'Meta Lab', exact: true }).click();
  await expect(page).toHaveURL(/\/meta$/);
  await expect(page.getByRole('button', { name: 'Открыть меню' })).toHaveAttribute('aria-expanded', 'false');
});

test('proxy error bodies and invalid success JSON have readable errors', async ({ page }) => {
  await page.route('**/api/players/123/dashboard', route => route.fulfill({ status: 503, body: 'null', contentType: 'application/json' }));
  await page.goto('/dashboard?player=123');
  await expect(page.getByRole('alert')).toContainText('Не удалось загрузить данные. Попробуйте позже.');
  await page.route('**/api/players/123/dashboard', route => route.fulfill({ status: 200, body: '<html>Proxy error</html>', contentType: 'text/html' }));
  await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Сервер вернул некорректный ответ');
  await expect(page.locator('.metrics-grid')).toHaveCount(0);
});

test('unknown lobby is not classified as another mode and missing results stay unknown', async ({ page }) => {
  const matches = demoDashboard.matches.slice(0, 3).map((match, index) => ({ ...match, lobby_type: [null, 0, 7][index], won: null }));
  await page.route('**/api/players/123/dashboard', route => route.fulfill({ json: { ...demoDashboard, matches } }));
  await page.route('**/api/heroes', route => route.fulfill({ json: demoHeroes }));
  await page.goto('/dashboard?player=123');
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await expect(page.locator('tbody .unknown')).toHaveCount(3);
  await page.getByLabel('Режим', { exact: true }).selectOption('other');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).not.toContainText('Режим неизвестен');
});

test('pending account deletion cannot be dismissed with Escape and can recover from error', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ json: { steam_id: '76561197960265851', account_id: 123, plan: 'free' } }));
  await page.route('**/api/players/123/dashboard', route => route.fulfill({ status: 404, json: { error: { message: 'Недоступен' } } }));
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  await page.route('**/api/auth/account', async route => { await pending; await route.fulfill({ status: 503, json: { error: { message: 'Повторите удаление позже' } } }); });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Удалить аккаунт', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Удалить аккаунт', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Отмена' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  finish();
  await expect(dialog.getByRole('alert')).toContainText('Повторите удаление позже');
  await dialog.getByRole('button', { name: 'Отмена' }).click();
  await expect(dialog).toHaveCount(0);
});
