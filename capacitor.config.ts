import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.papelitos.app',
  appName: 'Papelitos',
  webDir: 'out',
  server: {
    // For development, you can point to your Vercel deployment:
    // url: 'https://papelitos2.vercel.app',
    // For production APK, comment the url above to use local files
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#f8fafc',
    },
  },
};

export default config;
