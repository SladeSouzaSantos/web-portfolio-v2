import { expect, test } from './fixtures';

for (const width of [320, 375, 768, 1440]) {
  test(`Sumário do Herói fica centralizado em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/#sobre');
    const summary = page.locator('.painel-descricao .descricao-texto');
    await expect(summary).toBeVisible();
    await expect(summary).toHaveCSS('text-align', 'center');
    await expect(summary).toContainText('desenvolvedor de software');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
      .toBeLessThanOrEqual(1);
  });
}

for (const viewport of [
  { width: 320, route: '/#projetos', card: '.guilda-projetos-grid .guilda-cartaz' },
  { width: 1440, route: '/#projetos', card: '.guilda-projetos-grid .guilda-cartaz' },
  { width: 375, route: '/projetos', card: '.arquivo-grid .guilda-cartaz' },
  { width: 768, route: '/projetos', card: '.arquivo-grid .guilda-cartaz' },
]) {
  test(`Detalhe de missão centraliza categoria e descrição em ${viewport.width}px (${viewport.route})`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: 900 });
    await page.goto(viewport.route);
    await page.locator(viewport.card).first().click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    const category = modal.locator('.guilda-detalhes__tipo');
    const description = modal.locator('.guilda-detalhes__descricao');
    await expect(category).not.toBeEmpty();
    await expect(description).not.toBeEmpty();
    await expect(category).toHaveCSS('text-align', 'center');
    await expect(description).toHaveCSS('text-align', 'center');
    const colors = await modal.evaluate(element => {
      const c = element.querySelector('.guilda-detalhes__tipo')!;
      const d = element.querySelector('.guilda-detalhes__descricao')!;
      return {
        category: getComputedStyle(c).color,
        description: getComputedStyle(d).color,
        categoryFamily: getComputedStyle(c).fontFamily,
        descriptionFamily: getComputedStyle(d).fontFamily,
      };
    });
    expect(colors.category).not.toBe(colors.description);
    expect(colors.categoryFamily).toContain('Press Start 2P');
    expect(colors.descriptionFamily).toContain('Press Start 2P');
    await expect(modal.locator('.projeto-detalhe__figura')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
      .toBeLessThanOrEqual(1);
    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
  });
}
