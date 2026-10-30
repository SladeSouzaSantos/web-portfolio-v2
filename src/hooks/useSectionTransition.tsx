import { useCallback, useEffect, useRef } from 'react';
import type { MouseEvent } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useNavigate } from 'react-router';
import { warmSectionScene } from '../lib/sceneAssets';
import type { SecaoId } from '../types/portfolio';

const EXPAND_MS = 340;
const REVEAL_MS = 380;
const SCENE_WAIT_MS = 180;

/**
 * A circular wipe originates at the selected navigation item. The route is
 * committed only when the viewport is fully covered, so neither scene nor
 * its background can flash while React replaces the previous section.
 *
 * This is intentionally a navigation effect, not a second loading overlay.
 */
export function useSectionTransition(activeSection: SecaoId) {
  const navigate = useNavigate();
  const maskRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const runId = useRef(0);
  const locked = useRef(false);

  useEffect(() => () => {
    runId.current += 1;
    animationRef.current?.cancel();
    animationRef.current = null;
    locked.current = false;
  }, []);

  const onNavigate = useCallback((event: MouseEvent<HTMLAnchorElement>, destination: SecaoId) => {
    // Preserve normal link semantics for middle-click and modified clicks.
    if (event.defaultPrevented || event.button !== 0 || event.metaKey ||
      event.ctrlKey || event.shiftKey || event.altKey) return;

    if (locked.current) {
      event.preventDefault();
      return;
    }
    if (destination === activeSection) return;

    const mask = maskRef.current;
    if (!mask || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Let React Router navigate immediately, without motion.
      return;
    }
    event.preventDefault();

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
    mask.style.clipPath = closed;
    mask.classList.add('is-active');

    const id = ++runId.current;
    locked.current = true;

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
      try {
        // Start warming the target scene immediately, but never wait for GIFs.
        const sceneReady = warmSectionScene(destination).decode().catch(() => undefined);
        await animate(closed, open, EXPAND_MS);
        if (id !== runId.current) return;
        flushSync(() => navigate({ pathname: '/', hash: `#${destination}` }));
        // Allow a brief opportunity for the WebP scene to decode under cover.
        await Promise.race([
          sceneReady,
          new Promise<void>(resolve => window.setTimeout(resolve, SCENE_WAIT_MS)),
        ]);
        await new Promise<void>(resolve => requestAnimationFrame(() =>
          requestAnimationFrame(() => resolve())));
        if (id !== runId.current) return;
        await animate(open, closed, REVEAL_MS);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          // Fall back to the requested route rather than trapping navigation.
          if (id === runId.current) navigate({ pathname: '/', hash: `#${destination}` });
        }
      } finally {
        if (id === runId.current) {
          animationRef.current?.cancel();
          animationRef.current = null;
          mask.style.clipPath = closed;
          mask.classList.remove('is-active');
          locked.current = false;
        }
      }
    };
    void move();
  }, [activeSection, navigate]);

  return {
    onNavigate,
    overlay: createPortal(
      <div id="sectionTransitionMask" ref={maskRef} aria-hidden="true">
        <span className="scene-transition-glyph">✦</span>
        <span className="scene-transition-caption">[ NOVA CENA ]</span>
      </div>,
      document.body,
    ),
  };
}
