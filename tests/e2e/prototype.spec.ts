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

async function forceCoreChoice(page: Page) {
  const toggle = page.getByRole('button', { name: /^DEV CHEATS/ });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await page.getByRole('button', { name: 'Force 3 CORE' }).click();

  const choice = page.getByRole('dialog', { name: 'Choose a relay route' });
  await expect(choice).toBeVisible();
  await expect(page.getByText('Replay DEV-FORCED-3-CORE')).toBeVisible();
  return choice;
}

async function resultFingerprint(page: Page) {
  const scoreboard = await page.locator('.dp-scoreboard dd').allTextContents();
  return {
    scoreboard,
    feedback: await page.locator('#dp-result-feedback').innerText(),
    seed: await page.locator('.dp-replay code').innerText(),
    replay: await page.locator('.dp-replay span').nth(1).innerText(),
    provenance: await page.getByRole('region', { name: 'Result provenance' }).innerText(),
  };
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
  const cabinet = page.getByRole('region', { name: 'Defuse Protocol slot simulator' });
  const decreaseWager = page.getByRole('button', { name: 'Decrease wager' });
  const increaseWager = page.getByRole('button', { name: 'Increase wager' });
  await spin.click();
  const presenting = page.getByRole('button', { name: 'Presenting result…' });
  await expect(presenting).toBeVisible();
  await expect(presenting).toBeDisabled();
  await expect(cabinet).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#dp-result-feedback')).toContainText('Presenting committed result');
  await expect(decreaseWager).toBeDisabled();
  await expect(increaseWager).toBeDisabled();
  const committedResult = await resultFingerprint(page);
  await expect(spin).toBeVisible();
  await expect(spin).toBeEnabled();
  await expect(cabinet).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#dp-result-feedback')).toContainText(/No line payout|\+\d[\d,]* VC/);
  await expect(decreaseWager).toBeEnabled();
  await expect(increaseWager).toBeEnabled();
  await expect(page.getByText(/Replay BASE-/)).toBeVisible();
  const presentedResult = await resultFingerprint(page);
  expect(presentedResult.scoreboard).toEqual(committedResult.scoreboard);
  expect(presentedResult.seed).toEqual(committedResult.seed);
  expect(presentedResult.replay).toEqual(committedResult.replay);
  expect(presentedResult.provenance).toEqual(committedResult.provenance);

  expect(runtimeErrors).toEqual([]);
});

test('Space triggers one base spin and is ignored while presentation or dialogs lock play', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await openPrototype(page);

  const spin = page.getByRole('button', { name: 'Spin', exact: true });
  await expect(spin).toHaveAttribute('aria-keyshortcuts', 'Space');
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Presenting result…' })).toBeDisabled();
  await page.keyboard.press('Space');
  await expect(spin).toBeEnabled();
  await expect(page.getByText('Replay BASE-0-5')).toBeVisible();

  await page.getByRole('button', { name: 'Paytable & help' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Space');
  await page.waitForTimeout(50);
  await expect(page.getByText('Replay BASE-0-5')).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test('winning result exposes a payline ledger and prominent committed total', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openPrototype(page);

  const spin = page.getByRole('button', { name: 'Spin', exact: true });
  const initialSpinY = await spin.evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
  let foundWin = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await spin.click();
    await page.waitForTimeout(20);
    if (await page.locator('.dp-win-ledger').count()) {
      foundWin = true;
      break;
    }
    expect(await page.getByRole('dialog', { name: 'Choose a relay route' }).count()).toBe(0);
  }

  expect(foundWin).toBe(true);
  await expect(page.locator('.dp-prototype')).toHaveClass(/dp-prototype--win/);
  await expect(page.locator('.dp-payline-overlay')).toBeVisible();
  await expect(page.locator('.dp-payline-overlay__trace')).toHaveAttribute('points', /\d,\d/);
  await expect(page.locator('.dp-win-total strong')).toContainText(/^\+[\d,]+$/);
  await expect(page.getByRole('region', { name: 'Winning paylines' })).toBeVisible();
  await expect(page.locator('.dp-win-ledger li').first()).toContainText(/Line \d{2}/);
  await expect(page.locator('#dp-result-feedback')).toContainText(/Strongest: line \d+/);
  const winningSpinY = await spin.evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
  expect(winningSpinY).toBe(initialSpinY);

  expect(runtimeErrors).toEqual([]);
});

test('animated paylines advance once and clear after the win sequence', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await openPrototype(page);

  const spin = page.getByRole('button', { name: 'Spin', exact: true });
  let foundWin = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await spin.click();
    await page.waitForTimeout(650);
    if (await page.locator('.dp-win-ledger').count()) {
      foundWin = true;
      break;
    }
    expect(await page.getByRole('dialog', { name: 'Choose a relay route' }).count()).toBe(0);
  }

  expect(foundWin).toBe(true);
  const paths = page.locator('.dp-payline-overlay__path');
  const pathCount = await paths.count();
  expect(pathCount).toBeGreaterThan(0);
  expect(pathCount).toBeLessThanOrEqual(4);
  const activeOpacity = Number(await paths.first().evaluate((element) => getComputedStyle(element).opacity));
  expect(activeOpacity).toBeGreaterThan(0);

  await page.waitForTimeout(pathCount * 900 + 150);
  const settledOpacities = await paths.evaluateAll((elements) => elements.map((element) => Number(getComputedStyle(element).opacity)));
  expect(settledOpacities.every((opacity) => opacity === 0)).toBe(true);
  expect(runtimeErrors).toEqual([]);
});

