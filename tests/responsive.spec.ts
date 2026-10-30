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

for (const width of [270, 320, 375]) {
  test(`mobile: full navigation labels fit their buttons at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/');
    const loadedFonts = await page.evaluate(() => document.fonts.load('12px "Press Start 2P"').then(fonts => fonts.length));
    expect(loadedFonts, 'Navigation must fit with the actual pixel font loaded').toBeGreaterThan(0);

    const links = page.locator('.bloco-navegacao-centro a');
    const labels = links.locator('.nav-section-label');
    await expect(labels).toHaveText(['SOBRE', 'PROJETOS', 'EXPERIÊNCIA', 'FORMAÇÃO']);
    for (const label of await labels.all()) await expect(label).toBeVisible();

    const measurements = await links.evaluateAll(elements => elements.map(element => {
      const label = element.querySelector<HTMLElement>('.nav-section-label')!;
      const range = document.createRange();
      range.selectNodeContents(label);
      const text = range.getBoundingClientRect();
      const button = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        label: label.textContent,
        textLeft: text.left,
        textRight: text.right,
        textWidth: text.width,
        contentLeft: button.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft),
        contentRight: button.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight),
        buttonHeight: button.height,
        clippedWidth: label.scrollWidth - label.clientWidth,
      };
    }));

    for (const [index, measurement] of measurements.entries()) {
      const context = `${measurement.label} at ${width}px`;
      expect(measurement.textWidth, `${context}: the complete label must be rendered`).toBeGreaterThan(0);
      expect(measurement.textLeft, `${context}: text must fit inside its own button`)
        .toBeGreaterThanOrEqual(measurement.contentLeft - 1);
      expect(measurement.textRight, `${context}: text must fit inside its own button`)
        .toBeLessThanOrEqual(measurement.contentRight + 1);
      expect(measurement.clippedWidth, `${context}: the label must not be truncated`).toBeLessThanOrEqual(1);
      expect(measurement.buttonHeight, `${context}: retain a usable touch target`).toBeGreaterThanOrEqual(44);
      const next = measurements[index + 1];
      if (next) {
        expect(measurement.textRight, `${context}: labels must not overlap their neighbours`)
          .toBeLessThanOrEqual(next.textLeft);
      }
    }
    const navigationOverflow = await page.locator('.bloco-navegacao-centro')
      .evaluate(element => element.scrollWidth - element.clientWidth);
    expect(navigationOverflow, 'Every navigation tab must fit without horizontal scrolling').toBeLessThanOrEqual(1);
    await expectControlsWithinViewport(page);
  });
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
    const filter = page.getByRole('button', { name: '⚒ BACKEND & DEVOPS', exact: true });
    await filter.click();
    await expect(filter).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.arquivo-grid .guilda-cartaz')).toHaveCount(2);
    await page.getByRole('button', { name: /Ver detalhes de TASK MANAGER/ }).click();
    const dialog = page.getByRole('dialog', { name: 'TASK MANAGER', exact: true });
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
