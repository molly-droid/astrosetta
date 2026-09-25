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
    // 'never': safe areas are handled in CSS (viewport-fit=cover + env()
    // insets). 'automatic' double-applies the inset on top of the CSS padding.
    contentInset: 'never',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      // Hidden manually from initNative() once React has painted — avoids the
      // white flash between the native splash and first render.
      launchAutoHide: false,
      backgroundColor: '#0f1a2e',
      showSpinner: false,
    },
    Keyboard: {
      resizeOnFullScreen: true, // Android: resize webview even in fullscreen
    },
  },
};

export default config;
