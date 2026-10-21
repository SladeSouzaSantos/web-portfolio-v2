import { expect, test, type Page } from './fixtures';

async function resize(page: Page, width: number, height = 900) {
  await page.setViewportSize({ width, height });
  const loadedFonts = await page.evaluate(async () => {
    const fonts = await document.fonts.load('12px "Press Start 2P"');
    await document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    return fonts.length;
  });
  expect(loadedFonts, 'Measure the actual pixel font rather than fallback text').toBeGreaterThan(0);
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    'Resizing must not introduce horizontal page scrolling').toBeLessThanOrEqual(1);
}

// Element rectangles alone miss unbroken text painted over an illustrated frame.
// Measure the actual text fragments against the space left by its padding/borders.
async function expectTextWithinContent(page: Page, selector: string, context: string) {
  const escapedText = await page.locator(selector).evaluateAll(elements => elements.flatMap(element => {
    const bounds = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const left = bounds.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);
    const right = bounds.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight);
    const top = bounds.top + parseFloat(style.borderTopWidth) + parseFloat(style.paddingTop);
    const bottom = bounds.bottom - parseFloat(style.borderBottomWidth) - parseFloat(style.paddingBottom);
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const overflow: string[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (!node.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      if ([...range.getClientRects()].some(rect => rect.width > 0 &&
        (rect.left < left - 1 || rect.right > right + 1 || rect.top < top - 1 || rect.bottom > bottom + 1))) {
        overflow.push(node.textContent.trim());
      }
    }
    return overflow;
  }));
  expect(escapedText, `${context}: complete text must fit inside the usable frame area`).toEqual([]);
}

test('the mission board reflows every card and keeps its archive sign near the last row while resizing', async ({ page }) => {
  await page.goto('/#projetos');
  await expect(page.locator('.guilda-cartaz')).toHaveCount(5);

  // Cross both sides of each breakpoint without mounting a new page.
  for (const width of [375, 640, 641, 768, 816, 1000, 1001, 1440, 375]) {
    await resize(page, width);
    const geometry = await page.locator('.guilda-mural').evaluate(mural => {
      const board = mural.getBoundingClientRect();
      const boardStyle = getComputedStyle(mural);
      const grid = mural.querySelector('.guilda-projetos-grid')!.getBoundingClientRect();
      const cards = [...mural.querySelectorAll('.guilda-cartaz')].map(card => {
        const rect = card.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width };
      });
      const sign = mural.querySelector('.guilda-arquivo__placa')!.getBoundingClientRect();
      const rows: { top: number; count: number }[] = [];
      for (const card of cards) {
        const row = rows.find(candidate => Math.abs(candidate.top - card.top) <= 1);
        if (row) row.count += 1;
        else rows.push({ top: card.top, count: 1 });
      }
      return {
        cards,
        rows: rows.map(row => row.count),
        grid: { left: grid.left, right: grid.right },
        sign: { left: sign.left, right: sign.right, top: sign.top, bottom: sign.bottom },
        usableBoard: {
          left: board.left + parseFloat(boardStyle.borderLeftWidth),
          right: board.right - parseFloat(boardStyle.borderRightWidth),
          bottom: board.bottom - parseFloat(boardStyle.borderBottomWidth),
        },
      };
    });
    const context = `Mission board at ${width}px`;
    expect(geometry.rows, `${context}: retain readable cards in complete, balanced rows`)
      .toEqual(width <= 640 ? [1, 1, 1, 1, 1] : width <= 1000 ? [2, 2, 1] : [3, 2]);
    for (const card of geometry.cards) {
      expect(card.width, `${context}: cards must not collapse into implicit grid tracks`).toBeGreaterThan(150);
      expect(card.left, context).toBeGreaterThanOrEqual(geometry.grid.left - 1);
      expect(card.right, context).toBeLessThanOrEqual(geometry.grid.right + 1);
    }
    expect(geometry.sign.left, `${context}: the sign belongs inside the wooden frame`)
      .toBeGreaterThanOrEqual(geometry.usableBoard.left - 1);
    expect(geometry.sign.right, context).toBeLessThanOrEqual(geometry.usableBoard.right + 1);
    expect(geometry.sign.bottom, context).toBeLessThanOrEqual(geometry.usableBoard.bottom + 1);
    const gap = geometry.sign.top - Math.max(...geometry.cards.map(card => card.bottom));
    expect(gap, `${context}: the sign must follow the last card without overlapping it`).toBeGreaterThanOrEqual(0);
    expect(gap, `${context}: avoid the former empty wooden area before the sign`).toBeLessThanOrEqual(80);
    await expectTextWithinContent(page, '.guilda-cartaz__conteudo, .guilda-arquivo__texto', context);
    await expectNoHorizontalOverflow(page);
  }
});

