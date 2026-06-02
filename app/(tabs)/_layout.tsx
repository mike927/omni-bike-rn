import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { noir } from '../../src/ui/theme';

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
          headerTitle: 'Settings',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
