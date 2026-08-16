import { expect, test, type Page } from '@playwright/test';

function collectRuntimeErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    const source = message.location().url;
    // Browsers request a conventional favicon even though this prototype does not ship one.
    if (source.endsWith('/favicon.ico')) return;
    if (message.type() === 'error') errors.push(`console${source ? ` (${source})` : ''}: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  return errors;
}

async function openPrototype(page: Page) {
  await page.addInitScript(() => {
    const originalGetRandomValues = crypto.getRandomValues.bind(crypto);
    Object.defineProperty(crypto, 'getRandomValues', {
      configurable: true,
      value(array: ArrayBufferView) {
        if (array instanceof Uint32Array && array.length === 2) {
          array[0] = 1;
          array[1] = 2;
          return array;
        }
        return originalGetRandomValues(array);
      },
    });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Defuse Protocol' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Defuse Protocol slot simulator' })).toBeVisible();
}

async function enterAlphaFeature(page: Page) {
  const toggle = page.getByRole('button', { name: /^DEV CHEATS/ });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await page.getByRole('button', { name: 'Force 3 CORE' }).click();

  const choice = page.getByRole('dialog', { name: 'Choose a relay route' });
  await expect(choice).toBeVisible();
  await expect(page.getByText('Replay DEV-FORCED-3-CORE')).toBeVisible();
  await choice.getByRole('button', { name: /Relay Alpha/ }).click();
  await expect(page.getByRole('region', { name: 'Relay Alpha status' })).toBeVisible();
}

test('development app remains visible without runtime errors', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);

  await openPrototype(page);
  await expect(page.getByText(/Simulation only · virtual credits have no monetary value/)).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(100);

  expect(runtimeErrors).toEqual([]);
});

test('ordinary spin presents its committed result and returns to ready', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await openPrototype(page);

  const spin = page.getByRole('button', { name: 'Spin', exact: true });
  await spin.click();
  await expect(page.getByRole('button', { name: 'Presenting result…' })).toBeVisible();
  await expect(spin).toBeVisible();
  await expect(spin).toBeEnabled();
  await expect(page.getByText(/Replay BASE-/)).toBeVisible();

  expect(runtimeErrors).toEqual([]);
});

test('development cheats force a bonus choice and lock wagers during the feature', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await openPrototype(page);
  await enterAlphaFeature(page);

  await expect(page.getByRole('button', { name: 'Continue feature' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Decrease wager' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Increase wager' })).toBeDisabled();

  expect(runtimeErrors).toEqual([]);
});

test('390px viewport has no document-level horizontal overflow', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openPrototype(page);

  await expect(page.getByRole('button', { name: 'Spin', exact: true })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  expect(runtimeErrors).toEqual([]);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('loads and completes presentation without the normal delay', async ({ page }) => {
    const runtimeErrors = collectRuntimeErrors(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openPrototype(page);
    await expect.poll(() => page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);

    const spin = page.getByRole('button', { name: 'Spin', exact: true });
    await spin.click();
    await expect(spin).toBeVisible({ timeout: 300 });
    await expect(spin).toBeEnabled();

    expect(runtimeErrors).toEqual([]);
  });
});
