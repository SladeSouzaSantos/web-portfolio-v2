import { expect, test, type Page } from './fixtures';

interface MaskSample {
  theme: string;
  radius: number;
  originX: number;
  originY: number;
  farthestCorner: number;
  bounds: { x: number; y: number; width: number; height: number };
  viewport: { width: number; height: number };
  disabled: boolean;
}

interface TransitionProbe {
  frames: MaskSample[];
  changes: MaskSample[];
  stop: () => void;
}

// Observe rendered frames and the exact theme commit. This catches a mask that
// looks animated but swaps the page theme before its circle covers the viewport.
async function observeTransition(page: Page) {
  await page.evaluate(() => {
    const previous = Reflect.get(window, '__themeTransitionProbe') as TransitionProbe | undefined;
    previous?.stop();
    const frames: MaskSample[] = [];
    const changes: MaskSample[] = [];
    const currentTheme = () => document.body.classList.contains('modo-claro') ? 'light' : 'dark';
    let lastTheme = currentTheme();
    let frame = 0;
    const sample = (): MaskSample => {
      const mask = document.getElementById('themeTransitionMask');
      const rect = mask?.getBoundingClientRect();
      const bounds = { x: rect?.x ?? 0, y: rect?.y ?? 0, width: rect?.width ?? 0, height: rect?.height ?? 0 };
      const viewport = { width: innerWidth, height: innerHeight };
      const circle = mask && getComputedStyle(mask).clipPath.match(/^circle\(([-\d.]+)(px|%) at ([-\d.]+)(px|%) ([-\d.]+)(px|%)\)$/);
      const radius = circle ? Number(circle[1]) * (circle[2] === '%' ? Math.hypot(bounds.width, bounds.height) / Math.SQRT2 / 100 : 1) : 0;
      const originX = bounds.x + (circle ? Number(circle[3]) * (circle[4] === '%' ? bounds.width / 100 : 1) : 0);
      const originY = bounds.y + (circle ? Number(circle[5]) * (circle[6] === '%' ? bounds.height / 100 : 1) : 0);
      return {
        theme: currentTheme(), radius, originX, originY, bounds, viewport,
        farthestCorner: Math.max(...[0, viewport.width].flatMap(x => [0, viewport.height].map(y => Math.hypot(x - originX, y - originY)))),
        disabled: (document.getElementById('themeToggleBtn') as HTMLButtonElement | null)?.disabled ?? false,
      };
    };
    const record = () => { frames.push(sample()); frame = requestAnimationFrame(record); };
    const observer = new MutationObserver(() => {
      const theme = currentTheme();
      if (theme !== lastTheme) { lastTheme = theme; changes.push(sample()); }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    Reflect.set(window, '__themeTransitionProbe', {
      frames, changes, stop: () => { cancelAnimationFrame(frame); observer.disconnect(); },
    } satisfies TransitionProbe);
    record();
  });
}

async function readProbe(page: Page) {
  return page.evaluate(() => {
    const { frames, changes } = Reflect.get(window, '__themeTransitionProbe') as TransitionProbe;
    return { frames, changes };
  });
}

async function expectCompletedTransition(page: Page, from: string, to: string, origin: { x: number; y: number }) {
  await expect(page.locator('body')).toHaveClass(new RegExp(to === 'light' ? 'modo-claro' : 'modo-escuro'));
  await expect(page.locator('#themeToggleBtn')).toBeEnabled();
  const { frames, changes } = await readProbe(page);
  expect(changes, 'one theme change per completed circle').toHaveLength(1);
  expect(changes[0].theme).toBe(to);
  expect(changes[0].radius, 'all four corners must be covered when the theme changes').toBeGreaterThanOrEqual(changes[0].farthestCorner - 1);
  const expansion = frames.filter(frame => frame.theme === from && frame.radius > 1 && frame.radius < frame.farthestCorner * .9);
  const contraction = frames.filter(frame => frame.theme === to && frame.radius > 1 && frame.radius < frame.farthestCorner * .9);
  expect(expansion.length, 'circle expands visibly before changing theme').toBeGreaterThan(0);
  expect(contraction.length, 'circle retracts visibly after changing theme').toBeGreaterThan(0);
  for (const frame of [...expansion, ...contraction]) {
    expect(frame.originX).toBeCloseTo(origin.x, 0);
    expect(frame.originY).toBeCloseTo(origin.y, 0);
    expect(frame.bounds.x).toBeCloseTo(0, 0);
    expect(frame.bounds.y).toBeCloseTo(0, 0);
    expect(frame.bounds.width).toBeCloseTo(frame.viewport.width, 0);
    expect(frame.bounds.height).toBeCloseTo(frame.viewport.height, 0);
    expect(frame.disabled, 'theme control remains locked during both phases').toBe(true);
  }
  await expect.poll(async () => page.locator('#themeTransitionMask').evaluate(mask => ({
    animations: mask.getAnimations().filter(animation => animation.playState === 'running').length,
    clipPath: getComputedStyle(mask).clipPath,
  }))).toEqual({ animations: 0, clipPath: expect.stringMatching(/^circle\(0(?:px|%)/) });
}

async function buttonCenter(page: Page) {
  const rect = await page.locator('#themeToggleBtn').boundingBox();
  expect(rect).not.toBeNull();
  return { x: rect!.x + rect!.width / 2, y: rect!.y + rect!.height / 2 };
}

test.describe('animated theme transition', () => {
  test.use({ reducedMotion: 'no-preference', viewport: { width: 1280, height: 800 } });

  test('the circle covers the desktop before swapping theme, then retracts in both directions', async ({ page }) => {
    await page.goto('/');
    const origin = await buttonCenter(page);
    for (const [from, to] of [['dark', 'light'], ['light', 'dark']]) {
      await observeTransition(page);
      await page.locator('#themeToggleBtn').click();
      await expectCompletedTransition(page, from, to, origin);
    }
  });

  test('the mobile circle stays attached to the viewport and icon after scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/#projetos');
    await page.evaluate(() => window.scrollTo({ top: 250, behavior: 'instant' }));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    const origin = await buttonCenter(page);
    await observeTransition(page);
    await page.locator('#themeToggleBtn').click();
    await expectCompletedTransition(page, 'dark', 'light', origin);
  });

  test('rapid repeated clicks cannot queue another theme change during either phase', async ({ page }) => {
    await page.goto('/');
    const origin = await buttonCenter(page);
    await observeTransition(page);
    await page.locator('#themeToggleBtn').click();
    await expect(page.locator('#themeToggleBtn')).toBeDisabled();
    await page.locator('#themeToggleBtn').evaluate(button => {
      for (let index = 0; index < 10; index++) (button as HTMLButtonElement).click();
    });
    await expect(page.locator('body')).toHaveClass(/modo-claro/);
    await expect(page.locator('#themeToggleBtn')).toBeDisabled();
    await page.locator('#themeToggleBtn').evaluate(button => {
      for (let index = 0; index < 10; index++) (button as HTMLButtonElement).click();
    });
    await expectCompletedTransition(page, 'dark', 'light', origin);
  });

  test('leaving the portfolio cancels the circle without leaving an overlay or stale theme change', async ({ page }) => {
    await page.goto('/#projetos');
    const archiveLink = page.getByRole('link', { name: /ARQUIVO DE MISSÕES EXPLORAR OUTROS PROJETOS/ });
    await archiveLink.scrollIntoViewIfNeeded();
    await observeTransition(page);
    await page.locator('#themeToggleBtn').click();
    await page.waitForFunction(() => {
      const probe = Reflect.get(window, '__themeTransitionProbe') as TransitionProbe;
      return probe.frames.some(frame => frame.radius > 0 && frame.radius < frame.farthestCorner / 2);
    });
    const themeBeforeNavigation = await archiveLink.evaluate(link => {
      const mask = document.getElementById('themeTransitionMask');
      Reflect.set(window, '__cancelledThemeAnimations', mask?.getAnimations() ?? []);
      const theme = document.body.classList.contains('modo-claro') ? 'light' : 'dark';
      (link as HTMLAnchorElement).click();
      return theme;
    });
    await expect(page).toHaveURL(/\/projetos$/);
    await expect(page.locator('#themeTransitionMask')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => (Reflect.get(window, '__cancelledThemeAnimations') as Animation[])
      .every(animation => animation.playState === 'idle'))).toBe(true);
    await expect(page.locator('body')).toHaveClass(new RegExp(themeBeforeNavigation === 'light' ? 'modo-claro' : 'modo-escuro'));
    await page.getByRole('link', { name: '← RETORNAR AO PORTFÓLIO', exact: true }).click();
    await expect(page.locator('#themeToggleBtn')).toBeEnabled();
    const origin = await buttonCenter(page);
    await observeTransition(page);
    await page.locator('#themeToggleBtn').click();
    await expectCompletedTransition(page, themeBeforeNavigation, themeBeforeNavigation === 'dark' ? 'light' : 'dark', origin);
  });
});

test('reduced motion changes the theme immediately without exposing or animating the mask', async ({ page }) => {
  await page.goto('/');
  for (const theme of ['light', 'dark']) {
    await page.locator('#themeToggleBtn').click();
    await expect(page.locator('body')).toHaveClass(new RegExp(theme === 'light' ? 'modo-claro' : 'modo-escuro'));
    await expect(page.locator('#themeToggleBtn')).toBeEnabled();
    expect(await page.locator('#themeTransitionMask').evaluate(mask => ({
      animations: mask.getAnimations().length,
      clipPath: getComputedStyle(mask).clipPath,
    }))).toEqual({ animations: 0, clipPath: expect.stringMatching(/^circle\(0(?:px|%)/) });
  }
});
