import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.arminhermes.countdowngod',
  appName: 'TimerO',
  webDir: 'public',
  backgroundColor: '#08090a',
  android: {
    allowMixedContent: false,
  },
};

export default config;
