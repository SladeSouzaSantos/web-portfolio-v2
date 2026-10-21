import { expect, test, type Page } from './fixtures';

const sections = [
  { link: 'Sobre Pedro Santos', heading: 'PEDRO SANTOS' },
  { link: 'Projetos', heading: 'QUADRO DE MISSÕES' },
  { link: 'Experiência', heading: 'CRÔNICAS DA JORNADA' },
  { link: 'Formação acadêmica', heading: 'ACADEMIA ARCANA' },
] as const;

async function expectControlsWithinViewport(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
    .toBeLessThanOrEqual(1);
  const clippedControls = await page.locator('nav a, nav button, main a, main button').evaluateAll(elements =>
    elements.flatMap(element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1)
        ? [element.getAttribute('aria-label') ?? element.textContent?.trim()]
        : [];
    }));
  expect(clippedControls, 'Navigation and content controls must remain within the viewport').toEqual([]);
}

for (const viewport of [
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
]) {
  test(`${viewport.name}: navigation, archive filters and modal remain usable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const navigation = page.getByRole('navigation', { name: 'Navegação principal', exact: true });

    for (const section of sections) {
      await navigation.getByRole('link', { name: section.link, exact: true }).click();
      const heading = page.getByRole('heading', { name: section.heading, exact: true });
      await expect(heading).toBeVisible();
      // The guild title is screen-reader text inside the illustrated wooden frame.
      const sectionContent = page.getByRole('region', { name: section.heading, exact: true });
      await expect(sectionContent).toBeInViewport();
      await expectControlsWithinViewport(page);
      const navigationBounds = await navigation.boundingBox();
      const contentBounds = await sectionContent.boundingBox();
      expect(navigationBounds).not.toBeNull();
      expect(contentBounds).not.toBeNull();
      expect(contentBounds!.y, 'The fixed navigation must not cover the section content')
        .toBeGreaterThanOrEqual(navigationBounds!.y + navigationBounds!.height);
    }

    await navigation.getByRole('link', { name: 'Projetos', exact: true }).click();
    await page.getByRole('link', { name: /ARQUIVO DE MISSÕES EXPLORAR OUTROS PROJETOS/ }).click();
    await expect(page.getByRole('heading', { name: 'ARQUIVO DE MISSÕES', exact: true })).toBeVisible();
    await expectControlsWithinViewport(page);
    const filter = page.getByRole('button', { name: '⚒ FERRAMENTAS', exact: true });
    await filter.click();
    await expect(filter).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.arquivo-grid').getByRole('article')).toHaveCount(1);
    await page.getByRole('button', { name: 'Ver detalhes de LITHOLOGY', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'LITHOLOGY', exact: true });
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1);
    const close = dialog.getByRole('button', { name: 'Fechar detalhes', exact: true });
    await expect(close).toBeInViewport();
    await close.click();
    await expect(dialog).toHaveCount(0);
  });
}
