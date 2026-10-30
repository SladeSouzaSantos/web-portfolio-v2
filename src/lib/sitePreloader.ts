import { prepareFirstScene } from './sceneAssets';

/** Boot overlay waits only for the visible scene and local font, never for animated backgrounds. */
export async function dismissPortfolioPreloader(): Promise<void> {
  const overlay = document.getElementById('site-preloader');
  if (!overlay) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const minimumMs = reduced ? 0 : 260;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const maxWait = new Promise<void>(resolve => {
      timeoutId = setTimeout(resolve, 2200);
    });
    const minimum = new Promise<void>(resolve => setTimeout(resolve, minimumMs));
    await Promise.race([
      Promise.all([prepareFirstScene(), minimum]),
      maxWait,
    ]);
    // Give React a chance to paint the requested page before removing the cover.
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    overlay.classList.add('is-leaving');
    window.setTimeout(() => overlay.remove(), reduced ? 0 : 300);
  }
}
