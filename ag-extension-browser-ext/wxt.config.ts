import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Ag-Extension Decision Support',
    description: 'AI-powered agricultural decision support for field officers and farmers.',
    permissions: ['storage', 'sidePanel', 'geolocation', 'tabs', 'activeTab'],
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
    },
  },
});
