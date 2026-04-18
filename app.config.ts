import type { ConfigContext, ExpoConfig } from 'expo/config';

const DEFAULT_STRAVA_CALLBACK_DOMAIN = 'localhost';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'omni-bike-rn',
  slug: 'omni-bike-rn',
  scheme: 'omnibike',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.anonymous.omnibikern',
    infoPlist: {
      // Required for HKHealthStore.startWatchApp(toHandle:) to reliably wake
      // the paired Watch companion app when starting a workout.
      LSApplicationCategoryType: 'public.app-category.healthcare-fitness',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    permissions: [
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_ADMIN',
      'android.permission.BLUETOOTH_CONNECT',
    ],
    package: 'com.anonymous.omnibikern',
  },
  plugins: [
    'expo-router',
    [
      'react-native-ble-plx',
      {
        isBackgroundEnabled: true,
        modes: ['central'],
        bluetoothAlwaysPermission: 'Allow $(PRODUCT_NAME) to connect to your bike trainer and heart rate monitor.',
      },
    ],
    [
      './plugins/with-ios-warning-fixes',
      {
        iosDeploymentTarget: '18.0',
      },
    ],
    'expo-web-browser',
    'expo-secure-store',
    [
      'react-native-health',
      {
        healthSharePermission:
          'Omni Bike reads your heart rate from Apple Watch to display live HR during training sessions.',
        healthUpdatePermission:
          'Omni Bike saves your completed indoor cycling workouts (duration, distance, calories, and heart rate) to Apple Health.',
      },
    ],
    // Must run after `react-native-health` so it can strip the Clinical Records
    // entitlement that plugin writes unconditionally.
    './plugins/with-watch-extension',
  ],
  extra: {
    // Register a Strava API application at https://www.strava.com/settings/api
    // then set these environment variables (or EAS secrets for CI builds).
    stravaClientId: process.env.STRAVA_CLIENT_ID ?? '',
    stravaClientSecret: process.env.STRAVA_CLIENT_SECRET ?? '',
    stravaCallbackDomain: process.env.STRAVA_CALLBACK_DOMAIN ?? DEFAULT_STRAVA_CALLBACK_DOMAIN,
  },
});
