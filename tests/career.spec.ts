import { expect, test } from './fixtures';

test('professional chronicles show the selected experience and restore focus after Escape', async ({ page }) => {
  await page.goto('/#experiencia');
  await expect(page.getByRole('heading', { name: 'CRÔNICAS DA JORNADA', exact: true })).toBeVisible();
  await expect(page.locator('.cronicas-capitulos > li')).toHaveCount(4);

  const trigger = page.getByRole('button', { name: /SIG Software e Consultoria em TI/ });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'SIG Software e Consultoria em TI', exact: true });
  const close = dialog.getByRole('button', { name: 'Fechar crônica', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Junho de 2016 — Fevereiro de 2017');
  await expect(dialog).toContainText('Desenvolvedor de Sistemas');
  await expect(dialog).toContainText('Customizações e evolução de módulos do SIGAA.');
  await expect(dialog).toContainText('Hibernate');
  await expect(dialog).toContainText('PostgreSQL');
  await expect(close).toBeFocused();
  await expect(page.locator('#root')).toHaveJSProperty('inert', true);
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.locator('#root')).toHaveJSProperty('inert', false);

  await page.getByRole('button', { name: /ACRUX/ }).click();
  const firstExperience = page.getByRole('dialog', { name: 'ACRUX', exact: true });
  await expect(firstExperience).toContainText('Fevereiro de 2014 — Janeiro de 2015');
  await expect(firstExperience).toContainText('Estagiário como Programador de Sistemas');
  await expect(firstExperience.getByRole('heading', { name: 'FERRAMENTAS DA JORNADA', exact: true })).toHaveCount(0);
  await firstExperience.getByRole('button', { name: 'Fechar crônica', exact: true }).click();
  await expect(firstExperience).toHaveCount(0);
});

test('academic diplomas and learning tracks keep distinct details and accessible modal focus', async ({ page }) => {
  await page.goto('/#academico');
  await expect(page.getByRole('heading', { name: 'ACADEMIA ARCANA', exact: true })).toBeVisible();
  await expect(page.locator('.academia-cartao')).toHaveCount(8);
  await expect(page.locator('.academia-trilha')).toHaveCount(6);

  const diploma = page.getByRole('button', { name: /Ciência da Computação/ });
  await diploma.click();
  const diplomaDialog = page.getByRole('dialog', { name: 'Ciência da Computação', exact: true });
  const diplomaClose = diplomaDialog.getByRole('button', { name: 'Fechar ficha', exact: true });
  await expect(diplomaDialog).toBeVisible();
  await expect(diplomaDialog).toContainText('UNISUL');
  await expect(diplomaDialog).toContainText('Início: 07/2023 · Previsão: 12/2026');
  await expect(diplomaDialog).toContainText('Situação a confirmar');
  await expect(diplomaClose).toBeFocused();
  await expect(page.locator('#root')).toHaveJSProperty('inert', true);
  await page.keyboard.press('Shift+Tab');
  await expect(diplomaClose).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(diplomaDialog).toHaveCount(0);
  await expect(diploma).toBeFocused();
  await expect(page.locator('#root')).toHaveJSProperty('inert', false);

  const track = page.getByRole('button', { name: /Java & Ecossistema/ });
  await track.click();
  const trackDialog = page.getByRole('dialog', { name: 'Java & Ecossistema', exact: true });
  await expect(trackDialog).toContainText('TRILHA DE APRENDIZAGEM');
  await expect(trackDialog).toContainText('Java · Spring · APIs · Boas práticas');
  await expect(trackDialog).toContainText('Os cursos e certificados individuais desta área poderão ser adicionados ao catálogo posteriormente.');
  await expect(trackDialog).not.toContainText('UNISUL');
  await trackDialog.getByRole('button', { name: 'Fechar ficha', exact: true }).click();
  await expect(trackDialog).toHaveCount(0);
  await expect(track).toBeFocused();
  await expect(page.locator('#root')).toHaveJSProperty('inert', false);
});
