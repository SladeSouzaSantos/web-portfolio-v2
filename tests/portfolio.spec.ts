import { expect, test, type Page } from './fixtures';

const sections = [
  { hash: 'sobre', link: 'Sobre Pedro Santos', heading: 'PEDRO SANTOS' },
  { hash: 'projetos', link: 'Projetos', heading: 'QUADRO DE MISSÕES' },
  { hash: 'experiencia', link: 'Experiência', heading: 'CRÔNICAS DA JORNADA' },
  { hash: 'academico', link: 'Formação acadêmica', heading: 'ACADEMIA ARCANA' },
] as const;

async function navigateTo(page: Page, section: typeof sections[number]) {
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: section.link, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`#${section.hash}$`));
  await expect(page.getByRole('heading', { name: section.heading, exact: true })).toBeVisible();
}

test('hashes select sections and browser history restores navigation', async ({ page }) => {
  await page.goto('/#projetos');
  await expect(page.getByRole('heading', { name: 'QUADRO DE MISSÕES' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Projetos', exact: true })).toHaveAttribute('aria-current', 'page');

  await navigateTo(page, sections[2]);
  await navigateTo(page, sections[3]);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'CRÔNICAS DA JORNADA' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Experiência', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'QUADRO DE MISSÕES' })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'CRÔNICAS DA JORNADA' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'CRÔNICAS DA JORNADA' })).toBeVisible();
});

test('project details isolate the background, trap keyboard focus and restore it on Escape', async ({ page }) => {
  await page.goto('/#projetos');
  const trigger = page.getByRole('button', { name: /GREENCITY OS/ });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'GREENCITY OS', exact: true });
  const close = dialog.getByRole('button', { name: 'Fechar detalhes', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Aplicação Flutter');
  await expect(dialog).toContainText('Flutter');
  await expect(page.locator('#root')).toHaveJSProperty('inert', true);
  await expect(close).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('link', { name: /GITHUB/ })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('#root')).toHaveJSProperty('inert', false);
  await expect(trigger).toBeFocused();
});

test('the backdrop closes details and a different project opens with its own content', async ({ page }) => {
  await page.goto('/#projetos');
  const first = page.getByRole('button', { name: /GREENCITY OS/ });
  await first.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('.guilda-detalhes').click({ position: { x: 2, y: 2 } });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(first).toBeFocused();

  await page.getByRole('button', { name: /HSP SIMULATOR/ }).click();
  const dialog = page.getByRole('dialog', { name: 'HSP SIMULATOR', exact: true });
  await expect(dialog).toContainText('dados meteorológicos horários');
  await expect(dialog).toContainText('pvlib');
  await expect(dialog).not.toContainText('Isar');
  await dialog.getByRole('button', { name: 'Fechar detalhes' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('the archive filters the five selected projects and restores all', async ({ page }) => {
  await page.goto('/#projetos');
  await page.getByRole('link', { name: /ARQUIVO DE MISSÕES EXPLORAR OUTROS PROJETOS/ }).click();
  await expect(page).toHaveURL(/\/projetos$/);
  const cards = page.locator('.arquivo-grid').getByRole('article');
  await expect(cards).toHaveCount(5);

  const ai = page.getByRole('button', { name: '✧ IA & SEGURANÇA', exact: true });
  await ai.click();
  await expect(ai).toHaveAttribute('aria-pressed', 'true');
  await expect(cards).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'GUARDRAILS & IA' })).toBeVisible();

  await page.getByRole('button', { name: '▣ MOBILE', exact: true }).click();
  await expect(cards).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'GREENCITY OS' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'RESERGAS' })).toBeVisible();

  await page.getByRole('button', { name: '⚒ FERRAMENTAS', exact: true }).click();
  await expect(cards).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'HSP SIMULATOR' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'GREENCITY API' })).toBeVisible();

  await page.getByRole('button', { name: '✦ TODOS', exact: true }).click();
  await expect(cards).toHaveCount(5);
});

