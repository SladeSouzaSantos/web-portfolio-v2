import { expect, test, type Page } from './fixtures';

interface CoverSample {
  radius: number;
  farthest: number;
  active: boolean;
}

/** Samples the precise point where the destination section enters React. */
async function installCoverProbe(page: Page) {
  await page.evaluate(() => {
    const host = document.querySelector('#conteudo');
    if (!host) throw new Error('Main region unavailable');
    const samples: Array<{ section: string; radius: number; farthest: number; active: boolean }> = [];
    const observer = new MutationObserver(() => {
      const section = host.querySelector<HTMLElement>('#contentDisplay')?.dataset.section;
      const mask = document.getElementById('sectionTransitionMask');
      const clip = getComputedStyle(mask!).clipPath.match(
        /^circle\(([-\d.]+)px at ([-\d.]+)px ([-\d.]+)px\)$/,
      );
      if (!section || !clip) return;
      const radius = Number(clip[1]);
      const x = Number(clip[2]);
      const y = Number(clip[3]);
      const farthest = Math.max(...[0, innerWidth].flatMap(cx =>
        [0, innerHeight].map(cy => Math.hypot(cx - x, cy - y))));
      if (samples.at(-1)?.section !== section) samples.push({
        section, radius, farthest, active: mask?.classList.contains('is-active') ?? false,
      });
    });
    observer.observe(host, { childList: true, subtree: true });
    Reflect.set(window, '__circleCoverProbe', { samples, stop: () => observer.disconnect() });
  });
}

test.describe('circular page transitions', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('the portal covers the screen before switching scenes, then reveals the new section', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/#sobre');
    await expect(page.locator('#site-preloader')).toHaveCount(0);
    await installCoverProbe(page);
    const nav = page.getByRole('navigation', { name: 'Navegação principal' });
    await nav.getByRole('link', { name: 'Projetos', exact: true }).click();
    await expect(page).toHaveURL(/\/#projetos$/);
    await expect(page.getByRole('heading', { name: 'QUADRO DE MISSÕES' })).toBeVisible();
    await expect(page.locator('#sectionTransitionMask')).not.toHaveClass(/is-active/, { timeout: 5_000 });
    const samples = await page.evaluate(() =>
      (Reflect.get(window, '__circleCoverProbe') as { samples: Array<CoverSample & { section: string }> }).samples,
    );
    const project = samples.find(sample => sample.section === 'projetos');
    expect(project, 'project scene commits under a circle').toBeDefined();
    expect(project!.active).toBe(true);
    expect(project!.radius).toBeGreaterThanOrEqual(project!.farthest - 2);
    expect(await page.evaluate(() => document.querySelector('#sectionTransitionMask')?.getAnimations().length)).toBe(0);
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'PEDRO SANTOS' })).toBeVisible();
  });

  test('rapid navigation is locked until the circle finishes, without duplicate history entries', async ({ page }) => {
    await page.goto('/#sobre');
    await expect(page.locator('#site-preloader')).toHaveCount(0);
    await page.evaluate(() => {
      document.querySelector<HTMLAnchorElement>('#nav-projetos')?.click();
      document.querySelector<HTMLAnchorElement>('#nav-experiencia')?.click();
      document.querySelector<HTMLAnchorElement>('#nav-academico')?.click();
    });
    await expect(page).toHaveURL(/\/#projetos$/);
    await expect(page.locator('#sectionTransitionMask')).not.toHaveClass(/is-active/, { timeout: 5_000 });
    await expect(page.getByRole('heading', { name: 'QUADRO DE MISSÕES' })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/#sobre$/);
  });

  test('a mobile viewport also covers all corners and does not overflow horizontally', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/#sobre');
    await expect(page.locator('#site-preloader')).toHaveCount(0);
    await installCoverProbe(page);
    await page.getByRole('navigation', { name: 'Navegação principal' })
      .getByRole('link', { name: 'Formação acadêmica', exact: true }).click();
    await expect(page).toHaveURL(/\/#academico$/);
    await expect(page.locator('#sectionTransitionMask')).not.toHaveClass(/is-active/, { timeout: 5_000 });
    const samples = await page.evaluate(() =>
      (Reflect.get(window, '__circleCoverProbe') as { samples: Array<CoverSample & { section: string }> }).samples,
    );
    const destination = samples.find(s => s.section === 'academico');
    expect(destination).toBeDefined();
    expect(destination!.radius).toBeGreaterThanOrEqual(destination!.farthest - 2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
});

test('reduced-motion navigation switches immediately without starting a circular animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#sobre');
  await expect(page.locator('#site-preloader')).toHaveCount(0);
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await nav.getByRole('link', { name: 'Projetos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'QUADRO DE MISSÕES' })).toBeVisible();
  await expect(page.locator('#sectionTransitionMask')).not.toHaveClass(/is-active/);
  expect(await page.evaluate(() => document.querySelector('#sectionTransitionMask')?.getAnimations().length)).toBe(0);
});
