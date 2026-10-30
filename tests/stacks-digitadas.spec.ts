import { expect, test } from './fixtures';

test('Sobre Mim alterna as stacks Java e Engenharia de IA com Typed.js', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#sobre');
  const stack = page.locator('[data-typed-stack]');
  await expect(page.locator('.perfil-especialidades-container')).toHaveAttribute('aria-label', /SPRING BOOT.*RAG.*LANGCHAIN/);
  await expect.poll(() => stack.textContent(), { timeout: 10_000 }).toBe('JAVA • SPRING BOOT');
  await expect.poll(() => stack.textContent(), { timeout: 12_000 }).toBe('JAVA • QUARKUS');
  await expect(page.locator('.especialidade-tag--digitando')).toBeVisible();
});

test('Movimento reduzido mostra rótulo fixo e nenhum cursor animado', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#sobre');
  await expect(page.locator('[data-typed-stack]')).toHaveText('JAVA • IA APLICADA');
  await expect(page.locator('.especialidade-tag--digitando')).toHaveCount(0);
});

test('Retorno à seção não duplica animações nem ultrapassa tela pequena', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#sobre');
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Projetos', exact: true }).click();
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Sobre Pedro Santos', exact: true }).click();
  await expect(page.locator('[data-typed-stack]')).toHaveCount(1);
  await expect.poll(() => page.locator('[data-typed-stack]').textContent()).toContain('JAVA');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});
