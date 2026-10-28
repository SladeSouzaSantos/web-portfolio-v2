/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ORBE_API_ENABLED?: string;
  readonly VITE_AUTH_ENABLED?: string;
  readonly VITE_MEETINGS_ENABLED?: string;
  readonly VITE_API_BASE_URL?: string;
}
