import type { CapacitorConfig } from '@capacitor/cli';

const phoneDevServerUrl = process.env.CHAMA_DEV_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: 'com.chama.app',
  appName: 'CHAMAZ360',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: false,
  },
};

if (phoneDevServerUrl) {
  const devServer = new URL(phoneDevServerUrl);

  config.server = {
    url: phoneDevServerUrl,
    cleartext: devServer.protocol === 'http:',
    allowNavigation: [devServer.origin],
  };
}

export default config;
