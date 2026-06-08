import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { noir } from '../../src/ui/theme';

// All tab screens (Home, History, Settings) are fully Calm Noir and render their own
// in-content dark header (headerShown: false). The tab bar chrome is the shared Calm
// Noir dark bar — no screen needs a light-header override anymore.

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: noir.bg },
        headerTintColor: noir.ink,
        headerShadowVisible: false,
        tabBarActiveTintColor: noir.indigoText,
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
          title: 'History',
          headerShown: false,
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