test('the academy uses tablet space and returns to a single readable column when narrowed', async ({ page }) => {
  await page.goto('/#academico');
  await expect(page.getByRole('heading', { name: 'ACADEMIA ARCANA', exact: true })).toBeVisible();
  await expect(page.locator('.academia-cartao')).toHaveCount(8);

  for (const width of [270, 375, 640, 816, 1100, 1101, 1440, 1920, 639, 320]) {
    await resize(page, width);
    const geometry = await page.locator('.academia-formacoes__grade').evaluate(grid => {
      const bounds = grid.getBoundingClientRect();
      const cards = [...grid.querySelectorAll('.academia-cartao')].map(card => {
        const rect = card.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      });
      return { left: bounds.left, right: bounds.right, cards };
    });
    const context = `Academy at ${width}px`;
    const [first, second] = geometry.cards;
    if (width >= 640) {
      expect(Math.abs(first.top - second.top), `${context}: tablet cards should share the first row`).toBeLessThanOrEqual(1);
      expect(second.left, `${context}: adjacent cards must not overlap`).toBeGreaterThanOrEqual(first.right);
      if (width <= 1100) {
        expect(geometry.right - geometry.left, `${context}: use the available tablet width`).toBeGreaterThan(width * 0.75);
      }
    } else {
      expect(second.top, `${context}: phone cards should stack without overlapping`).toBeGreaterThanOrEqual(first.bottom);
      expect(Math.abs(first.left - second.left), context).toBeLessThanOrEqual(1);
    }
    for (const card of geometry.cards) {
      expect(card.left, context).toBeGreaterThanOrEqual(geometry.left - 1);
      expect(card.right, context).toBeLessThanOrEqual(geometry.right + 1);
    }
    await expectTextWithinContent(page, '.academia-armario__cabecalho, .academia-estudos__cabecalho, .academia-cartao__conteudo', context);
    await expectTextWithinContent(page, '.academia-estudos__lista', `${context}: every learning track must remain above the bottom frame`);
    const coveredTracks = await page.locator('.academia-estudos__lista').evaluate(list => {
      const bounds = list.getBoundingClientRect();
      const sizeY = getComputedStyle(list).backgroundSize.split(/\s+/)[1];
      const scaleY = sizeY?.endsWith('%') ? parseFloat(sizeY) / 100 : 1;
      // The parchment ends near y=1116 in the 1345px artwork. Its decorative
      // frame and transparent bottom still belong to the element rectangle.
      const paperBottom = bounds.top + bounds.height * .83 * scaleY;
      return [...list.querySelectorAll('strong, small')].flatMap(text => {
        const range = document.createRange();
        range.selectNodeContents(text);
        return [...range.getClientRects()].some(rect => rect.bottom > paperBottom + 1) ? [text.textContent] : [];
      });
    });
    expect(coveredTracks, `${context}: learning-track text must stay on the illustrated paper`).toEqual([]);
    await expectNoHorizontalOverflow(page);
  }
});

