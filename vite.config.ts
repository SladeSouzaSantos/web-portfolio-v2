import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { orbeDiagnosticsPlugin } from './scripts/orbeDiagnosticsPlugin';

export default defineConfig({
  plugins: [react(), orbeDiagnosticsPlugin()],
    server: {
    port: 5173,
    strictPort: true,
  },
});
