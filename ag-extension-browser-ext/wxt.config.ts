import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Ag-Extension Decision Support',
    description: 'AI-powered agricultural decision support for field officers and farmers.',
    permissions: ['storage', 'sidePanel', 'geolocation', 'tabs', 'activeTab', 'contextMenus'],
    background: { service_worker: true },
    action: {},
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