test('the journey scales its pixel font and keeps every chronicle on the parchment while resizing', async ({ page }) => {
  await page.goto('/#experiencia');
  await expect(page.getByRole('heading', { name: 'CRÔNICAS DA JORNADA', exact: true })).toBeVisible();
  await expect(page.locator('.cronicas-capitulo__cartao')).toHaveCount(4);

  const widths = [270, 290, 320, 375, 412, 437, 480, 481, 640, 768, 769, 816, 1024, 1440, 1920];
  const fontSizes = new Map<number, number[]>();
  for (const width of [...widths, ...widths.slice(0, -1).reverse()]) {
    await resize(page, width);
    const context = `Journey at ${width}px`;
    await expectTextWithinContent(page, '.cronicas-cabecalho, .cronicas-capitulo__interior', context);

    const cards = await page.locator('.cronicas-capitulo__cartao').evaluateAll(elements => elements.map(card => {
      const bounds = card.getBoundingClientRect();
      const style = getComputedStyle(card);
      const paper = {
        left: bounds.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft),
        right: bounds.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight),
        top: bounds.top + parseFloat(style.borderTopWidth) + parseFloat(style.paddingTop),
        bottom: bounds.bottom - parseFloat(style.borderBottomWidth) - parseFloat(style.paddingBottom),
      };
      const fields = [...card.querySelectorAll('.cronicas-capitulo__interior > span')].map(field => {
        const fieldBounds = field.getBoundingClientRect();
        const fieldStyle = getComputedStyle(field);
        const range = document.createRange();
        range.selectNodeContents(field);
        return {
          text: field.textContent?.trim(),
          fontFamily: fieldStyle.fontFamily,
          fontSize: parseFloat(fieldStyle.fontSize),
          top: fieldBounds.top,
          bottom: fieldBounds.bottom,
          fragments: [...range.getClientRects()].filter(rect => rect.width > 0).map(rect => ({
            left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
          })),
        };
      });
      return { top: bounds.top, bottom: bounds.bottom, paper, fields };
    }));

    // Aggregate geometry failures so the trace does not create a separate step
    // for every edge of every wrapped text fragment at all 29 viewport changes.
    const violations: string[] = [];
    const check = (condition: boolean, message: string) => {
      if (!condition) violations.push(message);
    };
    for (const [index, card] of cards.entries()) {
      const cardContext = `${context}, chronicle ${index + 1}`;
      check(card.fields.length === 5, `${cardContext}: keep the period, company, role, summary and action visible`);
      check(card.paper.right - card.paper.left > 100, `${cardContext}: reserve enough paper for words`);
      for (const [fieldIndex, field] of card.fields.entries()) {
        check(/^"?Press Start 2P"?/.test(field.fontFamily), `${cardContext}: retain the intended pixel typeface`);
        check(Boolean(field.text), `${cardContext}: each text block must contain its complete text`);
        check(field.fragments.length > 0, `${cardContext}: text must be rendered rather than hidden`);
        for (const fragment of field.fragments) {
          check(fragment.left >= card.paper.left - 1, `${cardContext}: ${field.text} exceeds the left paper edge`);
          check(fragment.right <= card.paper.right + 1, `${cardContext}: ${field.text} exceeds the right paper edge`);
          check(fragment.top >= card.paper.top - 1, `${cardContext}: ${field.text} exceeds the top paper edge`);
          check(fragment.bottom <= card.paper.bottom + 1, `${cardContext}: ${field.text} exceeds the bottom paper edge`);
        }
        if (fieldIndex > 0) {
          check(field.top >= card.fields[fieldIndex - 1].bottom - 1,
            `${cardContext}: successive text blocks must not cover each other`);
        }
      }
      if (index > 0) {
        check(card.top >= cards[index - 1].bottom, `${context}: adjacent chronicles must not overlap`);
      }
    }

    const sizes = cards[0].fields.map(field => field.fontSize);
    if (fontSizes.has(width)) {
      check(JSON.stringify(sizes) === JSON.stringify(fontSizes.get(width)),
        `${context}: shrinking back must restore the same text scale`);
    } else {
      fontSizes.set(width, sizes);
    }
    expect(violations, `${context}: every text block must fit completely on its parchment`).toEqual([]);
    await expectNoHorizontalOverflow(page);
  }

  for (const [index, label] of ['period', 'company', 'role', 'summary', 'action'].entries()) {
    expect(fontSizes.get(320)![index], `The ${label} must use a smaller scale on a phone than on a desktop`)
      .toBeLessThan(fontSizes.get(1440)![index]);
  }
  const localFont = await page.evaluate(() => ({
    loaded: [...document.fonts].some(font => font.family.replaceAll('"', '').replaceAll("'", '') === 'Press Start 2P' && font.status === 'loaded'),
    resources: performance.getEntriesByType('resource').filter(entry => {
      const url = new URL(entry.name);
      return url.origin === location.origin && /\.(?:ttf|woff2?)(?:$|\?)/.test(url.href);
    }).length,
  }));
  expect(localFont.loaded, 'Responsive measurements must use the loaded Press Start 2P font').toBe(true);
  expect(localFont.resources, 'The pixel font must be served by the portfolio itself').toBeGreaterThan(0);
});

test('an open orb remains usable after rotating and resizing a small screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/#sobre');
  await page.getByRole('button', { name: 'Abrir guia do portfólio', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /CONSULTAR ORBE MÁGICO/ });
  await expect(dialog).toBeVisible();
  const input = dialog.getByRole('textbox', { name: 'Sua pergunta ao orbe', exact: true });
  const send = dialog.getByRole('button', { name: 'ENVIAR', exact: true });

  for (const [index, viewport] of [
    { width: 320, height: 568 },
    { width: 568, height: 320 },
    { width: 375, height: 667 },
    { width: 320, height: 568 },
  ].entries()) {
    await resize(page, viewport.width, viewport.height);
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(await dialog.evaluate(element => element.scrollWidth - element.clientWidth),
      'The open panel must not require horizontal scrolling').toBeLessThanOrEqual(1);
    await expectTextWithinContent(page, '#orbChatTitle', `Orb at ${viewport.width}x${viewport.height}`);

    // A short landscape panel may scroll vertically; its controls must still work.
    await input.scrollIntoViewIfNeeded();
    await expect(input).toBeInViewport();
    const query = `projetos ${index + 1}`;
    await input.fill(query);
    await send.scrollIntoViewIfNeeded();
    await expect(send).toBeInViewport();
    await send.click();
    await expect(dialog.locator('.user-msg').last()).toContainText(query);
    await expect(input).toHaveValue('');
    await expectNoHorizontalOverflow(page);
  }

  const close = dialog.getByRole('button', { name: 'Fechar guia do portfólio', exact: true });
  await close.scrollIntoViewIfNeeded();
  await expect(close).toBeInViewport();
  await close.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Abrir guia do portfólio', exact: true })).toBeFocused();
});
