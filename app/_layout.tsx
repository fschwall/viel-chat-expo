import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen
          name="debug-entitlement"
          options={{ headerShown: true, title: 'Entitlement Debug' }}
        />
        <Stack.Screen
          name="debug-login"
          options={{ headerShown: true, title: 'Debug Login' }}
        />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
