import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for wrapping the built web game into a native
 * Android (Play Store) / iOS app.
 *
 * One-time setup (after `npm install @capacitor/core @capacitor/cli @capacitor/android`):
 *   npx cap init "Open Mindi" com.openmindi.game --web-dir dist
 *   npm run build
 *   npx cap add android
 *   npm run cap:sync
 *   npm run cap:open      # opens Android Studio to build the AAB for Play Store
 */
const config: CapacitorConfig = {
  appId: 'com.openmindi.game',
  appName: 'Open Mindi',
  webDir: 'dist',
  backgroundColor: '#06231a',
  android: {
    // The game supports both orientations; rotating the phone re-lays the table.
    allowMixedContent: false
  }
};

export default config;
