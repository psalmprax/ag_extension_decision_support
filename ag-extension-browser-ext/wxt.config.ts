import { defineConfig } from 'wxt';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const resolvePaths = [__dirname, path.resolve(__dirname, '..')];
const resolvePkgDir = (pkg: string) => path.dirname(require.resolve(`${pkg}/package.json`, { paths: resolvePaths }));
const resolveEntry = (entry: string) => require.resolve(entry, { paths: resolvePaths });

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    resolve: {
      preserveSymlinks: true,
      dedupe: ['react', 'react-dom'],
      alias: [
        { find: '@ag-extension/shared', replacement: path.resolve(__dirname, '../ag-extension-shared/src') },
        { find: /^react\/jsx-runtime$/, replacement: resolveEntry('react/jsx-runtime') },
        { find: /^react\/jsx-dev-runtime$/, replacement: resolveEntry('react/jsx-dev-runtime') },
        { find: /^react$/, replacement: resolvePkgDir('react') },
        { find: /^react-dom$/, replacement: resolvePkgDir('react-dom') },
        { find: /^lucide-react$/, replacement: resolvePkgDir('lucide-react') },
        { find: /^zod$/, replacement: resolvePkgDir('zod') },
      ],
    },
  }),
  manifest: (env) => {
    // Localhost origins are only included in development builds, not in production host_permissions
    const isDev = env?.mode === 'development' || (!env?.mode && process.env.NODE_ENV === 'development');
    const hostPermissions = ['https://*.gpexts.com/*', 'https://api.gpexts.com/*'];
    if (isDev) {
      hostPermissions.push('http://localhost:7500/*', 'http://127.0.0.1:7500/*', 'https://127.0.0.1:7500/*');
    }

    return {
      name: 'GPExts - Agricultural Decision Support',
      description: 'AI-powered agricultural decision support for field officers and farmers.',
      permissions: ['storage', 'sidePanel', 'geolocation', 'tabs', 'activeTab', 'scripting', 'contextMenus', 'alarms'],
      background: { service_worker: true },
      icons: {
        16: '/icon-16.png',
        32: '/icon-32.png',
        48: '/icon-48.png',
        128: '/icon-128.png',
      },
      action: {
        default_icon: {
          16: '/icon-16.png',
          32: '/icon-32.png',
          48: '/icon-48.png',
          128: '/icon-128.png',
        },
        default_title: 'GPExts - Agricultural Decision Support',
      },
      // Restricted to API origins only — prevents overbroad host access
      // Adjust these patterns for your deployment domain
      host_permissions: hostPermissions,
      commands: {
        '_execute_action': {
          suggested_key: {
            default: 'Ctrl+Shift+A',
            mac: 'Command+Shift+A',
          },
        },
        'open_sidepanel': {
          suggested_key: {
            default: 'Ctrl+Shift+S',
            mac: 'Command+Shift+S',
          },
          description: 'Open the ALFA Sidepanel',
        },
        'capture_photo': {
          suggested_key: {
            default: 'Ctrl+Shift+C',
            mac: 'Command+Shift+C',
          },
          description: 'Capture photo for analysis',
        },
      },
    };
  },
});
