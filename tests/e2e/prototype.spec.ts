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
  test.slow();
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
  // An ordinary presentation lasts 520 ms, which is shorter than a driver round trip can
  // reliably observe on a loaded CI runner. Click and read the locked state in one call.
  const locked = await page.evaluate(() => new Promise<{
    label: string; disabled: boolean; busy: string | null; feedback: string;
    wagerLocked: boolean; scoreboard: string[]; seed: string; replay: string; provenance: string;
  }>((resolve) => {
    const button = () => document.querySelector<HTMLButtonElement>('.dp-spin-button')!;
    const wagerButton = (label: string) => document.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
    button().click();
    requestAnimationFrame(() => requestAnimationFrame(() => resolve({
      label: button().textContent?.trim() ?? '',
      disabled: button().disabled,
      busy: document.querySelector('.dp-cabinet')?.getAttribute('aria-busy') ?? null,
      feedback: document.querySelector('#dp-result-feedback')?.textContent ?? '',
      wagerLocked: wagerButton('Decrease wager').disabled && wagerButton('Increase wager').disabled,
      scoreboard: [...document.querySelectorAll('.dp-scoreboard dd')].map((cell) => cell.textContent ?? ''),
      seed: document.querySelector('.dp-replay code')?.textContent ?? '',
      replay: document.querySelectorAll('.dp-replay span')[1]?.textContent ?? '',
      provenance: document.querySelector('.dp-provenance')?.textContent ?? '',
    })));
  }));

  expect(locked.label).toBe('Presenting result…');
  expect(locked.disabled).toBe(true);
  expect(locked.busy).toBe('true');
  expect(locked.feedback).toContain('Presenting committed result');
  expect(locked.wagerLocked).toBe(true);
  const committedResult = {
    scoreboard: locked.scoreboard,
    seed: locked.seed,
    replay: locked.replay,
    provenance: locked.provenance,
  };
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
  // textContent and innerText differ in element separators, so compare the text itself.
  const withoutSpacing = (value: string) => value.replace(/\s+/g, '');
  expect(withoutSpacing(presentedResult.provenance)).toEqual(withoutSpacing(committedResult.provenance));

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
    // Wait for the committed presentation to finish rather than a fixed delay, because a
    // pending Signal Core holds the reels well past an ordinary spin.
    await expect(spin).toBeEnabled();
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
    // The counted total must still be running well after the reels settle, so a large
    // return is readable instead of appearing at its final value immediately.
    await page.waitForTimeout(400);
    expect(await celebration.locator('strong').innerText()).not.toBe(`+${winCase.payout}`);
    expect(await page.locator('.dp-win-total strong').innerText()).not.toBe(`+${winCase.payout}`);
    await expect(celebration).toContainText(`+${winCase.payout}`);
    await expect(page.locator('.dp-win-total strong')).toHaveText(`+${winCase.payout}`);
    expect(runtimeErrors).toEqual([]);
  });
}

