import { expect, test } from './fixtures';

test('Academia mantém nove medalhões e destaca as cinco especializações da FacPrisma', async ({ page }) => {
  await page.goto('/#academico');
  await expect(page.locator('.academia-cartao')).toHaveCount(9);
  const med = page.getByRole('button', { name: /Computação e TIC — 5 Especializações/ });
  await med.click();
  const modal = page.getByRole('dialog', { name: 'Computação e TIC — 5 Especializações' });
  await expect(modal).toBeVisible();
  await expect(modal.locator('.academia-modal__especializacoes li')).toHaveCount(5);
  await expect(modal).toContainText('Arquitetura de Software');
  await expect(modal).toContainText('Inteligência Artificial');
  await expect(modal).toContainText('Conclusão a confirmar');
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await expect(med).toBeFocused();
});

test('Seis trilhas mostram cursos concluídos, incluindo as quatro etapas Hackers do Bem', async ({ page }) => {
  await page.goto('/#academico');
  await expect(page.locator('.academia-trilha')).toHaveCount(6);
  const java = page.getByRole('button', { name: /Java & Arquitetura/ });
  await java.click();
  const modal = page.getByRole('dialog', { name: 'Java & Arquitetura' });
  await expect(modal.locator('.academia-modal__curso')).toHaveCount(9);
  await expect(modal).toContainText('Formação TDD e Java');
  await expect(modal).toContainText('Alura');
  await expect(modal).toContainText('Java Completo — Programação Orientada a Objetos');
  await expect(modal.locator('.academia-modal__curso-status')).toHaveText(Array(9).fill('Concluído'));
  await expect(modal).not.toContainText('A confirmar');
  await expect(modal).not.toContainText('Em andamento');
  await expect(modal).not.toContainText('poderão ser adicionados');
  await page.getByRole('button', { name: 'Fechar ficha' }).click();
  await expect(modal).toHaveCount(0);
  await expect(java).toBeFocused();

  await page.getByRole('button', { name: /IA & Dados/ }).click();
  const ia = page.getByRole('dialog', { name: 'IA & Dados' });
  await expect(ia).toContainText('Redes Neurais Artificiais');
  await expect(ia).toContainText('RAG');
  await page.keyboard.press('Escape');
  await expect(ia).toHaveCount(0);

  await page.getByRole('button', { name: /DevOps & Qualidade/ }).click();
  const devops = page.getByRole('dialog', { name: 'DevOps & Qualidade' });
  await expect(devops.locator('.academia-modal__curso')).toHaveCount(11);
  const certificados = devops.locator('.academia-modal__curso').filter({ hasText: 'Hackers do Bem —' });
  await expect(certificados).toHaveCount(4);
  await expect(certificados.locator('.academia-modal__curso-instituicao')).toHaveText([
    'Programa Hackers do Bem · 80h',
    'Programa Hackers do Bem · 64h',
    'Programa Hackers do Bem · 96h',
    'Programa Hackers do Bem · 80h',
  ]);
  await expect(certificados.locator('.academia-modal__curso-status')).toHaveText(Array(4).fill('Concluído'));
  await expect(devops).toContainText('Especialização em DevOps e DevSecOps');
  await page.keyboard.press('Escape');
  await expect(devops).toHaveCount(0);
});

test('Ficha permanece navegável em celular sem criar rolagem horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#academico');
  await page.getByRole('button', { name: /Frontend & Mobile/ }).click();
  const modal = page.getByRole('dialog', { name: 'Frontend & Mobile' });
  await expect(modal.locator('.academia-modal__curso')).toHaveCount(7);
  // O próprio elemento do diálogo é o painel; não há painel aninhado.
  await expect(modal).toHaveClass(/academia-modal__painel/);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
});

test('Cursos Hackers do Bem continuam acessíveis no mobile sem rolagem lateral', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#academico');
  await page.getByRole('button', { name: /DevOps & Qualidade/ }).click();
  const modal = page.getByRole('dialog', { name: 'DevOps & Qualidade' });
  await expect(modal.locator('.academia-modal__curso')).toHaveCount(11);
  await expect(modal.getByText('Hackers do Bem — Especialização em DevOps e DevSecOps')).toBeAttached();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
    .toBeLessThanOrEqual(1);
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
});
