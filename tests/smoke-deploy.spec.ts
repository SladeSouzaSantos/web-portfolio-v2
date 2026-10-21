import { readFile } from 'node:fs/promises';
import { expect, test } from './fixtures';

for (const route of [
  { path: '/', heading: 'PEDRO SANTOS' },
  { path: '/projetos', heading: 'ARQUIVO DE MISSÕES' },
]) {
  test(`publicação carrega ${route.path} diretamente e após atualizar`, async ({ page }) => {
    const response = await page.goto(route.path);
    expect(response?.status()).toBe(200);
    expect(response?.headers()['content-type']).toContain('text/html');
    await expect(page.getByRole('heading', { name: route.heading, exact: true })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: route.heading, exact: true })).toBeVisible();
  });
}

test('publicação permite navegar até o catálogo e abrir um projeto', async ({ page }) => {
  await page.goto('/#projetos');
  await page.getByRole('link', { name: /ARQUIVO DE MISSÕES/i }).click();
  await expect(page).toHaveURL(/\/projetos$/);
  await expect(page.getByRole('heading', { name: 'ARQUIVO DE MISSÕES', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Ver detalhes de / }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('HTML e bundles publicados correspondem ao build aprovado', async ({ page, request }) => {
  // In CI this is the original dist artifact from the tests job, not a new build.
  test.skip(!process.env.SMOKE_EXPECTED_DIST, 'Defina SMOKE_EXPECTED_DIST para conferir a release exata.');
  const expectedHTML = await readFile(`${process.env.SMOKE_EXPECTED_DIST}/index.html`, 'utf8');
  const assets = [...expectedHTML.matchAll(/(?:src|href)="(\/assets\/[^"?#]+\.(?:js|css))"/g)].map(match => match[1]);
  expect(assets.some(asset => asset.endsWith('.js'))).toBe(true);
  expect(assets.some(asset => asset.endsWith('.css'))).toBe(true);
  const response = await page.goto(`/?smoke=${encodeURIComponent(process.env.GITHUB_SHA ?? 'manual')}`);
  const publicHTML = await response!.text();
  for (const asset of assets) {
    expect(publicHTML, `HTML público deve referenciar ${asset}`).toContain(asset);
    const published = await request.get(asset);
    expect(published.status(), asset).toBe(200);
    expect(published.headers()['content-type']).toMatch(asset.endsWith('.js') ? /(?:java|ecma)script/ : /text\/css/);
    const expected = await readFile(`${process.env.SMOKE_EXPECTED_DIST}${asset}`);
    expect(Buffer.compare(await published.body(), expected), `Bundle publicado difere do aprovado: ${asset}`).toBe(0);
  }
});
