import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gpexts.app',
  appName: 'GPExts',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0d1a14',
      showSpinner: false,
    },
    // The web view draws under the status bar, as iOS apps do; the glass top bar pads for it.
    StatusBar: {
      overlaysWebView: true,
      style: 'DEFAULT',
      backgroundColor: '#0d1a14',
    },
  },
};

export default config;
