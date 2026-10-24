export interface OrbeConfig {
  readonly enabled: boolean;
  readonly apiBaseUrl: string;
}

export interface OrbeEnvironment {
  VITE_ORBE_API_ENABLED?: string;
  VITE_API_BASE_URL?: string;
}

const demoConfig: OrbeConfig = Object.freeze({ enabled: false, apiBaseUrl: '' });

/** Only an explicit flag and a valid URL can enable chat requests. */
export function resolveOrbeConfig(environment: OrbeEnvironment, siteHostname = ''): OrbeConfig {
  if (environment.VITE_ORBE_API_ENABLED !== 'true') return demoConfig;

  const configuredUrl = environment.VITE_API_BASE_URL?.trim();
  if (!configuredUrl) return demoConfig;

  try {
    const url = new URL(configuredUrl);
    if (!['http:', 'https:'].includes(url.protocol)
      || url.username || url.password || configuredUrl.includes('?') || configuredUrl.includes('#')) return demoConfig;

    // A mistakenly configured development build must never call dev from the public site.
    const isProductionSite = siteHostname.toLowerCase().replace(/\.$/, '') === 'gbc.phasscode.com';
    if (isProductionSite && url.origin !== 'https://api.phasscode.com') return demoConfig;

    return Object.freeze({ enabled: true, apiBaseUrl: url.href.replace(/\/+$/, '') });
  } catch {
    return demoConfig;
  }
}

export const orbeConfig = resolveOrbeConfig({
  VITE_ORBE_API_ENABLED: import.meta.env?.VITE_ORBE_API_ENABLED,
  VITE_API_BASE_URL: import.meta.env?.VITE_API_BASE_URL,
}, typeof window === 'undefined' ? '' : window.location.hostname);
