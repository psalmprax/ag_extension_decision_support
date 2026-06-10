/// <reference types="vitest" />
import { defineConfig, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

interface VitestConfigExport extends UserConfig {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    test?: any;
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
                name: 'Ag-Extension Decision Support',
                short_name: 'AgExt',
                description: 'Agricultural Extension Decision Support Dashboard',
                theme_color: '#22c55e',
                background_color: '#ffffff',
                display: 'standalone',
                scope: '/',
                start_url: '/',
                icons: [
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json}'],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/api\./i,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'api-cache',
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 24 * 60 * 60
                            }
                        }
                    }
                ]
            }
        })
    ],
    resolve: {
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
        // CDN configuration for production
        assetsDir: 'assets',
        sourcemap: process.env.NODE_ENV !== 'production',
        minify: 'esbuild',
        rollupOptions: {
            output: {
                // Content hash for cache busting
                entryFileNames: 'assets/[name]-[hash].js',
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash].[ext]',
                manualChunks: {
                    vendor: ['react', 'react-dom', 'react-router-dom'],
                    ui: ['@headlessui/react', 'lucide-react', 'framer-motion'],
                    utils: ['date-fns', 'zod', 'zustand', '@tanstack/react-query'],
                    charts: ['recharts']
                }
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
            exclude: [
                'node_modules/',
                'src/test/setup.ts',
            ],
        },
    },
} as VitestConfigExport);
