import { resolveApiBaseUrl } from './platform';

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

  const apiBaseUrl = resolveApiBaseUrl(environment.VITE_API_BASE_URL, siteHostname);
  return apiBaseUrl ? Object.freeze({ enabled: true, apiBaseUrl }) : demoConfig;
}

export const orbeConfig = resolveOrbeConfig({
  VITE_ORBE_API_ENABLED: import.meta.env?.VITE_ORBE_API_ENABLED,
  VITE_API_BASE_URL: import.meta.env?.VITE_API_BASE_URL,
}, typeof window === 'undefined' ? '' : window.location.hostname);
