import type { CapacitorConfig } from '@capacitor/cli';

// appId is a working placeholder — confirm the final bundle/application id
// with the client before store submission (existing IAP product ids follow
// the com.astrosetta.* pattern). Changing it later means new store listings.
const config: CapacitorConfig = {
  appId: 'com.astrosetta.app',
  appName: 'Astrosetta',
  webDir: 'dist',
  backgroundColor: '#0f1a2e',
  ios: {
    contentInset: 'automatic',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
