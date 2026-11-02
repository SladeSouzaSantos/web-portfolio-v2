import type { ChatSource } from '../types/orbe';

export function getOrbeSources(sources: ChatSource[]): (ChatSource & { href?: string })[] {
  const seen = new Set<string>();
  return sources.flatMap(source => {
    if (!['project', 'platform'].includes(source.type) || !source.url) return [];
    let href: string | undefined;
    if (source.url) {
      try {
        const url = new URL(source.url);
        if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) href = url.href;
      } catch { /* A reference with no safe URL is still rendered as plain text. */ }
    }
    if (!href || !/^https:\/\/(?:github\.com|hsp\.greencity\.net\.br)(?:\/|$)/i.test(href)) return [];
    const key = href;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ ...source, href }];
  });
}
