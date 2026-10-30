import { expect, test } from './fixtures';

test('Guilda mostra cinco cartazes e os dados de uma missão técnica', async ({ page }) => {
  await page.goto('/#projetos');
  const cartazes = page.locator('.guilda-projetos-grid .guilda-cartaz');
  await expect(cartazes).toHaveCount(5);
  await expect(cartazes.nth(0)).toHaveAttribute('data-guilda-projeto', 'greencity-os');
  await expect(cartazes.nth(4)).toHaveAttribute('data-guilda-projeto', 'guardrails-prompt-injection');

  await cartazes.nth(0).click();
  const dialogo = page.getByRole('dialog', { name: 'GREENCITY OS' });
  await expect(dialogo).toContainText('DESAFIOS E SOLUÇÕES');
  await expect(dialogo).toContainText('BLoC');
  await expect(dialogo.getByRole('img', { name: /Tela real do aplicativo/ })).toBeVisible();
  await expect(dialogo.getByRole('link', { name: /GITHUB/ }))
    .toHaveAttribute('href', 'https://github.com/SladeSouzaSantos/greencity-os');
});

test('hover com mouse revela o verso sem perder a ação de abrir detalhes', async ({ page }) => {
  await page.goto('/#projetos');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const cartaz = page.locator('.guilda-cartaz').first();
  await cartaz.hover();
  await expect.poll(() => cartaz.locator('.guilda-cartaz__folha')
    .evaluate(element => getComputedStyle(element).transform))
    .not.toBe('none');
  await expect(cartaz.locator('.guilda-cartaz__face--verso img')).toHaveAttribute('src', /greencity-os.webp$/);
  await cartaz.click();
  await expect(page.getByRole('dialog', { name: 'GREENCITY OS' })).toBeVisible();
});

test('movimento reduzido desabilita giro, mas mantém o detalhe acessível', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#projetos');
  const cartaz = page.locator('.guilda-cartaz').first();
  await cartaz.focus();
  await expect(cartaz.locator('.guilda-cartaz__folha')).toHaveCSS('transform', 'none');
  await cartaz.press('Enter');
  await expect(page.getByRole('dialog', { name: 'GREENCITY OS' })).toBeVisible();
});

test('arquivo preserva demonstração web, APK e conteúdo de segurança', async ({ page }) => {
  await page.goto('/projetos');
  const cardHsp = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'HSP SIMULATOR' }) });
  await cardHsp.getByRole('button', { name: /Ver detalhes/ }).click();
  await expect(page.getByRole('dialog').getByRole('link', { name: /ABRIR SIMULADOR/ }))
    .toHaveAttribute('href', 'https://hsp.greencity.net.br/');
  await page.keyboard.press('Escape');

  const cardGas = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'RESERGAS' }) });
  await cardGas.getByRole('button', { name: /Ver detalhes/ }).click();
  await expect(page.getByRole('dialog').getByRole('link', { name: /BAIXAR APK/ }))
    .toHaveAttribute('href', /resergas\.apk$/);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: '✧ IA & SEGURANÇA' }).click();
  await page.getByRole('button', { name: 'Ver detalhes de GUARDRAILS & IA' }).click();
  await expect(page.getByRole('dialog')).toContainText('prompt injection');
});
