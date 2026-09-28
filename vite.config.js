import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: false,
    port: 5173,
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
  },
});
