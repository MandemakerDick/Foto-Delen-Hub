import { Stack } from 'expo-router';

export default function MyPhotosLayout() {
  return <Stack screenOptions={{ headerStyle: { backgroundColor: '#0b0b0c' }, headerTintColor: '#e7e3dc' }}>
    <Stack.Screen name="index" options={{ headerShown: false }} />
    <Stack.Screen name="photo/[id]" />
    <Stack.Screen name="directory/[kind]/[id]" />
  </Stack>;
}