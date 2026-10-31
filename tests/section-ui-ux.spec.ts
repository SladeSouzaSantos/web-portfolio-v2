import { expect, test } from './fixtures';

for (const width of [320,375,768,1024,1440]) {
  test(`Acabamento RPG mantém conteúdo das seções contido em ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:900});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto('/#academico');
    await page.evaluate(()=>document.fonts.ready);
    const armoire=page.locator('.academia-armario');
    await expect(armoire).toBeVisible();
    const boxes=await page.locator('.academia-cartao__conteudo').evaluateAll(els=>els.map(e=>{
      const parent=e.closest('.academia-cartao')!.getBoundingClientRect();
      const content=e.getBoundingClientRect();
      return {left:content.left-parent.left,right:parent.right-content.right};
    }));
    expect(boxes).toHaveLength(9);
    // Desktop usa a moldura ilustrada; tablet/mobile têm recuo dentro do papel.
    const armStyles=await armoire.evaluate(el=>({
      paddingLeft:parseFloat(getComputedStyle(el).paddingLeft),
      width:el.getBoundingClientRect().width,
    }));
    if(width<=1150)expect(armStyles.paddingLeft).toBeGreaterThanOrEqual(8);
    else expect(armStyles.width).toBeGreaterThan(0);
    const card=page.locator('.academia-cartao').first();
    await card.focus();
    await expect(card).toBeFocused();
    await card.press('Enter');
    const modal=page.getByRole('dialog');
    await expect(modal).toBeVisible();
    const mod=await modal.evaluate(el=>{
      const css=getComputedStyle(el);
      return {padding:parseFloat(css.paddingLeft),innerWidth:el.clientWidth};
    });
    expect(mod.padding).toBeGreaterThanOrEqual(20);
    expect(mod.innerWidth).toBeGreaterThan(0);
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    await page.keyboard.press('Escape');

    await page.goto('/#experiencia');
    const chronicle=page.locator('.cronicas-capitulo__cartao').first();
    await expect(chronicle).toBeVisible();
    const colors=await chronicle.evaluate(el=>({
      title:getComputedStyle(el.querySelector('.cronicas-capitulo__empresa')!).color,
      action:getComputedStyle(el.querySelector('.cronicas-capitulo__acao')!).color,
    }));
    expect(colors.title).not.toBe(colors.action);
    await chronicle.focus();
    await chronicle.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.goto('/#sobre');
    const skills=page.locator('.skill-categoria-box');
    await expect(skills).toHaveCount(4);
    await expect(skills.first().locator('.skill-cat-titulo')).toHaveCSS('font-family',/Press Start 2P/);
    await skills.first().locator('summary').click();
    await expect(skills.first().locator('details')).toHaveAttribute('open','');
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  });
}

test('Experiência e Academia exibem feedback de foco e interação por toque',async({page})=>{
  await page.setViewportSize({width:375,height:812});
  await page.goto('/#academico');
  const trilha=page.locator('.academia-trilha').first();
  await trilha.focus();
  await expect(trilha).toBeFocused();
  await expect(trilha).toHaveCSS('cursor','pointer');
  await trilha.press('Enter');
  await expect(page.getByRole('dialog',{name:'Java & Arquitetura'})).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto('/#experiencia');
  const cap=page.locator('.cronicas-capitulo__cartao').first();
  await cap.focus();
  await expect(cap).toBeFocused();
  await cap.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
});
