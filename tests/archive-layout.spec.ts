import { expect, test } from './fixtures';

const sizes = [270, 320, 375, 640, 768, 1024, 1440] as const;

for (const width of sizes) {
  test(`Arquivo de Missões usa grade responsiva real em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 500 ? 812 : 900 });
    await page.goto('/projetos');
    await page.evaluate(() => document.fonts.ready);
    const grid = page.locator('.arquivo-grid');
    const cards = grid.locator('button.guilda-cartaz');
    await expect(cards).toHaveCount(8);
    const expectedCols = width <= 640 ? 1 : width <= 1000 ? 2 : 3;
    await expect.poll(async () => grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length))
      .toBe(expectedCols);
    const dimensions = await grid.evaluate(el => {
      const gridRect = el.getBoundingClientRect();
      const rects = Array.from(el.querySelectorAll<HTMLElement>('.guilda-cartaz'))
        .map(card => card.getBoundingClientRect());
      return {
        overflow: el.scrollWidth - el.clientWidth,
        outside: rects.filter(r => r.left < gridRect.left - 1 || r.right > gridRect.right + 1).length,
        cardOverlap: rects.some((r, i) => rects.some((b, j) => j > i &&
          Math.min(r.right, b.right) - Math.max(r.left, b.left) > 2 &&
          Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top) > 2)),
      };
    });
    expect(dimensions.overflow, 'Mural não pode criar colunas extras').toBeLessThanOrEqual(1);
    expect(dimensions.outside, 'Pergaminhos não podem sair da moldura').toBe(0);
    expect(dimensions.cardOverlap, 'Pergaminhos não podem se sobrepor').toBe(false);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
      .toBeLessThanOrEqual(1);

    const interior = page.locator('.arquivo-mural__interior');
    const intro = page.locator('.arquivo-intro');
    await expect(intro).toBeVisible();
    const padding = await interior.evaluate(el => parseFloat(getComputedStyle(el).paddingTop));
    expect(padding, 'Subtítulo precisa descer para não encostar no brasão').toBeGreaterThanOrEqual(28);
    await expect(page.locator('.arquivo-filtro[aria-pressed="true"]')).toHaveCount(1);

    await page.getByRole('button', { name: '⚒ BACKEND & DEVOPS' }).click();
    await expect(cards).toHaveCount(2);
    await expect.poll(() => grid.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    await page.getByRole('button', { name: /TASK MANAGER/ }).click();
    const modal = page.getByRole('dialog', { name: 'TASK MANAGER' });
    await expect(modal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
    await page.getByRole('button', { name: '✧ FRONT-END' }).click();
    await expect(cards).toHaveCount(1);
    await expect.poll(() => grid.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  });
}

test('Arquivo mantém tipografia pixel, hierarquia cromática e filtros touch', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/projetos');
  await page.evaluate(() => document.fonts.ready);
  const title = page.locator('.arquivo-grid .guilda-cartaz__titulo').first();
  const titleStyle = await title.evaluate(el => ({
    family: getComputedStyle(el).fontFamily,
    color: getComputedStyle(el).color,
  }));
  expect(titleStyle.family).toContain('Press Start 2P');
  expect(titleStyle.color).toBe('rgb(80, 38, 18)');
  const filters = await page.locator('.arquivo-filtro').evaluateAll(elements =>
    elements.map(el => el.getBoundingClientRect().height));
  expect(filters.every(height => height >= 44)).toBe(true);
  const controls = await page.locator('.arquivo-grid .guilda-cartaz').count();
  expect(controls).toBe(8);
});