test('animated paylines advance once and clear after the win sequence', async ({ page }) => {
  test.slow();
  const runtimeErrors = collectRuntimeErrors(page);
  await openPrototype(page);

  // Each payline is only visible for a 900 ms slot, which is shorter than a round trip
  // from the test can reliably observe. Sample inside the page instead.
  await page.evaluate(() => {
    const samples: Array<{ count: number; maxOpacity: number }> = [];
    (window as unknown as { __paylineSamples: typeof samples }).__paylineSamples = samples;
    const tick = () => {
      const paths = [...document.querySelectorAll('.dp-payline-overlay__path')];
      samples.push({
        count: paths.length,
        maxOpacity: paths.reduce((max, path) => Math.max(max, Number(getComputedStyle(path).opacity)), 0),
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  const spin = page.getByRole('button', { name: 'Spin', exact: true });
  let foundWin = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await spin.click();
    // Wait for the committed presentation to finish rather than a fixed delay, because a
    // pending Signal Core holds the reels well past an ordinary spin.
    await expect(spin).toBeEnabled();
    if (await page.locator('.dp-win-ledger').count()) {
      foundWin = true;
      break;
    }
    expect(await page.getByRole('dialog', { name: 'Choose a relay route' }).count()).toBe(0);
  }

  expect(foundWin).toBe(true);
  const pathCount = await page.locator('.dp-payline-overlay__path').count();
  expect(pathCount).toBeGreaterThan(0);
  expect(pathCount).toBeLessThanOrEqual(4);

  await page.waitForTimeout(pathCount * 900 + 250);
  const samples = await page.evaluate(() =>
    (window as unknown as { __paylineSamples: Array<{ count: number; maxOpacity: number }> }).__paylineSamples);

  // A payline was visibly traced at some point, no more than four were ever present,
  // and every path has cleared by the end of the sequence.
  expect(samples.some((sample) => sample.maxOpacity > 0.5)).toBe(true);
  expect(Math.max(...samples.map((sample) => sample.count))).toBeLessThanOrEqual(4);
  expect(samples.at(-1)?.maxOpacity).toBe(0);

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
    // The paused note only appears once a presentation has settled, so reaching it means
    // the feature is idle. Whether an automatic spin already ran before the pause landed
    // is a race with the autoplay timer, so compare the replay identifier against itself.
    await expect(page.locator('#dp-result-feedback')).toContainText('Automatic spins paused');
    const replayWhilePaused = page.locator('.dp-replay span').nth(1);
    const pausedReplay = await replayWhilePaused.innerText();
    await page.waitForTimeout(1_200);
    expect(await replayWhilePaused.innerText()).toBe(pausedReplay);

    await resumeAutospins.click();
    await expect(page.getByRole('button', { name: 'Presenting result…' })).toBeDisabled();
    await expect(pauseAutospins).toBeEnabled();
    await expect(replayWhilePaused).not.toHaveText(pausedReplay);
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

test('console dialogs open as viewport modals instead of trailing page sections', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await openPrototype(page);

  // The development cheat menu is lazy-loaded and would otherwise land between samples.
  await expect(page.getByRole('button', { name: /^DEV CHEATS/ })).toBeVisible();
  const documentHeight = () => page.evaluate(() => document.documentElement.scrollHeight);
  const baselineHeight = await documentHeight();
  for (const panel of [
    { control: 'Paytable & help', title: 'Paytable & feature guide' },
    { control: 'Lab', title: 'Simulation laboratory' },
    { control: 'Diagnostics', title: 'Diagnostics' },
  ] as const) {
    await page.getByRole('button', { name: panel.control, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: panel.title });
    await expect(dialog).toBeVisible();
    const placement = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        position: getComputedStyle(element).position,
        top: Math.round(rect.top),
        height: Math.round(rect.height),
        viewportHeight: window.innerHeight,
      };
    });
    expect(placement.position).toBe('fixed');
    expect(placement.top).toBe(0);
    expect(placement.height).toBe(placement.viewportHeight);
    expect(await documentHeight()).toBe(baselineHeight);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }

  expect(runtimeErrors).toEqual([]);
});

test('the Signal Core route choice opens over the reels and locks the console', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await openPrototype(page);
  const choice = await forceCoreChoice(page);

  await expect(choice.getByRole('button', { name: /Relay Alpha/ })).toBeFocused();
  await expect(page.locator('.dp-bonus-lock')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New seed' })).toBeDisabled();
  const placement = await page.evaluate(() => {
    const popup = document.querySelector('.dp-bonus-popup')!.getBoundingClientRect();
    const frame = document.querySelector('.dp-reel-frame')!.getBoundingClientRect();
    const popupLayer = document.querySelector('.dp-bonus-popup')!;
    return {
      position: getComputedStyle(popupLayer).position,
      overflowTop: Math.round(frame.top - popup.top),
      overflowBottom: Math.round(popup.bottom - frame.bottom),
      scrolls: popupLayer.scrollHeight > popupLayer.clientHeight + 1,
    };
  });
  expect(placement.position).toBe('absolute');
  expect(placement.overflowTop).toBeLessThanOrEqual(2);
  expect(placement.overflowBottom).toBeLessThanOrEqual(2);
  expect(placement.scrolls).toBe(false);

  await choice.getByRole('button', { name: /Relay Alpha/ }).click();
  await expect(page.locator('.dp-bonus-lock')).toBeHidden();
  await expect(page.getByRole('region', { name: 'Relay Alpha status' })).toBeVisible();

  expect(runtimeErrors).toEqual([]);
});

test('a pending third Signal Core holds the remaining reels before settling', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  // This seed commits Signal Cores on reels one and two, so reels three, four and five
  // each still complete the trigger with one more Core.
  await openPrototype(page, [1, 3]);

  const spin = page.getByRole('button', { name: 'Spin', exact: true });
  const presenting = page.getByRole('button', { name: 'Presenting result…' });
  const startedAt = Date.now();
  await spin.click();
  await expect(presenting).toBeDisabled();

  // An ordinary spin has fully settled by 520 ms; the held reels must still be running.
  await page.waitForTimeout(900);
  await expect(presenting).toBeDisabled();
  await expect(spin).toBeEnabled({ timeout: 5_000 });
  expect(Date.now() - startedAt).toBeGreaterThan(1_800);

  const diagnostics = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('defuse-protocol:diagnostics:v1') ?? '[]') as Array<{
      type: string;
      details: Record<string, unknown>;
    }>);
  const spinResult = diagnostics.findLast((event) => event.type === 'spin-result');
  expect(spinResult?.details.cores).toBe(2);
  expect(spinResult?.details.anticipatedReels).toBe(3);

  expect(runtimeErrors).toEqual([]);
});

