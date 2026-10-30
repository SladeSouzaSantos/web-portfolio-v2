import { expect, test } from './fixtures';

test('preloader waits for the first critical WebP, then removes the overlay without affecting navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 820 });
  let releaseBackground!: () => void;
  const backgroundGate = new Promise<void>(resolve => { releaseBackground = resolve; });
  await page.route('**/assets/img/taverna_bg.webp', async route => {
    await backgroundGate;
    await route.continue();
  });
  try {
    await page.goto('/#sobre', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#site-preloader')).toBeVisible();
    await expect(page.locator('#contentDisplay')).toHaveAttribute('data-section', 'sobre');
  } finally {
    releaseBackground();
  }
  await expect(page.locator('#site-preloader')).toHaveCount(0, { timeout: 5_000 });
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await nav.getByRole('link', { name: 'Projetos', exact: true }).click();
  await expect(page.locator('#contentDisplay')).toHaveAttribute('data-section', 'projetos');
  await expect(page.getByRole('heading', { name: 'QUADRO DE MISSÕES', exact: true })).toBeVisible();
});

test('hash-based sections transition smoothly, keep history and avoid document reload', async ({ page }) => {
  await page.goto('/#sobre');
  await expect(page.locator('#site-preloader')).toHaveCount(0);
  const marker = await page.evaluate(() => {
    Reflect.set(window, '__transitionDocumentId', 'same-document');
    return 'same-document';
  });
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  for (const entry of [
    { link: 'Experiência', section: 'experiencia', title: 'CRÔNICAS DA JORNADA' },
    { link: 'Formação acadêmica', section: 'academico', title: 'ACADEMIA ARCANA' },
    { link: 'Sobre Pedro Santos', section: 'sobre', title: 'PEDRO SANTOS' },
  ]) {
    await nav.getByRole('link', { name: entry.link, exact: true }).click();
    await expect(page.locator('#contentDisplay')).toHaveAttribute('data-section', entry.section);
    await expect(page.getByRole('heading', { name: entry.title, exact: true })).toBeVisible();
    expect(await page.evaluate(() => Reflect.get(window, '__transitionDocumentId'))).toBe(marker);
    await expect(page.locator('#contentDisplay')).toHaveCSS('animation-name', 'portfolio-scene-arrive');
  }
  await page.goBack();
  await expect(page.locator('#contentDisplay')).toHaveAttribute('data-section', 'academico');
});

test('reduced motion avoids transition animation and never requires GIFs to become interactive', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const gifRequests: string[] = [];
  page.on('request', request => {
    if (request.url().includes('.gif')) gifRequests.push(request.url());
  });
  await page.goto('/#academico');
  await expect(page.locator('#site-preloader')).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator('#contentDisplay')).toHaveCSS('animation-name', 'none');
  await page.getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('link', { name: 'Projetos', exact: true }).click();
  await expect(page.locator('#contentDisplay')).toHaveAttribute('data-section', 'projetos');
  await expect(page.locator('#contentDisplay')).toHaveCSS('animation-name', 'none');
  expect(gifRequests).toEqual([]);
});

test('small viewports keep the loading overlay in bounds and navigation reachable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/#sobre', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#site-preloader')).toHaveCount(0, { timeout: 5000 });
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await nav.getByRole('link', { name: 'Formação acadêmica', exact: true }).click();
  await expect(page.locator('#contentDisplay')).toHaveAttribute('data-section', 'academico');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});
