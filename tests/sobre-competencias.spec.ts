import { expect, test } from './fixtures';

test('Sobre Mim destaca desenvolvimento e separa prática de estudos', async ({ page }) => {
  await page.goto('/#sobre');
  const summary = page.locator('.painel-descricao .descricao-texto');
  await expect(summary).toContainText('desenvolvedor de software');
  await expect(summary).toContainText('Java, Hibernate e PostgreSQL');
  await expect(summary).toContainText('backend Java, arquitetura de software e Engenharia de IA');
  await expect(summary).not.toContainText('sólida base em sistemas e energias renováveis');
  await expect(page.locator('.perfil-cargo')).toHaveText('DESENVOLVEDOR DE SOFTWARE');

  const cards = page.locator('.skill-categoria-box');
  await expect(cards).toHaveCount(4);
  for (const card of await cards.all()) {
    await expect(card.locator('.skill-cat-resumo')).not.toBeEmpty();
    await expect(card.locator('.skill-cat-aprofundamento')).toContainText('EM APROFUNDAMENTO:');
    await expect(card.locator('.skill-cat-evidencias summary')).toBeVisible();
    await expect(card.locator('.skill-cat-evidencias')).not.toHaveAttribute('open');
    await card.locator('.skill-cat-evidencias summary').click();
    await expect(card.locator('.skill-cat-evidencias')).toHaveAttribute('open', '');
    await expect(card.locator('.skill-cat-evidencias a')).toHaveCount(2);
    await card.locator('.skill-cat-evidencias summary').click();
    await expect(card.locator('.skill-cat-evidencias')).not.toHaveAttribute('open');
  }
});

test('Evidências dos cards podem ser abertas pelo teclado sem deslocamento horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#sobre');
  const details = page.locator('.skill-cat-evidencias').first();
  const summary = details.locator('summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(details).toHaveAttribute('open', '');
  await expect(details.getByRole('link', { name: /Experiência no SIGAA/ })).toHaveAttribute('href', '/#experiencia');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
    .toBeLessThanOrEqual(1);
  await page.keyboard.press('Enter');
  await expect(details).not.toHaveAttribute('open');
});

test('Evidências externas são links reais seguros', async ({ page }) => {
  await page.goto('/#sobre');
  const links = page.locator('.skill-cat-evidencias a[href^="https://"]');
  await expect(links).toHaveCount(7);
  for (const link of await links.all()) {
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener noreferrer/);
  }
});
