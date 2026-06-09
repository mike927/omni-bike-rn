import type { ConfigContext, ExpoConfig } from 'expo/config';

const DEFAULT_STRAVA_CALLBACK_DOMAIN = 'localhost';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Omni Bike',
  slug: 'omni-bike-rn',
  owner: 'mikee927',
  scheme: 'omnibike',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0b0e13',
  },
  ios: {
    supportsTablet: false,
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
    // Disabled: the app uses a custom swipe-to-reveal row gesture (SwipeableRow);
    // Android's predictive back gesture would fight it. Back nav still works.
    predictiveBackGestureEnabled: false,
    // Legacy Bluetooth permissions for Android <= 11 only. The Android 12+ runtime
    // permissions (BLUETOOTH_SCAN + BLUETOOTH_CONNECT, plus the ACCESS_FINE/COARSE_LOCATION
    // fallback for <31) are injected into the manifest by the `react-native-ble-plx`
    // config plugin (below) and requested at runtime in `useBlePermission` — ble-plx
    // does NOT auto-request them, so without that runtime call BLE scan fails silently.
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
        bluetoothAlwaysPermission: 'Allow Omni Bike to connect to your bike trainer and heart rate monitor.',
      },
    ],
    [
      './plugins/with-ios-warning-fixes',
      {
        iosDeploymentTarget: '18.0',
      },
    ],
    'expo-web-browser',
    ['expo-secure-store', { faceIDPermission: 'Allow Omni Bike to access your Face ID biometric data.' }],
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
    eas: {
      projectId: 'f6bf8618-33f0-423d-8763-592bb701a1e9',
    },
    // Register a Strava API application at https://www.strava.com/settings/api,
    // then provide these as local env vars (`.env`) for local builds, or push them
    // to EAS per-environment for cloud builds: `eas env:push <preview|development> --path .env`.
    stravaClientId: process.env.STRAVA_CLIENT_ID ?? '',
    stravaClientSecret: process.env.STRAVA_CLIENT_SECRET ?? '',
    stravaCallbackDomain: process.env.STRAVA_CALLBACK_DOMAIN ?? DEFAULT_STRAVA_CALLBACK_DOMAIN,
  },
});
