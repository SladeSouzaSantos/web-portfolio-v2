import { expect, test } from './fixtures';

test.use({ reducedMotion: 'reduce' });

test('orbe abre pelo teclado, contém o foco e devolve o foco ao fechar', async ({ page }) => {
  await page.goto('/#projetos');
  const trigger = page.getByRole('button', { name: 'Abrir guia do portfólio', exact: true });

  // Reach the launcher through the actual tab order, including the section cards.
  for (let index = 0; index < 40; index++) {
    await page.keyboard.press('Tab');
    if (await trigger.evaluate(element => element === document.activeElement)) break;
  }
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: /CONSULTAR ORBE MÁGICO/ });
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole('button', { name: 'Fechar guia do portfólio' });
  await expect(close).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');

  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'ENVIAR', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('heading', { name: 'QUADRO DE MISSÕES', exact: true })).toBeVisible();
});

test('orbe mantém HTML enviado como texto e preserva a conversa ao reabrir', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Abrir guia do portfólio', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: /CONSULTAR ORBE MÁGICO/ });
  const input = dialog.getByRole('textbox', { name: 'Sua pergunta ao orbe' });
  const history = dialog.getByRole('log', { name: 'Conversa com o orbe' });
  const payload = '<img src=x onerror="document.documentElement.setAttribute(\'data-orb-injected\',\'true\')">';

  await input.fill(payload);
  await input.press('Enter');
  await expect(history.locator('.user-msg')).toContainText(payload);
  await expect(input).toHaveValue('');
  await expect(history).toContainText('Este guia tem respostas demonstrativas.');
  await expect(history.locator('img')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveAttribute('data-orb-injected');

  await input.fill('Quais são os projetos de Pedro?');
  await dialog.getByRole('button', { name: 'ENVIAR', exact: true }).click();
  await expect(history).toContainText('SDGP');
  await expect(history).toContainText('Lithology');
  await dialog.getByRole('button', { name: 'Fechar guia do portfólio' }).click();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await expect(history.locator('.user-msg')).toHaveCount(2);
  await expect(history).toContainText(payload);
  await expect(history.locator('img')).toHaveCount(0);
});

test('abrir e fechar login mantém a seção selecionada e restaura o foco', async ({ page }) => {
  await page.goto('/#experiencia');
  const heading = page.getByRole('heading', { name: 'CRÔNICAS DA JORNADA', exact: true });
  const trigger = page.getByRole('button', { name: 'Abrir prévia de login', exact: true });
  await expect(heading).toBeVisible();
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: /PORTAL DE AUTENTICAÇÃO/ });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('nenhuma credencial é enviada ou validada');
  await expect(page.locator('#restricted-title')).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(heading).toBeVisible();
  await expect(page).toHaveURL(/#experiencia$/);

  await trigger.click();
  await dialog.getByRole('button', { name: 'Fechar login', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(heading).toBeVisible();
});

test('login demonstrativo alterna senha, libera menu e permite visitar painel e sair', async ({ page }) => {
  await page.goto('/#projetos');
  await page.getByRole('button', { name: 'Abrir prévia de login', exact: true }).click();
  const login = page.getByRole('dialog', { name: /PORTAL DE AUTENTICAÇÃO/ });
  const username = login.getByLabel('IDENTIFICAÇÃO (USER):', { exact: true });
  const password = login.getByLabel('CHAVE MÁGICA (SENHA):', { exact: true });
  await username.fill('visitante-demo');
  await password.fill('senha-ficticia');
  await expect(password).toHaveAttribute('type', 'password');

  await login.getByRole('button', { name: 'Mostrar senha', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'text');
  const hidePassword = login.getByRole('button', { name: 'Ocultar senha', exact: true });
  await expect(hidePassword).toHaveAttribute('aria-pressed', 'true');
  await hidePassword.click();
  await expect(password).toHaveAttribute('type', 'password');

  await login.getByRole('button', { name: 'DESTRAVAR PORTAL', exact: true }).click();
  await expect(username).toBeDisabled();
  await expect(password).toBeDisabled();
  await expect(login.getByRole('button', { name: 'AGUARDE...', exact: true })).toBeDisabled();
  await expect(login.getByRole('status')).toHaveText('Verificando runas ancestrais...');
  await expect(login).toHaveCount(0, { timeout: 5000 });
  const chest = page.getByRole('button', { name: 'Abrir baú do mestre', exact: true });
  await expect(chest).toBeFocused();
  await expect(page.getByRole('heading', { name: 'QUADRO DE MISSÕES', exact: true })).toBeVisible();

  await chest.click();
  const menu = page.getByRole('dialog', { name: /BAÚ DO MESTRE: ATIVO/ });
  await menu.getByRole('button', { name: /IR PARA ÁREA RESTRITA/ }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '[ ÁREA RESTRITA ]', exact: true })).toBeVisible();
  await expect(page.getByText('Prévia visual do painel do Mestre.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'VOLTAR AO PORTFÓLIO', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'QUADRO DE MISSÕES', exact: true })).toBeVisible();

  await chest.click();
  await menu.getByRole('button', { name: /TRANCAR BAÚ \(LOGOUT\)/ }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Abrir prévia de login', exact: true })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'QUADRO DE MISSÕES', exact: true })).toBeVisible();
});
