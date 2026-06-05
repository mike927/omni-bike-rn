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
    bundleIdentifier: 'app.omnibike',
    infoPlist: {
      // Required for HKHealthStore.startWatchApp(toHandle:) to reliably wake
      // the paired Watch companion app when starting a workout.
      LSApplicationCategoryType: 'public.app-category.healthcare-fitness',
      // The app uses only exempt encryption (HTTPS + standard Apple crypto via
      // expo-crypto / Keychain), so declare non-exempt encryption = false up
      // front. Skips the per-build "export compliance" prompt in TestFlight.
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0b0e13',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    permissions: [
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_ADMIN',
      'android.permission.BLUETOOTH_CONNECT',
    ],
    package: 'app.omnibike',
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
    // Custom minimal HealthKit plugin — replaces `react-native-health`'s bundled
    // plugin to avoid the Clinical Records (`com.apple.developer.healthkit.access`)
    // entitlement it writes unconditionally. The rn-health pod is still autolinked.
    [
      './plugins/with-healthkit-minimal',
      {
        healthSharePermission:
          'Omni Bike reads your heart rate from Apple Watch to display live HR during training sessions.',
        healthUpdatePermission:
          'Omni Bike saves your completed indoor cycling workouts (duration, distance, and calories) to Apple Health.',
      },
    ],
  ],
  extra: {
    // Register a Strava API application at https://www.strava.com/settings/api
    // then set these environment variables (or EAS secrets for CI builds).
    stravaClientId: process.env.STRAVA_CLIENT_ID ?? '',
    stravaClientSecret: process.env.STRAVA_CLIENT_SECRET ?? '',
    stravaCallbackDomain: process.env.STRAVA_CALLBACK_DOMAIN ?? DEFAULT_STRAVA_CALLBACK_DOMAIN,
  },
});
