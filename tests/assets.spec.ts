import { expect, test, type Page } from './fixtures';

interface ImageAsset {
  url: string;
  sources: string[];
  css: boolean;
}

/** Check the actual computed artwork, rather than searching source text for URLs. */
async function inspectLocalImages(page: Page, scene: string): Promise<string[]> {
  const failures: string[] = [];
  const images = page.locator('img');
  // Bring lazy images into view before inspecting their native loading state.
  for (let index = 0; index < await images.count(); index += 1) {
    const image = images.nth(index);
    if (await image.isVisible()) await image.scrollIntoViewIfNeeded();
  }
  await page.waitForFunction(() => [...document.images].every(image => image.complete), undefined, { timeout: 10_000 });
  const brokenImages = await page.evaluate(() => [...document.images].flatMap(image => {
    const source = image.currentSrc || image.src;
    if (new URL(source, document.baseURI).origin !== location.origin) return [];
    return image.complete && image.naturalWidth > 0 ? [] : [{ source, alt: image.alt, complete: image.complete, naturalWidth: image.naturalWidth }];
  }));
  for (const image of brokenImages) failures.push(`${scene}: <img> ${image.source} (${image.alt}), complete=${image.complete}, naturalWidth=${image.naturalWidth}`);

  const assets: ImageAsset[] = await page.evaluate(() => {
    const collected = new Map<string, { url: string; sources: string[]; css: boolean }>();
    const add = (value: string, source: string, css: boolean) => {
      const url = new URL(value, document.baseURI);
      if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return;
      url.hash = '';
      const existing = collected.get(url.href);
      if (existing) {
        existing.css ||= css;
        if (!existing.sources.includes(source)) existing.sources.push(source);
      } else collected.set(url.href, { url: url.href, sources: [source], css });
    };

    for (const element of [document.body, ...document.body.querySelectorAll('*')]) {
      const label = `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${[...element.classList].map(name => `.${name}`).join('')}`;
      for (const pseudo of [null, '::before', '::after']) {
        const style = getComputedStyle(element, pseudo);
        for (const property of ['background-image', 'border-image-source']) {
          const value = style.getPropertyValue(property);
          for (const match of value.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/g)) {
            add((match[1] ?? match[2] ?? match[3] ?? '').trim(), `${label}${pseudo ?? ''} ${property}`, true);
          }
        }
      }
    }
    for (const image of document.images) add(image.currentSrc || image.src, '<img>', false);
    for (const use of document.querySelectorAll('svg use')) {
      const href = use.getAttribute('href') || use.getAttribute('xlink:href');
      if (href && !href.startsWith('#')) add(href, '<svg><use>', false);
    }
    return [...collected.values()];
  });
  expect(assets.some(asset => asset.css), `${scene} should render its scene artwork`).toBe(true);

  // Only same-origin image URLs are requested: font services are not dependencies
  // of this test. Include URL/status/MIME in every failure for actionable reports.
  for (const asset of assets) {
    try {
      const response = await page.request.get(asset.url, { timeout: 10_000 });
      const mime = response.headers()['content-type'] ?? '(missing)';
      if (response.status() !== 200 || !mime.toLowerCase().startsWith('image/')) {
        failures.push(`${scene}: ${asset.url} — HTTP ${response.status()}, Content-Type ${mime}; ${asset.sources.join(', ')}`);
      }
    } catch (error) {
      failures.push(`${scene}: ${asset.url} — request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Ensure CSS textures have actually decoded before capturing screenshots.
  // An HTTP 200 with image MIME alone would miss a corrupt or undecodable file.
  const decodeFailures = await page.evaluate(async urls => {
    return (await Promise.all(urls.map(async url => {
      const image = new Image();
      image.src = url;
      try {
        await image.decode();
        return image.naturalWidth > 0 ? null : `${url} — decoded with naturalWidth=0`;
      } catch {
        return `${url} — browser could not decode the CSS image`;
      }
    }))).filter((value): value is string => value !== null);
  }, assets.filter(asset => asset.css).map(asset => asset.url));
  failures.push(...decodeFailures.map(failure => `${scene}: ${failure}`));
  return failures;
}

test('local images and computed scene textures load across every desktop section and archive', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/#sobre');
  const failures: string[] = [];
  const sections = [
    { link: 'Sobre Pedro Santos', heading: 'PEDRO SANTOS' },
    { link: 'Projetos', heading: 'QUADRO DE MISSÕES' },
    { link: 'Experiência', heading: 'CRÔNICAS DA JORNADA' },
    { link: 'Formação acadêmica', heading: 'ACADEMIA ARCANA' },
  ];
  for (const section of sections) {
    await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: section.link, exact: true }).click();
    await expect(page.getByRole('heading', { name: section.heading, exact: true })).toBeVisible();
    failures.push(...await inspectLocalImages(page, section.heading));
    if (section.heading === 'ACADEMIA ARCANA') {
      await page.screenshot({ path: testInfo.outputPath('academia-desktop.png'), fullPage: true, animations: 'disabled' });
    }
  }
  await page.getByRole('link', { name: 'Projetos', exact: true }).click();
  await page.getByRole('link', { name: /ARQUIVO DE MISSÕES EXPLORAR OUTROS PROJETOS/ }).click();
  await expect(page.getByRole('heading', { name: 'ARQUIVO DE MISSÕES', exact: true })).toBeVisible();
  failures.push(...await inspectLocalImages(page, 'ARQUIVO DE MISSÕES'));
  expect(failures, 'Local image assets must respond with HTTP 200/image MIME and decode correctly').toEqual([]);
});

test('the 320px archive renders decoded artwork before its screenshot', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto('/projetos');
  await expect(page.getByRole('heading', { name: 'ARQUIVO DE MISSÕES', exact: true })).toBeVisible();
  const failures = await inspectLocalImages(page, 'ARQUIVO MOBILE 320');
  await page.screenshot({ path: testInfo.outputPath('arquivo-mobile-320.png'), fullPage: true, animations: 'disabled' });
  expect(failures, 'Mobile archive images must load and decode correctly').toEqual([]);
});
