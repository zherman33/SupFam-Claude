import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.supfam.app',
  appName: 'Sup Fam',
  webDir: 'dist',
  server: {
    url: 'https://sup-fam-claude.vercel.app',
    cleartext: true
  }
};

export default config;
