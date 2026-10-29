import { expect, test } from './fixtures';

test('portfólio público não oferece baú, login, agenda nem administração', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'PEDRO SANTOS', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
  await expect(page.getByRole('button', { name: /login|baú|autentica|entrar com google/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Abrir guia do portfólio' })).toBeVisible();
  await page.goto('/administracao');
  await expect(page).toHaveURL(/\/#sobre$/);
  await expect(page.getByRole('heading', { name: 'PEDRO SANTOS', exact: true })).toBeVisible();
});

test('Orbe se apresenta como representante profissional sem ações de agendamento', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir guia do portfólio' }).click();
  const dialog = page.getByRole('dialog', { name: /CONSULTAR ORBE MÁGICO/ });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('representante virtual de Pedro Santos');
  await expect(dialog).not.toContainText('REVISAR PROPOSTA DE REUNIÃO');
  await expect(dialog.getByRole('textbox', { name: 'Sua pergunta ao orbe' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});
