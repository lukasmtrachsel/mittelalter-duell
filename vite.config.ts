import { defineConfig } from 'vite';

// Relativer base-Pfad, damit der Build unter https://<name>.github.io/<repo>/ läuft.
export default defineConfig({
  base: './',
  server: { port: 5173 },
  build: { target: 'es2022', chunkSizeWarningLimit: 6000 },
});
