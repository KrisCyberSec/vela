import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.velahealth.app',
  appName: 'Vela',
  webDir: 'build',
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#FAF6F1',
    },
    SplashScreen: {
      launchAutoHide: true,
      showSpinner: false,
      backgroundColor: '#FAF6F1',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_vela',
      iconColor: '#C97B5C',
    },
  },
};

export default config;
