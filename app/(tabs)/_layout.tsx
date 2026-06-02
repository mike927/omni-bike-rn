import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { noir, palette } from '../../src/ui/theme';

// History keeps a light header + scene until its Calm Noir fast-follow restyle
// lands, so a light body doesn't sit under a dark header. Home & Settings render
// their own in-content Calm Noir header (headerShown: false). The tab bar chrome
// is the shared Calm Noir dark bar.
const LIGHT_SCREEN_OPTIONS = {
  headerStyle: { backgroundColor: palette.surface },
  headerTintColor: palette.text,
  sceneStyle: { backgroundColor: palette.background },
} as const;

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: noir.bg },
        headerTintColor: noir.ink,
        headerShadowVisible: false,
        tabBarActiveTintColor: noir.indigoSoft,
        tabBarInactiveTintColor: noir.ink3,
        tabBarStyle: {
          height: 64,
          paddingTop: 8,
          paddingBottom: 8,
          backgroundColor: noir.bg,
          borderTopColor: noir.hairline,
        },
        sceneStyle: { backgroundColor: noir.bg },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          ...LIGHT_SCREEN_OPTIONS,
          title: 'History',
          headerTitle: 'Workout History',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'time' : 'time-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