test('archive details preserve the selected filter and return to the Guild', async ({ page }) => {
  await page.goto('/projetos');
  await page.getByRole('button', { name: '⚒ FERRAMENTAS', exact: true }).click();
  const trigger = page.getByRole('button', { name: 'Ver detalhes de GREENCITY API', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'GREENCITY API', exact: true });
  await expect(dialog).toContainText('propostas comerciais');
  await expect(dialog).toContainText('Laravel');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.getByRole('button', { name: '⚒ FERRAMENTAS', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.arquivo-grid').getByRole('article')).toHaveCount(2);
  await page.getByRole('link', { name: '← RETORNAR AO PORTFÓLIO', exact: true }).click();
  await expect(page).toHaveURL(/\/#projetos$/);
  await expect(page.getByRole('heading', { name: 'QUADRO DE MISSÕES' })).toBeVisible();
});

test('the selected theme survives reloads and a visit to the archive', async ({ page }) => {
  await page.goto('/#projetos');
  await page.getByRole('button', { name: 'Ativar tema claro', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ativar tema escuro', exact: true })).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/modo-claro/);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Ativar tema escuro', exact: true })).toBeVisible();
  await page.getByRole('link', { name: /ARQUIVO DE MISSÕES EXPLORAR OUTROS PROJETOS/ }).click();
  await expect(page.getByRole('heading', { name: 'ARQUIVO DE MISSÕES', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '← VOLTAR AO PORTFÓLIO', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ativar tema escuro', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ativar tema escuro', exact: true }).click();
  await expect(page.locator('body')).toHaveClass(/modo-escuro/);
});

test('reduced motion keeps every scene static without requesting GIFs', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const gifRequests: string[] = [];
  page.on('request', request => {
    if (/\.gif(?:[?#]|$)/i.test(request.url())) gifRequests.push(request.url());
  });
  await page.goto('/#sobre');
  await expect(page.getByRole('heading', { name: 'PEDRO SANTOS', exact: true })).toBeVisible();
  for (const section of sections.slice(1)) await navigateTo(page, section);
  await navigateTo(page, sections[1]);
  await page.getByRole('link', { name: /ARQUIVO DE MISSÕES EXPLORAR OUTROS PROJETOS/ }).click();
  await expect(page.getByRole('heading', { name: 'ARQUIVO DE MISSÕES', exact: true })).toBeVisible();
  expect(gifRequests).toEqual([]);
});

test('animated scenes can be mounted repeatedly without JavaScript runtime errors', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#sobre');
  for (let cycle = 0; cycle < 2; cycle += 1) {
    for (const section of sections) {
      await navigateTo(page, section);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    }
  }
  await navigateTo(page, sections[1]);
  await page.getByRole('button', { name: /GREENCITY API/ }).click();
  await expect(page.getByRole('dialog', { name: 'GREENCITY API', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: /ARQUIVO DE MISSÕES EXPLORAR OUTROS PROJETOS/ }).click();
  await expect(page.getByRole('heading', { name: 'ARQUIVO DE MISSÕES', exact: true })).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

for (const width of [320, 375]) {
  test(`sections and archive fit a ${width}px viewport without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/#sobre');
    for (const section of sections) {
      await navigateTo(page, section);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      const overflowingControls = await page.locator('main button, main a[href]').evaluateAll(elements => elements.flatMap(element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && (rect.left < -1 || rect.right > window.innerWidth + 1) ? [element.textContent?.trim()] : [];
      }));
      expect(overflowingControls, `Controls must remain readable and reachable in ${section.hash}`).toEqual([]);
    }
    await navigateTo(page, sections[1]);
    await page.getByRole('link', { name: /ARQUIVO DE MISSÕES EXPLORAR OUTROS PROJETOS/ }).click();
    await expect(page.getByRole('heading', { name: 'ARQUIVO DE MISSÕES', exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await page.getByRole('button', { name: 'Ver detalhes de GREENCITY OS', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'GREENCITY OS', exact: true });
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    await page.keyboard.press('Escape');
  });
}

