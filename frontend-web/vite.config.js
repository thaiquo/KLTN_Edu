import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const localGatewayTarget = process.env.VITE_API_GATEWAY_URL || 'http://localhost:8080';

export default defineConfig({
  // Keep one source of truth for local configuration. Vite exposes only VITE_*.
  envDir: repositoryRoot,
  envPrefix: 'VITE_',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: localGatewayTarget,
        changeOrigin: true
      },
      '/ws': {
        target: localGatewayTarget.replace(/^http/, 'ws'),
        ws: true,
        changeOrigin: true
      }
    }
  }
});
