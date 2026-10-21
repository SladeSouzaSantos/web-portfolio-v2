import { expect, test } from './fixtures';

test.use({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });

for (const scene of [
  { path: '/#sobre', heading: 'PEDRO SANTOS', screenshot: 'portfolio-desktop.png' },
  { path: '/projetos', heading: 'ARQUIVO DE MISSÕES', screenshot: 'archive-desktop.png' },
]) {
  test(`visual: ${scene.heading}`, async ({ page }) => {
    // Run only through the visual config; baselines are specific to its OS and browser.
    await page.goto(scene.path);
    await expect(page.getByRole('heading', { name: scene.heading, exact: true })).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map(image => image.decode()));
    });
    await page.mouse.move(0, 0);
    await expect(page).toHaveScreenshot(scene.screenshot, {
      animations: 'disabled',
      caret: 'hide',
      // The assistant is a canvas with procedural particles; its content is intentionally dynamic.
      mask: [page.locator('#gbcWidget')],
      maxDiffPixelRatio: 0.001,
    });
  });
}
