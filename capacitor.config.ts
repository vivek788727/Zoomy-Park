import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zoomypark.game',
  appName: 'Zoomy Park',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