for (const route of ['Alpha', 'Bravo'] as const) {
  test(`Relay ${route} autospins can pause and resume while wagers stay locked`, async ({ page }) => {
    const runtimeErrors = collectRuntimeErrors(page);
    await openPrototype(page);
    const choice = await forceCoreChoice(page);
    const decreaseWager = page.getByRole('button', { name: 'Decrease wager' });
    const increaseWager = page.getByRole('button', { name: 'Increase wager' });

    await expect(decreaseWager).toBeDisabled();
    await expect(increaseWager).toBeDisabled();
    await expect(page.locator('#dp-result-feedback')).toContainText('Feature route required');
    await choice.getByRole('button', { name: new RegExp(`Relay ${route}`) }).click();

    const featureStatus = page.getByRole('region', { name: `Relay ${route} status` });
    const pauseAutospins = page.getByRole('button', { name: 'Pause auto spins' });
    await expect(featureStatus).toBeVisible();
    await expect(page.locator('#dp-result-feedback')).toContainText(/Defuse Operation active|payout confirmed/);
    await expect(pauseAutospins).toBeEnabled();
    await expect(decreaseWager).toBeDisabled();
    await expect(increaseWager).toBeDisabled();

    await pauseAutospins.click();
    const resumeAutospins = page.getByRole('button', { name: 'Resume auto spins' });
    await expect(resumeAutospins).toBeEnabled();
    await expect(page.locator('#dp-result-feedback')).toContainText('Automatic spins paused');
    await page.waitForTimeout(800);
    await expect(page.getByText('Replay DEV-FORCED-3-CORE')).toBeVisible();

    await resumeAutospins.click();
    await expect(page.getByRole('button', { name: 'Presenting result…' })).toBeDisabled();
    await expect(page.locator('#dp-result-feedback')).toContainText('Presenting committed result');
    await expect(pauseAutospins).toBeEnabled();
    await pauseAutospins.click();
    await expect(resumeAutospins).toBeEnabled();
    await expect(featureStatus).toBeVisible();
    await expect(page.locator('#dp-result-feedback')).toContainText(/Defuse Operation active|payout confirmed/);
    await expect(decreaseWager).toBeDisabled();
    await expect(increaseWager).toBeDisabled();
    await expect(page.getByText(/Replay BONUS-/)).toBeVisible();
    if (route === 'Alpha') {
      await expect(page.getByRole('progressbar', { name: 'Containment charges' })).toBeVisible();
    } else {
      await expect(page.locator('output[aria-label$="times multiplier"]')).toBeVisible();
    }

    expect(runtimeErrors).toEqual([]);
  });
}

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
    const stableResult = await resultFingerprint(page);
    await page.waitForTimeout(650);
    expect(await resultFingerprint(page)).toEqual(stableResult);

    expect(runtimeErrors).toEqual([]);
  });
});

test('motion preference does not change a deterministic result or its provenance', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await openPrototype(page);

  await page.getByRole('button', { name: 'Spin', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Spin', exact: true })).toBeEnabled();
  const animatedResult = await resultFingerprint(page);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect.poll(() => page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await expect(page.getByRole('heading', { name: 'Defuse Protocol' })).toBeVisible();
  await page.getByRole('button', { name: 'Spin', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Spin', exact: true })).toBeEnabled({ timeout: 300 });
  const reducedResult = await resultFingerprint(page);

  expect(reducedResult).toEqual(animatedResult);
  expect(runtimeErrors).toEqual([]);
});
