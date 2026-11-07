import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { MouseEvent } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useNavigate } from 'react-router';
import { prepareSectionArtwork, prepareVisibleSectionImages } from '../lib/sceneAssets';
import type { SecaoId } from '../types/portfolio';

const EXPAND_MS = 340;
const REVEAL_MS = 380;
const MAX_SECTION_WAIT_MS = 4000;

function afterPaint(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() =>
    requestAnimationFrame(() => resolve())));
}

/**
 * The circular transition keeps the new section fully covered while its
 * critical WebP artwork, visible React images and font finish loading.
 * GIFs and off-screen/lazy images do not delay the reveal.
 */
export function useSectionTransition(activeSection: SecaoId) {
  const navigate = useNavigate();
  const maskRef = useRef<HTMLDivElement>(null);
  const shieldRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const runId = useRef(0);
  const locked = useRef(false);
  const previousSection = useRef(activeSection);

  const beginCover = useCallback((clipPath: string) => {
    const mask = maskRef.current;
    if (!mask) return;
    mask.style.clipPath = clipPath;
    mask.classList.add('is-active');
    mask.setAttribute('aria-hidden', 'false');
    shieldRef.current?.classList.add('is-active');
  }, []);

  const endCover = useCallback((clipPath: string) => {
    const mask = maskRef.current;
    animationRef.current?.cancel();
    animationRef.current = null;
    if (mask) {
      mask.style.clipPath = clipPath;
      mask.classList.remove('is-active');
      mask.setAttribute('aria-hidden', 'true');
    }
    shieldRef.current?.classList.remove('is-active');
    locked.current = false;
  }, []);

  const waitUntilReady = useCallback(async (section: SecaoId, artworkReady: Promise<void>) => {
    let timer: number | undefined;
    try {
      // One frame for CSS layout and lazy image selection after the React commit.
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      await Promise.race([
        Promise.allSettled([artworkReady, prepareVisibleSectionImages(section)]),
        new Promise<void>(resolve => { timer = window.setTimeout(resolve, MAX_SECTION_WAIT_MS); }),
      ]);
      await afterPaint();
    } finally {
      if (timer !== undefined) window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => () => {
    runId.current += 1;
    endCover('circle(0px at 50% 50%)');
  }, [endCover]);

  // Browser Back/Forward and direct hash navigation must also wait under cover.
  // Layout effects run before the destination can paint.
  useLayoutEffect(() => {
    if (previousSection.current === activeSection) return;
    previousSection.current = activeSection;
    if (locked.current || !maskRef.current) return;

    const id = ++runId.current;
    locked.current = true;
    beginCover('inset(0)');
    const ready = prepareSectionArtwork(activeSection);
    void waitUntilReady(activeSection, ready).finally(() => {
      if (id === runId.current) endCover('circle(0px at 50% 50%)');
    });
  }, [activeSection, beginCover, endCover, waitUntilReady]);

  const onNavigate = useCallback((event: MouseEvent<HTMLAnchorElement>, destination: SecaoId) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey ||
      event.ctrlKey || event.shiftKey || event.altKey) return;

    if (locked.current) {
      event.preventDefault();
      return;
    }
    if (destination === activeSection) return;

    const mask = maskRef.current;
    if (!mask) return;
    event.preventDefault();

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.ceil(Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    )) + 2;
    const closed = `circle(0px at ${x}px ${y}px)`;
    const open = `circle(${radius}px at ${x}px ${y}px)`;
    mask.style.setProperty('--scene-origin-x', `${x}px`);
    mask.style.setProperty('--scene-origin-y', `${y}px`);
    beginCover(reduced ? 'inset(0)' : closed);

    const id = ++runId.current;
    locked.current = true;
    const artworkReady = prepareSectionArtwork(destination);

    const animate = async (from: string, to: string, duration: number) => {
      const animation = mask.animate([{ clipPath: from }, { clipPath: to }], {
        duration, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards',
      });
      animationRef.current = animation;
      await animation.finished;
      if (id !== runId.current) return;
      mask.style.clipPath = to;
      animation.cancel();
      animationRef.current = null;
    };

    const move = async () => {
      let committed = false;
      try {
        if (!reduced) await animate(closed, open, EXPAND_MS);
        if (id !== runId.current) return;

        // Commit only when the viewport is covered; never reveal incomplete content.
        flushSync(() => navigate({ pathname: '/', hash: `#${destination}` }));
        committed = true;
        await waitUntilReady(destination, artworkReady);
        if (id !== runId.current) return;

        if (!reduced) await animate(open, closed, REVEAL_MS);
      } catch (error) {
        if (id === runId.current && !committed &&
            !(error instanceof DOMException && error.name === 'AbortError')) {
          navigate({ pathname: '/', hash: `#${destination}` });
        }
      } finally {
        if (id === runId.current) endCover(closed);
      }
    };
    void move();
  }, [activeSection, navigate, beginCover, endCover, waitUntilReady]);

  return {
    onNavigate,
    overlay: createPortal(
      <>
        <div id="sectionTransitionShield" ref={shieldRef} aria-hidden="true" />
        <div id="sectionTransitionMask" ref={maskRef} role="status" aria-label="Preparando nova seção" aria-hidden="true">
          <div className="scene-transition-loader">
            <span className="scene-transition-glyph" aria-hidden="true">✦ ◆ ✦</span>
            <span className="scene-transition-brand">PHASSCODE</span>
            <span className="scene-transition-caption">[ PREPARANDO NOVA CENA ]</span>
            <span className="scene-transition-track" aria-hidden="true"><span className="scene-transition-progress" /></span>
          </div>
        </div>
      </>,
      document.body,
    ),
  };
}
