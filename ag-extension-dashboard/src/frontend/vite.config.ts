/// <reference types="vitest" />
import { defineConfig, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { VitePWA } from 'vite-plugin-pwa';

interface VitestConfigExport extends UserConfig {
  test?: UserConfig['test'];
}

export default defineConfig({
  plugins: [
    react(),
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
      workbox: {
        // Locale files are fetched on demand by the language provider and are
        // intentionally excluded from the precache to keep the install payload small.
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
        // Large raster icons remain available by URL but are not precached;
        // this keeps service-worker installation from duplicating static payload.
        additionalManifestEntries: [],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 24 * 60 * 60,
              },
            },
          },
          {
            // Offline map tiles: cache-first so field areas render with no connectivity.
            urlPattern: /^https:\/\/(?:[a-z]\.)?tile\.openstreetmap\.org\/|\/\/server\.arcgisonline\.com\//i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: {
                maxEntries: 8000,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
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
