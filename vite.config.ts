import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' makes the build relocatable: it works at the domain root, under a
// GitHub Pages project path, or opened from any static "Sites" bucket.
// Routing uses the URL hash so deep links and refresh work with no server rules.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', sourcemap: false, target: 'es2020' },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
} as any);
