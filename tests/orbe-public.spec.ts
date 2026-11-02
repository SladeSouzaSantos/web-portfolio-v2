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
  await expect(dialog).toContainText('Conheça Pedro Santos para sua próxima oportunidade');
  await expect(dialog).not.toContainText('REVISAR PROPOSTA DE REUNIÃO');
  await expect(dialog.getByRole('textbox', { name: 'Sua pergunta ao orbe' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('Orbe aceita quebras de linha e alterna entre janela normal e maximizada', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir guia do portfólio' }).click();
  const dialog = page.getByRole('dialog', { name: /CONSULTAR ORBE MÁGICO/ });
  const composer = dialog.getByRole('textbox', { name: 'Sua pergunta ao orbe' });
  const expand = dialog.getByRole('button', { name: 'Maximizar chat' });
  await expect(expand).toHaveAttribute('aria-pressed', 'false');
  const regular = await dialog.boundingBox();
  expect(regular).not.toBeNull();
  await expand.click();
  await expect(dialog).toHaveClass(/orb-chat-panel-expanded/);
  const enlarged = await dialog.boundingBox();
  expect(enlarged).not.toBeNull();
  expect(enlarged!.width).toBeGreaterThan(regular!.width);
  expect(enlarged!.height).toBeGreaterThan(regular!.height);
  await composer.fill('Primeira linha');
  await composer.press('Shift+Enter');
  await composer.type('Segunda linha');
  await expect(composer).toHaveValue('Primeira linha\\nSegunda linha'.replace('\\n', '\n'));
  await dialog.getByRole('button', { name: 'Restaurar tamanho do chat' }).click();
  await expect(dialog).not.toHaveClass(/orb-chat-panel-expanded/);
  await expect(composer).toHaveValue(/Primeira linha/);
  const restored = await dialog.boundingBox();
  expect(restored).not.toBeNull();
  expect(restored!.width).toBeLessThan(enlarged!.width);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('Orbe mantém textarea e controles acessíveis em telas pequenas', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir guia do portfólio' }).click();
  const dialog = page.getByRole('dialog', { name: /CONSULTAR ORBE MÁGICO/ });
  const composer = dialog.getByRole('textbox', { name: 'Sua pergunta ao orbe' });
  await expect(composer).toHaveAttribute('maxlength', '2000');
  await composer.fill('Uma pergunta com quebra');
  await composer.press('Shift+Enter');
  await composer.type('continuação');
  await expect(composer).toHaveValue(/Uma pergunta com quebra\ncontinuação/);
  await dialog.getByRole('button', { name: 'Maximizar chat' }).click();
  await expect(dialog).toHaveClass(/orb-chat-panel-expanded/);
  expect(await dialog.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  await expect(dialog.getByRole('button', { name: 'Restaurar tamanho do chat' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Fechar guia do portfólio' })).toBeVisible();
});
