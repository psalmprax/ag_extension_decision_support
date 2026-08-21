import { defineConfig } from 'wxt';
import path from 'path';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    resolve: {
      alias: {
        '@ag-extension/shared': path.resolve(__dirname, '../ag-extension-shared/src'),
      },
    },
  }),
  manifest: {
    name: 'Ag-Extension Decision Support',
    description: 'AI-powered agricultural decision support for field officers and farmers.',
    permissions: ['storage', 'sidePanel', 'geolocation', 'tabs', 'activeTab', 'contextMenus'],
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
    host_permissions: ['<all_urls>'],
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
  },
});
