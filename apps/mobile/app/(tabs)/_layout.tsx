/**
 * Tab navigation layout
 */

import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#999',
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="chart"
        options={{
          title: 'Chart',
          tabBarLabel: 'Chart',
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: 'Learn',
          tabBarLabel: 'Learn',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
        }}
      />
    </Tabs>
  );
}
