import AxeBuilder from '@axe-core/playwright';
import type { TestInfo } from '@playwright/test';
import { expect, test, type Page } from './fixtures';

async function expectAccessible(page: Page, testInfo: TestInfo, state: string) {
  await page.evaluate(() => document.fonts.ready);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  await testInfo.attach(`axe-${state}.json`, {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });
  expect.soft(results.violations.map(({ id, impact, nodes }) => ({
    id,
    impact,
    nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
  })), `Automatically detectable WCAG 2.1 A/AA violations in ${state}`).toEqual([]);
}

test('all main sections meet automated WCAG 2.1 A/AA checks in both themes', async ({ page }, testInfo) => {
  test.slow();
  await page.goto('/');
  const sections = [
    { link: 'Sobre Pedro Santos', heading: 'PEDRO SANTOS' },
    { link: 'Projetos', heading: 'QUADRO DE MISSÕES' },
    { link: 'Experiência', heading: 'CRÔNICAS DA JORNADA' },
    { link: 'Formação acadêmica', heading: 'ACADEMIA ARCANA' },
  ];

  for (const theme of ['dark', 'light']) {
    if (theme === 'light') {
      await page.getByRole('button', { name: 'Ativar tema claro', exact: true }).click();
      await expect(page.locator('body')).toHaveClass(/modo-claro/);
    }
    for (const section of sections) {
      await page.getByRole('navigation', { name: 'Navegação principal', exact: true })
        .getByRole('link', { name: section.link, exact: true }).click();
      await expect(page.getByRole('heading', { name: section.heading, exact: true })).toBeVisible();
      await expectAccessible(page, testInfo, `${theme}-${section.link}`);
    }
  }
});

test('archive and project details meet automated WCAG 2.1 A/AA checks', async ({ page }, testInfo) => {
  await page.goto('/projetos');
  await expect(page.getByRole('heading', { name: 'ARQUIVO DE MISSÕES', exact: true })).toBeVisible();
  await expectAccessible(page, testInfo, 'archive');
  await page.getByRole('button', { name: 'Ver detalhes de SMART MODEL ROUTER', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'SMART MODEL ROUTER', exact: true })).toBeVisible();
  await expectAccessible(page, testInfo, 'archive-project-details');
});

test('login and assistant dialogs meet automated WCAG 2.1 A/AA checks', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir prévia de login', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /PORTAL DE AUTENTICAÇÃO/ })).toBeVisible();
  await expectAccessible(page, testInfo, 'login');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Abrir guia do portfólio', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /CONSULTAR ORBE MÁGICO/ })).toBeVisible();
  await expectAccessible(page, testInfo, 'assistant');
});
