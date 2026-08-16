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

async function openPrototype(page: Page, seedWords: readonly [number, number] = [1, 2]) {
  await page.addInitScript((words) => {
    const originalGetRandomValues = crypto.getRandomValues.bind(crypto);
    Object.defineProperty(crypto, 'getRandomValues', {
      configurable: true,
      value(array: ArrayBufferView) {
        if (array instanceof Uint32Array && array.length === 2) {
          array[0] = words[0];
          array[1] = words[1];
          return array;
        }
        return originalGetRandomValues(array);
      },
    });
  }, seedWords);
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

test('persistent diagnostics record committed spins and survive the local UI', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await openPrototype(page);

  await page.getByRole('button', { name: 'Spin', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Spin', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Diagnostics', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Diagnostics' });
  await expect(dialog).toBeVisible();
  const log = dialog.getByLabel('Diagnostic log');
  await expect(log).toHaveValue(/app-start/);
  await expect(log).toHaveValue(/renderer-ready/);
  await expect(log).toHaveValue(/spin-start/);
  await expect(log).toHaveValue(/spin-result/);
  await expect(dialog.getByText(/events retained · maximum 240/)).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test('a synchronous rapid-click burst enters only one spin transition', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await openPrototype(page);

  const spin = page.getByRole('button', { name: 'Spin', exact: true });
  await spin.evaluate((element) => {
    for (let index = 0; index < 100; index += 1) (element as HTMLButtonElement).click();
  });
  await expect(spin).toBeEnabled();
  await expect(page.getByText('Replay BASE-0-5')).toBeVisible();
  await page.getByRole('button', { name: 'Diagnostics', exact: true }).click();
  const log = page.getByLabel('Diagnostic log');
  await expect(log).toHaveValue(/spin-blocked/);
  await expect(log).toHaveValue(/entry-gap/);
  expect(runtimeErrors).toEqual([]);
});

test('repeated fast spins keep one renderer alive and retain bounded diagnostics', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openPrototype(page);

  const spin = page.getByRole('button', { name: 'Spin', exact: true });
  for (let index = 0; index < 30; index += 1) {
    await spin.click();
    await expect(spin).toBeEnabled();
    if (index < 29) await page.waitForTimeout(190);
  }

  await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByRole('button', { name: 'Diagnostics', exact: true }).click();
  const rawLog = await page.getByLabel('Diagnostic log').inputValue();
  const diagnosticLog = JSON.parse(rawLog) as { events: Array<{ type: string }> };
  expect(diagnosticLog.events.filter((event) => event.type === 'spin-result')).toHaveLength(30);
  expect(diagnosticLog.events.length).toBeLessThanOrEqual(240);
  expect(runtimeErrors).toEqual([]);
});

test('audio console previews original cues and persists versioned preferences', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await openPrototype(page);

  await page.getByRole('button', { name: 'Audio', exact: true }).click();
  const audioDialog = page.getByRole('dialog', { name: 'Audio console' });
  await expect(audioDialog).toBeVisible();
  await expect(audioDialog.getByText('Audio never selects or changes a result.')).toBeVisible();
  const master = audioDialog.locator('.dp-audio-slider input').first();
  await master.fill('0.55');
  await expect(audioDialog.locator('.dp-audio-slider output').first()).toHaveText('55%');
  const featureMusic = audioDialog.locator('.dp-audio-slider').filter({ hasText: 'Feature music' });
  await featureMusic.locator('input').fill('0.44');
  await expect(featureMusic.locator('output')).toHaveText('44%');
  await audioDialog.getByRole('button', { name: 'Spin mechanism' }).click();
  await expect(audioDialog.locator('.dp-audio-status')).toHaveText('Audio system active');
  await audioDialog.getByLabel('Mute all audio').check();
  await audioDialog.getByRole('button', { name: 'Close audio settings' }).click();
  await expect(page.getByRole('button', { name: 'Audio off' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Audio off' })).toBeVisible();
  await page.getByRole('button', { name: 'Audio off' }).click();
  await expect(page.getByLabel('Mute all audio')).toBeChecked();
  await expect(page.locator('.dp-audio-slider output').first()).toHaveText('55%');
  await expect(page.locator('.dp-audio-slider').filter({ hasText: 'Feature music' }).locator('output')).toHaveText('44%');
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

for (const winCase of [
  { tier: 'big', seed: 0xf3, payout: '244', headline: 'Big win' },
  { tier: 'major', seed: 0xff, payout: '639', headline: 'Major recovery' },
] as const) {
  test(`${winCase.tier} committed return receives its dedicated celebration`, async ({ page }) => {
    const runtimeErrors = collectRuntimeErrors(page);
    await openPrototype(page, [1, winCase.seed]);
    await page.getByRole('button', { name: 'Spin', exact: true }).click();

    const celebration = page.locator(`.dp-win-celebration--${winCase.tier}`);
    await expect(celebration).toBeVisible();
    await expect(celebration).toContainText(winCase.headline);
    await expect(celebration).toContainText(`+${winCase.payout}`);
    await expect(page.locator('.dp-win-total strong')).toHaveText(`+${winCase.payout}`);
    expect(runtimeErrors).toEqual([]);
  });
}

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
    await expect(page.locator('html')).toHaveAttribute('data-relay-scene', route.toLowerCase());

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

test('completed Bravo feature reports its total and returns to the base environment', async ({ page }) => {
  test.slow();
  const runtimeErrors = collectRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openPrototype(page);
  const choice = await forceCoreChoice(page);
  await choice.getByRole('button', { name: /Relay Bravo/ }).click();

  const summary = page.getByRole('dialog', { name: 'Relay Bravo secured' });
  await expect(summary).toBeVisible({ timeout: 35_000 });
  await expect(summary).toContainText('Total feature return');
  await expect(summary).toContainText('Spins completed');
  await expect(page.locator('html')).toHaveAttribute('data-relay-scene', 'bravo');
  await summary.getByRole('button', { name: 'Return to base operation' }).click();
  await expect(summary).toBeHidden();
  await expect(page.locator('html')).not.toHaveAttribute('data-relay-scene', /.+/);
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
