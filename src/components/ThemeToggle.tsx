import { useEffect, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import type { Theme } from '../hooks/useTheme';
import { useReducedMotion } from '../hooks/useMediaQuery';
import { assetUrl } from '../lib/assets';

export function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const maskRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const transitionId = useRef(0);
  const locked = useRef(false);
  const [transitioning, setTransitioning] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => () => {
    transitionId.current += 1;
    animationRef.current?.cancel();
    animationRef.current = null;
    locked.current = false;
  }, []);

  const toggle = async () => {
    if (locked.current) return;
    if (reducedMotion) { onToggle(); return; }
    const rect = buttonRef.current?.getBoundingClientRect();
    const mask = maskRef.current;
    if (!rect || !mask) return;

    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    // Reach the farthest viewport corner, including tall and narrow screens.
    const radius = Math.ceil(Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    ));
    const collapsed = `circle(0px at ${x}px ${y}px)`;
    const expanded = `circle(${radius}px at ${x}px ${y}px)`;
    mask.style.setProperty('--click-x', `${x}px`);
    mask.style.setProperty('--click-y', `${y}px`);
    mask.style.backgroundColor = theme === 'dark' ? '#e2e8f0' : '#080d12';
    mask.style.clipPath = collapsed;

    const id = ++transitionId.current;
    locked.current = true;
    setTransitioning(true);

    const animate = async (from: string, to: string) => {
      const animation = mask.animate([{ clipPath: from }, { clipPath: to }], {
        duration: 700,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        fill: 'forwards',
      });
      animationRef.current = animation;
      await animation.finished;
      if (id !== transitionId.current) return;
      mask.style.clipPath = to;
      animation.cancel();
      animationRef.current = null;
    };

    try {
      await animate(collapsed, expanded);
      if (id !== transitionId.current) return;
      // Commit the new theme underneath the fully expanded mask before revealing it.
      flushSync(onToggle);
      await animate(expanded, collapsed);
    } catch (error) {
      // Cancellation is expected when navigating away during the transition.
      if (!(error instanceof DOMException && error.name === 'AbortError')) throw error;
    } finally {
      if (id === transitionId.current) {
        animationRef.current?.cancel();
        animationRef.current = null;
        mask.style.clipPath = collapsed;
        locked.current = false;
        setTransitioning(false);
      }
    }
  };

  return <>
    <button ref={buttonRef} id="themeToggleBtn" type="button" className="botao-icone" onClick={toggle} disabled={transitioning}
      aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}>
      <span className="perspectiva-svg"><svg id="themeIcon" viewBox="0 0 32 32" aria-hidden="true">
        <use href={`${assetUrl('icons.svg')}#icon-${theme === 'dark' ? 'sol' : 'lua'}`} />
      </svg></span>
    </button>
    {createPortal(<div ref={maskRef} id="themeTransitionMask" aria-hidden="true" />, document.body)}
  </>;
}
