export interface PlatformConfig {
  readonly authEnabled: boolean;
  readonly meetingsEnabled: boolean;
  readonly apiBaseUrl: string;
}

export interface PlatformEnvironment {
  VITE_AUTH_ENABLED?: string;
  VITE_MEETINGS_ENABLED?: string;
  VITE_API_BASE_URL?: string;
}

const unavailableConfig: PlatformConfig = Object.freeze({ authEnabled: false, meetingsEnabled: false, apiBaseUrl: '' });

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
  const authEnabled = environment.VITE_AUTH_ENABLED === 'true';
  const meetingsEnabled = environment.VITE_MEETINGS_ENABLED === 'true';
  if (!authEnabled && !meetingsEnabled) return unavailableConfig;
  const apiBaseUrl = resolveApiBaseUrl(environment.VITE_API_BASE_URL, siteHostname);
  return apiBaseUrl ? Object.freeze({ authEnabled, meetingsEnabled, apiBaseUrl }) : unavailableConfig;
}

export const platformConfig = resolvePlatformConfig({
  VITE_AUTH_ENABLED: import.meta.env?.VITE_AUTH_ENABLED,
  VITE_MEETINGS_ENABLED: import.meta.env?.VITE_MEETINGS_ENABLED,
  VITE_API_BASE_URL: import.meta.env?.VITE_API_BASE_URL,
}, typeof window === 'undefined' ? '' : window.location.hostname);
