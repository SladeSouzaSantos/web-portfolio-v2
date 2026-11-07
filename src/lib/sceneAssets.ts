import type { SecaoId } from '../types/portfolio';
import { assetUrl } from './assets';

const backgrounds: Record<SecaoId, { desktop: string; mobile: string }> = {
  sobre: { desktop: 'taverna_bg.webp', mobile: 'taverna_bg_mobile.webp' },
  projetos: { desktop: 'guilda-bg.webp', mobile: 'guilda-bg-mobile.webp' },
  experiencia: { desktop: 'tapecaria-bg.webp', mobile: 'tapecaria-bg-mobile.webp' },
  academico: { desktop: 'academia-bg.webp', mobile: 'academia-bg-mobile.webp' },
};

/** Static, visible artwork only. GIFs and lazy/off-screen project galleries never gate navigation. */
const criticalArtwork: Record<SecaoId, string[]> = {
  sobre: ['avatar_cavaleiro.webp', 'papiro.webp'],
  projetos: ['pergaminho-projeto.webp', 'moldura-projeto.webp'],
  experiencia: ['tapecaria.webp', 'emblema-moldura.webp', 'moldura-exp.webp'],
  academico: [
    'moldura-armario.webp', 'medalhao-curso-recortado.webp',
    'moldura-curso.webp', 'moldura-crtificacoes.webp',
  ],
};

const warmed = new Map<string, HTMLImageElement>();

export function currentSectionFromUrl(): SecaoId {
  if (/^\/projetos(?:\.html)?\/?$/.test(location.pathname)) return 'projetos';
  const section = location.hash.slice(1);
  if (section === 'projetos' || section === 'portfolio') return 'projetos';
  if (section === 'experiencia') return 'experiencia';
  if (section === 'academico' || section === 'formacao') return 'academico';
  return 'sobre';
}

function sceneUrl(section: SecaoId): string {
  return assetUrl(window.matchMedia('(max-width: 768px)').matches
    ? backgrounds[section].mobile : backgrounds[section].desktop);
}

function warmImage(url: string): HTMLImageElement {
  let image = warmed.get(url);
  if (!image) {
    image = new Image();
    image.decoding = 'async';
    image.src = url;
    warmed.set(url, image);
  }
  return image;
}

/** Opportunistic caching of static WebP assets; animated GIFs never block navigation. */
export function warmSectionScene(section: SecaoId): HTMLImageElement {
  return warmImage(sceneUrl(section));
}

/** Start fetching only the section's critical, static visual assets. */
export function prepareSectionArtwork(section: SecaoId): Promise<void> {
  const assets = [
    warmSectionScene(section),
    ...criticalArtwork[section].map(name => warmImage(assetUrl(name))),
  ];
  if (section === 'academico' && window.matchMedia('(min-width: 769px)').matches) {
    assets.push(warmImage(assetUrl('escrivaninha.webp')));
  }
  return Promise.allSettled(assets.map(image => image.decode())).then(() => undefined);
}

/** Wait for images React has mounted in the visible portion of the destination. */
export async function prepareVisibleSectionImages(section: SecaoId): Promise<void> {
  const panel = document.querySelector<HTMLElement>('#contentDisplay');
  if (panel?.dataset.section !== section) return;

  const images = Array.from(panel.querySelectorAll<HTMLImageElement>('img')).filter(image => {
    if (image.loading !== 'lazy') return true;
    const rect = image.getBoundingClientRect();
    return rect.bottom >= 0 && rect.top <= window.innerHeight + 100;
  });
  await Promise.allSettled([
    ...images.map(image => image.decode()),
    document.fonts.ready,
  ]);
}

export async function prepareFirstScene(): Promise<void> {
  const scene = currentSectionFromUrl();
  await Promise.allSettled([
    prepareSectionArtwork(scene),
    document.fonts.ready,
  ]);
}
