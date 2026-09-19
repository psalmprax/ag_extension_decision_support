/// <reference types="vitest" />
import { defineConfig, type UserConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Locale JSON in public/ is pretty-printed for diff review, but shipping it that
 * way costs ~30% of the payload. Minifies dist/locales/*.json after the build;
 * files are fetched on demand by the language provider, so content is unchanged.
 */
function minifyLocaleJson(): Plugin {
  let outDir = 'dist';
  return {
    name: 'minify-locale-json',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    apply: 'build',
    closeBundle() {
      const localeDir = path.join(outDir, 'locales');
      if (!fs.existsSync(localeDir)) return;
      for (const file of fs.readdirSync(localeDir)) {
        if (!file.endsWith('.json')) continue;
        const full = path.join(localeDir, file);
        const before = fs.statSync(full).size;
        const parsed = JSON.parse(fs.readFileSync(full, 'utf8')) as object;
        fs.writeFileSync(full, JSON.stringify(parsed));
        const saved = before - fs.statSync(full).size;
        if (saved > 0) console.log(`  minified locales/${file} (-${(saved / 1024).toFixed(0)}KB)`);
      }
    },
  };
}

interface VitestConfigExport extends UserConfig {
  test?: UserConfig['test'];
}

/**
 * Self-host onnxruntime-web's WASM binaries.
 *
 * The edge vision classifier previously fetched the runtime from cdn.jsdelivr.net,
 * which (a) violated the production CSP (script/connect-src) so inference silently
 * degraded to heuristics, and (b) added a third-party supply-chain dependency for
 * an offline-first feature. The dist/ wasm files are now copied into the build at
 * /models/ort/ and served same-origin next to the ONNX models.
 */
const ortDist = path.dirname(createRequire(import.meta.url).resolve('onnxruntime-web/wasm'));

function selfHostOnnxRuntime(): Plugin {
  let outputDir = 'dist';
  const wasmFiles = [
    'ort-wasm-simd-threaded.wasm',
    'ort-wasm-simd-threaded.mjs',
  ];
  return {
    name: 'self-host-onnx-runtime',
    apply: 'build',
    configResolved(config) {
      outputDir = config.build.outDir;
    },
    closeBundle() {
      const outDir = path.resolve(outputDir, 'models/ort');
      fs.mkdirSync(outDir, { recursive: true });
      for (const file of wasmFiles) {
        const src = path.join(ortDist, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, path.join(outDir, file));
          console.log(`  self-hosted onnxruntime: /models/ort/${file}`);
        } else {
          throw new Error(`onnxruntime-web runtime file missing: ${file}`);
        }
      }
    },
  };
}

// Dev server serves /models/* directly from node_modules so the classifier works
// without a full build. (Production nginx aliases /models/ from the copied files.)
function serveOrtInDev(): Plugin {
  return {
    name: 'serve-ort-in-dev',
    configureServer(server) {
      server.middlewares.use('/models/ort', (req, _res, next) => {
        const file = String(req.url || '').replace(/^\//, '').split('?')[0];
        if (!file || file.includes('..')) return next();
        const filePath = path.join(ortDist, file);
        if (fs.existsSync(filePath)) {
          _res.setHeader('Content-Type', file.endsWith('.mjs') ? 'text/javascript' : 'application/wasm');
          fs.createReadStream(filePath).pipe(_res);
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    minifyLocaleJson(),
    selfHostOnnxRuntime(),
    serveOrtInDev(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'GPExts - Agricultural Decision Support',
        short_name: 'GPExts',
        description: 'AI-driven agricultural extension decision support, pathological crop diagnostics, and offline field operations.',
        theme_color: '#059669',
        background_color: '#0c0a09',
        display: 'standalone',
        orientation: 'portrait-primary',
        categories: ['productivity', 'agriculture', 'utilities', 'business'],
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Disease Diagnostics',
            short_name: 'Diagnostics',
            description: 'Capture leaf or soil photos for real-time pathology diagnosis',
            url: '/disease-diagnosis',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Farmer Map',
            short_name: 'Map',
            description: 'View geospatial farmer portfolio and field visits',
            url: '/dashboard',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Knowledge Base',
            short_name: 'Knowledge',
            description: 'Search agronomic guides and localized pest treatments',
            url: '/knowledge',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
        globIgnores: ['**/*.wasm', '**/node_modules/**'],
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    preserveSymlinks: true,
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    allowedHosts: ['www.gpexts.com', 'gpexts.com'],
    proxy: {
      '/api': {
        target: 'http://backend:3001',
        changeOrigin: true,
      },
      '/api-docs': {
        target: 'http://backend:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://backend:3001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    // Keep the warning threshold aligned with the largest intentionally shared
    // application chunk (602 kB minified, approximately 121 kB gzip).
    chunkSizeWarningLimit: 650,
    // CDN: when VITE_CDN_URL is set (e.g. https://cdn.gpexts.com), Vite rewrites asset URLs to the CDN origin
    assetsDir: 'assets',
    sourcemap: process.env.NODE_ENV !== 'production',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // Content hash for cache busting
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return undefined;
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/react-router-dom/') ||
            id.includes('/node_modules/@tanstack/')
          ) {
            return 'core-vendor';
          }
          if (id.includes('/node_modules/framer-motion/') || id.includes('/node_modules/lucide-react/')) {
            return 'ui-vendor';
          }
          if (id.includes('/node_modules/recharts/')) return 'charts-vendor';
          if (id.includes('/node_modules/leaflet/') || id.includes('/node_modules/react-leaflet/')) {
            return 'maps-vendor';
          }
          return undefined;
        },
      },
    },
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'zustand', 'zod'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/setup.ts'],
    },
  },
} satisfies VitestConfigExport);
