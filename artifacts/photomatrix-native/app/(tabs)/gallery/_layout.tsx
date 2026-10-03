import { Stack } from 'expo-router';

export default function GalleryLayout() {
  return <Stack screenOptions={{ headerStyle: { backgroundColor: '#0b0b0c' }, headerTintColor: '#e7e3dc' }}>
    <Stack.Screen name="index" options={{ headerShown: false }} />
    <Stack.Screen name="clubs" />
    <Stack.Screen name="themes" />
    <Stack.Screen name="photographers" />
    <Stack.Screen name="following" />
    <Stack.Screen name="directory/[kind]/[id]" />
    <Stack.Screen name="photo/[id]" />
  </Stack>;
}