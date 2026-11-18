/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  // Resolve virtual:pwa-register during coverage transforms without registering a worker in tests.
  plugins: [VitePWA({ injectRegister: false })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    maxWorkers: 1,
    isolate: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/**/*.spec.ts', 'src/test/**'],
      // Ratchet baseline: pinned just under the level measured on the current
      // suite so a coverage regression fails CI instead of drifting down
      // silently. Raise these numbers as coverage improves; never lower them to
      // make a run pass.
      thresholds: {
        statements: 32,
        branches: 26,
        functions: 27,
        lines: 33,
      },
    },
  },
});
