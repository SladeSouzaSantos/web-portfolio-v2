import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router';
import type { SecaoId } from '../types/portfolio';

function sectionFromHash(hash: string): SecaoId {
  const section = hash.slice(1);
  if (section === 'projetos' || section === 'portfolio') return 'projetos';
  if (section === 'experiencia') return 'experiencia';
  if (section === 'academico' || section === 'formacao') return 'academico';
  return 'sobre';
}

export function useSectionNavigation(): SecaoId {
  const { hash } = useLocation();
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [hash]);
  return sectionFromHash(hash);
}
