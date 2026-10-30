import type { SecaoId } from '../types/portfolio';
import { assetUrl } from './assets';

const backgrounds: Record<SecaoId, { desktop: string; mobile: string }> = {
  sobre: { desktop: 'taverna_bg.webp', mobile: 'taverna_bg_mobile.webp' },
  projetos: { desktop: 'guilda-bg.webp', mobile: 'guilda-bg-mobile.webp' },
  experiencia: { desktop: 'tapecaria-bg.webp', mobile: 'tapecaria-bg-mobile.webp' },
  academico: { desktop: 'academia-bg.webp', mobile: 'academia-bg-mobile.webp' },
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

/** Opportunistic caching of static WebP assets; animated GIFs never block navigation. */
export function warmSectionScene(section: SecaoId): HTMLImageElement {
  const url = sceneUrl(section);
  let image = warmed.get(url);
  if (!image) {
    image = new Image();
    image.decoding = 'async';
    image.src = url;
    warmed.set(url, image);
  }
  return image;
}

export async function prepareFirstScene(): Promise<void> {
  const scene = currentSectionFromUrl();
  const images = [warmSectionScene(scene)];
  if (scene === 'sobre') {
    const avatar = new Image();
    avatar.decoding = 'async';
    avatar.src = assetUrl('avatar_cavaleiro.webp');
    images.push(avatar);
  }
  await Promise.allSettled([
    ...images.map(image => image.decode()),
    document.fonts.ready,
  ]);
}
