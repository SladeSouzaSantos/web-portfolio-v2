import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Dedicated, disposable test server. The deployment build policy is untouched. */
export default defineConfig(({ command }) => {
  if (command !== 'serve' || process.env.NODE_ENV !== 'test'
    || !/^[0-9a-f-]{36}$/.test(process.env.PHASSCODE_B2_OWNERSHIP_NONCE ?? '')) {
    throw new Error('F3 requires the owned B2/F3 disposable harness.');
  }
  return {
    envDir: false,
    plugins: [react()],
    define: {
      'import.meta.env.VITE_AUTH_ENABLED': JSON.stringify('true'),
      'import.meta.env.VITE_MEETINGS_ENABLED': JSON.stringify('true'),
      'import.meta.env.VITE_ORBE_API_ENABLED': JSON.stringify('false'),
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://127.0.0.1:3000'),
    },
    server: { host: '127.0.0.1', port: 5173, strictPort: true, hmr: false },
  };
});
