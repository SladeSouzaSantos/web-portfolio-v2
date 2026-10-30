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

test('Arquivo oferece minijogos, repositórios e a placa inferior da Guilda', async ({ page }) => {
  await page.goto('/projetos');
  await expect(page.locator('.arquivo-grid .guilda-cartaz')).toHaveCount(8);
  await expect(page.locator('.arquivo-mural .guilda-mural__interior')).toBeVisible();
  const plate = page.locator('.arquivo-placa-rodape .guilda-arquivo__placa');
  await expect(plate).toHaveAttribute('href', 'https://github.com/SladeSouzaSantos?tab=repositories');

  await page.getByRole('button', { name: '♫ MINIJOGOS' }).click();
  await page.getByRole('button', { name: 'Ver detalhes de TECLADO SOUND' }).click();
  const sound = page.getByRole('dialog', { name: 'TECLADO SOUND' });
  await expect(sound.getByRole('link', { name: /EXPERIMENTAR/ }))
    .toHaveAttribute('href', 'https://projetos.phasscode.com/projetos/teclado_som/');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Ver detalhes de NÚMERO SECRETO' }).click();
  await expect(page.getByRole('dialog', { name: 'NÚMERO SECRETO' }).getByRole('link', { name: /JOGAR/ }))
    .toHaveAttribute('href', 'https://projetos.phasscode.com/projetos/n_secreto/');
});

test('Arquivo usa as mesmas faces e animações dos cartazes da Guilda', async ({ page }) => {
  await page.goto('/projetos');
  const card = page.locator('.arquivo-grid .guilda-cartaz').first();
  await expect(card.locator('.guilda-cartaz__face')).toHaveCount(2);
  await expect(card.locator('.guilda-cartaz__face--verso img')).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await card.hover();
  await expect.poll(() => card.locator('.guilda-cartaz__folha')
    .evaluate(el => getComputedStyle(el).transform)).not.toBe('none');
  await card.click();
  await expect(page.getByRole('dialog', { name: 'TASK MANAGER' })).toBeVisible();
});

test('Galerias mobile usam exatamente três telas e a proposta local é uma imagem WebP válida', async ({ page }) => {
  await page.goto('/#projetos');
  await page.locator('.guilda-cartaz[data-guilda-projeto="greencity-os"]').click();
  const green = page.getByRole('dialog', { name: 'GREENCITY OS' });
  await expect(green.locator('.projeto-midia--tripla img')).toHaveCount(3);
  for (const image of await green.locator('.projeto-midia--tripla img').all()) {
    await expect(image).toHaveJSProperty('complete', true);
    await expect.poll(() => image.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
  await page.keyboard.press('Escape');

  await page.locator('.guilda-cartaz[data-guilda-projeto="resergas"]').click();
  await expect(page.getByRole('dialog').locator('.projeto-midia--tripla img')).toHaveCount(3);
  await page.keyboard.press('Escape');

  await page.locator('.guilda-cartaz[data-guilda-projeto="greencity-api-orcamento"]').click();
  const image = page.getByRole('dialog').locator('img[src$="greencity-proposta.webp"]');
  await expect(image).toHaveCount(1);
  await expect.poll(() => image.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
});

test('Cartazes não deixam as legendas ultrapassarem a região interna do pergaminho', async ({ page }) => {
  await page.goto('/#projetos');
  const limits = await page.locator('.guilda-cartaz__conteudo').evaluateAll(items => items.map(el => {
    const area = el.getBoundingClientRect();
    return Array.from(el.children).every(child => {
      const r = child.getBoundingClientRect();
      return r.left >= area.left - 1 && r.right <= area.right + 1;
    });
  }));
  expect(limits.every(Boolean)).toBe(true);
});
