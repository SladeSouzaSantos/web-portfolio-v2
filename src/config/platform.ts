export interface PlatformConfig {
  readonly enabled: boolean;
  readonly apiBaseUrl: string;
}

export interface PlatformEnvironment {
  VITE_PHASE3_ENABLED?: string;
  VITE_API_BASE_URL?: string;
}

const unavailableConfig: PlatformConfig = Object.freeze({ enabled: false, apiBaseUrl: '' });

/** A single URL policy is shared by chat and the cookie-based platform clients. */
export function resolveApiBaseUrl(configuredUrl: string | undefined, siteHostname = ''): string | null {
  const value = configuredUrl?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)
      || url.username || url.password || value.includes('?') || value.includes('#')) return null;

    const hostname = siteHostname.toLowerCase().replace(/\.$/, '');
    // Defense in depth for an accidentally published development artifact.
    if (hostname === 'gbc.phasscode.com' && url.origin !== 'https://api.phasscode.com') return null;
    if (['gbc.phasscode.com', 'devgbc.phasscode.com'].includes(hostname) && url.protocol !== 'https:') return null;
    return url.href.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export function resolvePlatformConfig(environment: PlatformEnvironment, siteHostname = ''): PlatformConfig {
  if (environment.VITE_PHASE3_ENABLED !== 'true') return unavailableConfig;
  const apiBaseUrl = resolveApiBaseUrl(environment.VITE_API_BASE_URL, siteHostname);
  return apiBaseUrl ? Object.freeze({ enabled: true, apiBaseUrl }) : unavailableConfig;
}

export const platformConfig = resolvePlatformConfig({
  VITE_PHASE3_ENABLED: import.meta.env?.VITE_PHASE3_ENABLED,
  VITE_API_BASE_URL: import.meta.env?.VITE_API_BASE_URL,
}, typeof window === 'undefined' ? '' : window.location.hostname);
