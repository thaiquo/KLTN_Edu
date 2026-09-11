import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const currentDir = fileURLToPath(new URL('.', import.meta.url));
const parentDir = fileURLToPath(new URL('..', import.meta.url));
const envDir = fs.existsSync(fileURLToPath(new URL('.env', import.meta.url))) ? currentDir : parentDir;

export default defineConfig({
  envDir,
  envPrefix: 'VITE_',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: true
      }
    }
  }
});
