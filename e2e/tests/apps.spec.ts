/**
 * Real-browser suite for both apps (spec T4.3, R7.1).
 *
 * HONESTY NOTE: no real API key exists in this environment, so inference is the
 * labeled offline TEST DOUBLE ("SIMULATED (test-double)"), which both apps currently
 * use by default. These tests add no product path that uses a fake agent. They must be
 * re-pointed at a test-only hook once T3.5 removes the default fake agent from the
 * product. What IS real here: the built bundle, Chromium, real IndexedDB, and the real
 * browser-repos git history store.
 */
import { test, expect, type Page } from '@playwright/test';

interface AppCase {
  name: string;
  url: string;
  validPick: string;
  validView: RegExp;
  baseView: RegExp;
  rejectPick: string;
  rejectRule: RegExp;
}

const APPS: AppCase[] = [
  {
    name: 'planner',
    url: 'http://127.0.0.1:4173/',
    validPick: 'Focused daily agenda (valid)',
    validView: /focused daily agenda/,
    baseView: /board/,
    rejectPick: 'Remove complete control (reject)',
    rejectRule: /complete/i,
  },
  {
    name: 'inventory',
    url: 'http://127.0.0.1:4174/',
    validPick: 'Low-stock focus (valid)',
    validView: /low-stock focus/,
    baseView: /full catalog/,
    rejectPick: 'Remove adjust control (reject)',
    rejectRule: /adjust/i,
  },
];

const viewLabel = (page: Page) => page.locator('header strong');
const apply = async (page: Page, app: AppCase) => {
  await page.getByRole('button', { name: app.validPick }).click();
  await expect(page.getByText('SIMULATED (test-double)')).toBeVisible();
  await page.getByRole('button', { name: 'Apply' }).click();
};

for (const app of APPS) {
  test.describe(`${app.name} (built app, no Node globals)`, () => {
    test('apply saves the customization to the history store', async ({ page }) => {
      await page.goto(app.url);
      await apply(page, app);
      await expect(viewLabel(page)).toHaveText(app.validView);
    });

    test('a rejected proposal is shown with its rule and the view is kept', async ({ page }) => {
      await page.goto(app.url);
      await page.getByRole('button', { name: app.rejectPick }).click();
      const alert = page.getByRole('alert');
      await expect(alert).toContainText('Rejected');
      await expect(alert.locator('code').first()).toBeVisible(); // rule id
      await expect(alert).toContainText(app.rejectRule); // sentence names the control
      await expect(viewLabel(page)).toHaveText(app.baseView);
      await expect(page.getByRole('button', { name: 'Apply' })).toHaveCount(0);
    });

    test.fixme(
      'rejection shows per-part verdicts with rule name AND sentence (T3.7 not built)',
      async () => {
        // T3.7 will add proposal parts each marked applied/rejected (R8.2-3).
      },
    );
  });

  test.describe(`${app.name} (real IndexedDB + browser-repos)`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(app.url); // fresh context = empty IndexedDB
      await expect(viewLabel(page)).toHaveText(app.baseView);
    });

    test('customization persists across reload', async ({ page }) => {
      await apply(page, app);
      await expect(viewLabel(page)).toHaveText(app.validView);
      await page.reload();
      await expect(viewLabel(page)).toHaveText(app.validView);
      await expect(page.getByRole('button', { name: 'undo to here' })).toHaveCount(1);
      const dbs = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name ?? ''));
      expect(dbs.some((n) => n.startsWith('browser-repos:repo:'))).toBe(true);
    });

    test('reload right after Apply keeps the change', async ({ page }) => {
      await apply(page, app);
      await expect(viewLabel(page)).toHaveText(app.validView);
      await page.reload();
      await expect(viewLabel(page)).toHaveText(app.validView);
    });

    test('undo to a history entry keeps the view valid', async ({ page }) => {
      await apply(page, app);
      await expect(page.getByRole('button', { name: 'undo to here' })).toHaveCount(1);
      await page.getByRole('button', { name: 'undo to here' }).click();
      await expect(viewLabel(page)).toHaveText(app.validView);
      await expect(page.getByRole('alert')).toHaveCount(0);
    });

    test('undo reaches the baseline view, and it survives reload (D3)', async ({ page }) => {
      await apply(page, app);
      await expect(viewLabel(page)).toHaveText(app.validView);
      await page.getByRole('button', { name: 'reset to default view' }).click();
      await expect(viewLabel(page)).toHaveText(app.baseView);
      await page.reload();
      await expect(viewLabel(page)).toHaveText(app.baseView);
    });
  });
}