test('an ordinary spin keeps its short presentation', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await openPrototype(page);

  const spin = page.getByRole('button', { name: 'Spin', exact: true });
  const startedAt = Date.now();
  await spin.click();
  await expect(spin).toBeEnabled();
  expect(Date.now() - startedAt).toBeLessThan(1_500);

  expect(runtimeErrors).toEqual([]);
});

test('a wager above the balance blocks the spin and stays recoverable', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openPrototype(page);

  const spin = page.getByRole('button', { name: 'Spin', exact: true });
  const decreaseWager = page.getByRole('button', { name: 'Decrease wager' });
  const balance = page.locator('.dp-stat dd').first();
  const wager = page.locator('.dp-wager-controls output');
  // A synchronous burst also covers wager steps that land in a single React batch.
  const stepWager = (label: string, times: number) => page.getByRole('button', { name: label })
    .evaluate((element, count) => {
      for (let index = 0; index < count; index += 1) (element as HTMLButtonElement).click();
    }, times);

  for (let index = 0; index < 6 && (await balance.innerText()) === '2,000 VC'; index += 1) {
    await spin.click();
    await expect(spin).toBeEnabled();
  }
  await expect(balance).not.toHaveText('2,000 VC');

  await stepWager('Increase wager', 99);
  await expect(wager).toHaveText('2,000 VC');
  const blocked = page.getByRole('button', { name: 'Out of credits' });
  await expect(blocked).toBeVisible();
  await expect(blocked).toBeDisabled();
  await expect(page.locator('#dp-result-feedback')).toContainText('Insufficient virtual credits');
  await expect(page.locator('#dp-result-feedback')).toContainText('Lower the wager');

  // Recovery must not require a session reset, so the wager stays adjustable.
  await expect(decreaseWager).toBeEnabled();
  await stepWager('Decrease wager', 99);
  await expect(wager).toHaveText('20 VC');
  await expect(spin).toBeEnabled();

  expect(runtimeErrors).toEqual([]);
});

test('sustained play keeps the renderer heap bounded', async ({ page }) => {
  test.slow();
  const runtimeErrors = collectRuntimeErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openPrototype(page);

  const heapBytes = () => page.evaluate(() =>
    (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0);
  const spin = page.getByRole('button', { name: 'Spin', exact: true });
  for (let index = 0; index < 5; index += 1) {
    await spin.click();
    await expect(spin).toBeEnabled();
    await page.waitForTimeout(190);
  }

  const baseline = await heapBytes();
  test.skip(baseline === 0, 'This browser does not expose performance.memory.');
  let completedSpins = 0;
  for (let index = 0; index < 40; index += 1) {
    if (!(await spin.isVisible())) break;
    await spin.click();
    await expect(spin).toBeEnabled();
    await page.waitForTimeout(190);
    completedSpins += 1;
  }

  // The previous renderer leaked every per-frame GraphicsContext, which grew the heap by
  // roughly 75 MB per spin and crashed the tab within about a minute of continuous play.
  expect(completedSpins).toBeGreaterThanOrEqual(20);
  expect(await heapBytes() - baseline).toBeLessThan(300 * 1024 * 1024);
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
