const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch();
  const failures = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.split('\n')[0]}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/i.test(m.text()))
      errors.push(`console: ${m.text().slice(0, 140)}`);
  });

  await page.goto('http://localhost:3000/find', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="find-search-form"]', { timeout: 15000 });

  const destInput = page.locator('[data-testid="find-field-destination"] input');
  await destInput.click();
  await destInput.fill('Milan');
  await page.waitForTimeout(1500);
  const suggestions = page.locator('[role="option"]');
  const nSugg = await suggestions.count();
  console.log(`autocomplete suggestions: ${nSugg}`);
  if (nSugg === 0) {
    failures.push('no autocomplete suggestions for "Milan"');
  } else {
    // Mantine combobox option: keyboard-select the active suggestion
    // (pointer click is intercepted by the map overlay at this viewport).
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
  }
  console.log(`dest value: ${await destInput.inputValue()}`);

  // Dates via picker: open, click two enabled days
  try {
    const dateInput = page.locator('[data-testid="find-field-dates"] input');
    await dateInput.click({ timeout: 5000 });
    await page.waitForTimeout(800);
    const days = page.locator('.mantine-DatePickerInput-calendar button:not([disabled])');
    const dayCount = await days.count();
    console.log(`calendar days: ${dayCount}`);
    if (dayCount >= 2) {
      await days.nth(0).click({ timeout: 5000 });
      await page.waitForTimeout(300);
      await days.nth(1).click({ timeout: 5000 });
      await page.waitForTimeout(300);
    } else {
      failures.push('not enough enabled calendar days');
    }
  } catch (e) {
    failures.push(`date picking failed: ${String(e).split('\n')[0]}`);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  const r100 = page.locator('[data-testid="find-radius-100"]');
  if (await r100.count()) {
    await r100.click({ timeout: 5000 }).catch(() => failures.push('radius click failed'));
    console.log('radius 100 clicked');
  }

  console.log(`submit enabled: ${await page.locator('[data-testid="find-submit"]').isEnabled()}`);
  await page.locator('[data-testid="find-submit"]').click();
  await page.waitForSelector('[data-testid="find-results-panel"], [data-testid="find-empty-state"]', { timeout: 25000 }).catch(() => null);
  const mv = await page.locator('[data-testid="find-view"]').getAttribute('data-mobile-view').catch(() => 'MISSING-VIEW');
  const cards = await page.locator('[data-testid^="find-match-card-"]').count();
  const mapInList = await page.locator('[data-testid="find-map"]').count();
  const empty = await page.locator('[data-testid="find-empty-state"]').count();
  console.log(`after search: mobileView=${mv} cards=${cards} map=${mapInList} empty=${empty}`);
  if (cards === 0 && empty === 0) failures.push('search produced neither cards nor empty state');
  if (mapInList !== 0) failures.push('map rendered in Matches mode after manual search');

  if (cards > 0) {
    const mapBtn = page.locator('[data-testid="find-mobile-toggle"]').getByText('Map', { exact: true });
    await mapBtn.click({ timeout: 8000 });
    await page.waitForSelector('[data-testid="find-map"]', { timeout: 15000 }).catch(() => null);
    const leaflet = await page.locator('[data-testid="find-map"] .leaflet-container').count();
    console.log(`map mode leaflet: ${leaflet}`);
    if (!leaflet) failures.push('leaflet missing in Map mode after manual search');
    await page.locator('[data-testid="find-mobile-toggle"]').getByText('Matches', { exact: true }).click({ timeout: 8000 });
    await page.waitForSelector('[data-testid="find-results-panel"]', { timeout: 15000 }).catch(() => null);
    console.log('back to Matches ok');
  }

  const nanErrors = errors.filter((e) => /NaN|LatLng/i.test(e));
  if (nanErrors.length) failures.push(`NaN errors: ${nanErrors.join(' | ')}`);
  console.log(`other errors: ${errors.filter((e) => !/NaN|LatLng/i.test(e)).slice(0, 5).join(' | ') || 'none'}`);
  await browser.close();
  console.log(failures.length ? `FAILURES:\n- ${failures.join('\n- ')}` : 'MANUAL SEARCH FLOW PASSED');
  process.exit(failures.length ? 1 : 0);
})().catch((e) => {
  console.error('SCRIPT ERROR', e.message.split('\n').slice(0, 5).join(' | '));
  process.exit(2);
});
