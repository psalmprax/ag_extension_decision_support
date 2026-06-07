/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
    plugins: [react()],
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
        isolate: false,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'json-summary'],
            include: ['src/**/*.{ts,tsx}'],
            exclude: [
                'src/**/*.d.ts',
                'src/**/*.spec.ts',
                'src/**/*.test.ts',
                'src/test/**',
                'src/vite-env.d.ts',
                'src/sw.ts',
                'src/inject_translations*.ts',
            ],
            thresholds: {
                // TODO: Raise to 70%+ as test coverage improves
                // Current coverage is ~6% — setting floor at 10% to start tracking
                branches: 2,
                functions: 4,
                lines: 6,
                statements: 6,
            },
        },
    },
})
