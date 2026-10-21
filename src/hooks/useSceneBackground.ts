import { useLayoutEffect } from 'react';
import { assetUrl } from '../lib/assets';
import { useMediaQuery, useReducedMotion } from './useMediaQuery';

interface SceneBackground {
  className: string;
  property?: string;
  desktop: string;
  mobile?: string;
  animatedDesktop?: string;
  animatedMobile?: string;
}

/** Own only this scene's class/property and ignore image callbacks after unmount. */
export function useSceneBackground({
  className,
  property,
  desktop,
  mobile,
  animatedDesktop,
  animatedMobile,
}: SceneBackground): void {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const body = document.body;
    body.classList.add(className);
    if (!property) return () => body.classList.remove(className);

    const setBackground = (filename: string) => {
      body.style.setProperty(property, `url("${assetUrl(filename)}")`);
    };
    setBackground(isMobile && mobile ? mobile : desktop);
    const animation = isMobile ? animatedMobile : animatedDesktop;
    let active = true;
    const image = new Image();
    if (animation && !reducedMotion) {
      image.onload = () => { if (active) setBackground(animation); };
      image.src = assetUrl(animation);
    }

    return () => {
      active = false;
      image.onload = null;
      image.onerror = null;
      body.classList.remove(className);
      body.style.removeProperty(property);
    };
  }, [className, property, desktop, mobile, animatedDesktop, animatedMobile, isMobile, reducedMotion]);
}
