import { expect, test, type Page } from '@playwright/test';

const archiveHeading = 'ARQUIVO DE MISSÕES';
const guildHeading = 'QUADRO DE MISSÕES';

async function expectMetadata(page: Page, archive: boolean) {
  await expect(page).toHaveTitle(archive ? 'Arquivo de Missões | PHASSCODE' : 'Pedro Santos | PHASSCODE');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', archive
    ? 'Arquivo de Missões do PHASSCODE — navegue pelo catálogo de projetos e tecnologias de Pedro Santos.'
    : 'Portfólio de Pedro Santos: desenvolvimento de software, projetos, experiência profissional e formação em uma jornada RPG em pixel art.');
}

test('the project archive supports direct access and a browser refresh', async ({ page }) => {
  await page.goto('/projetos');
  await expect(page).toHaveURL(/\/projetos$/);
  await expect(page.getByRole('heading', { name: archiveHeading, exact: true })).toBeVisible();
  await expect(page.locator('.arquivo-grid').getByRole('article')).toHaveCount(5);
  await expectMetadata(page, true);

  await page.reload();
  await expect(page).toHaveURL(/\/projetos$/);
  await expect(page.getByRole('heading', { name: archiveHeading, exact: true })).toBeVisible();
  await expect(page.locator('.arquivo-grid').getByRole('article')).toHaveCount(5);
  await expectMetadata(page, true);
});

test('archive links and browser history navigate within the same document', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'PEDRO SANTOS', exact: true })).toBeVisible();
  // A full document load would discard this marker, even when storage and theme survive.
  const marker = await page.evaluate(() => {
    const value = crypto.randomUUID();
    Reflect.set(window, '__portfolioRouteDocument', value);
    return value;
  });
  const expectSameDocument = async () => {
    expect(await page.evaluate(() => Reflect.get(window, '__portfolioRouteDocument'))).toBe(marker);
  };

  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Projetos', exact: true }).click();
  await expect(page).toHaveURL(/\/#projetos$/);
  await expect(page.getByRole('heading', { name: guildHeading, exact: true })).toBeVisible();
  await expectSameDocument();

  await page.getByRole('link', { name: 'Explorar outros projetos no Arquivo de Missões' }).click();
  await expect(page).toHaveURL(/\/projetos$/);
  await expect(page.getByRole('heading', { name: archiveHeading, exact: true })).toBeVisible();
  await expectSameDocument();

  await page.getByRole('link', { name: '← RETORNAR AO PORTFÓLIO', exact: true }).click();
  await expect(page).toHaveURL(/\/#projetos$/);
  await expect(page.getByRole('heading', { name: guildHeading, exact: true })).toBeVisible();
  await expectSameDocument();

  await page.goBack();
  await expect(page).toHaveURL(/\/projetos$/);
  await expect(page.getByRole('heading', { name: archiveHeading, exact: true })).toBeVisible();
  await expectSameDocument();
  await page.goBack();
  await expect(page).toHaveURL(/\/#projetos$/);
  await expect(page.getByRole('heading', { name: guildHeading, exact: true })).toBeVisible();
  await expectSameDocument();
  await page.goForward();
  await expect(page).toHaveURL(/\/projetos$/);
  await expect(page.getByRole('heading', { name: archiveHeading, exact: true })).toBeVisible();
  await expectSameDocument();
  await page.goForward();
  await expect(page).toHaveURL(/\/#projetos$/);
  await expect(page.getByRole('heading', { name: guildHeading, exact: true })).toBeVisible();
  await expectSameDocument();
});

for (const route of [
  { legacy: '/projetos.html?origem=legado#catalogo', canonical: /\/projetos\?origem=legado#catalogo$/, heading: archiveHeading },
  { legacy: '/index.html?origem=legado#experiencia', canonical: /\/\?origem=legado#experiencia$/, heading: 'CRÔNICAS DA JORNADA' },
]) {
  test(`${route.legacy} redirects to its canonical route and replaces the legacy history entry`, async ({ page }) => {
    await page.goto('/#sobre');
    await expect(page.getByRole('heading', { name: 'PEDRO SANTOS', exact: true })).toBeVisible();
    await page.goto(route.legacy);
    await expect(page).toHaveURL(route.canonical);
    await expect(page.getByRole('heading', { name: route.heading, exact: true })).toBeVisible();

    // Back must return to the prior page instead of another legacy URL redirect.
    await page.goBack();
    await expect(page).toHaveURL(/\/#sobre$/);
    await expect(page.getByRole('heading', { name: 'PEDRO SANTOS', exact: true })).toBeVisible();
  });
}

test('title and description follow the active page and browser history', async ({ page }) => {
  await page.goto('/#projetos');
  await expectMetadata(page, false);
  await page.getByRole('link', { name: 'Explorar outros projetos no Arquivo de Missões' }).click();
  await expect(page.getByRole('heading', { name: archiveHeading, exact: true })).toBeVisible();
  await expectMetadata(page, true);
  await page.getByRole('link', { name: '← VOLTAR AO PORTFÓLIO', exact: true }).click();
  await expect(page.getByRole('heading', { name: guildHeading, exact: true })).toBeVisible();
  await expectMetadata(page, false);
  await page.goBack();
  await expect(page.getByRole('heading', { name: archiveHeading, exact: true })).toBeVisible();
  await expectMetadata(page, true);
  await page.goForward();
  await expect(page.getByRole('heading', { name: guildHeading, exact: true })).toBeVisible();
  await expectMetadata(page, false);
});
