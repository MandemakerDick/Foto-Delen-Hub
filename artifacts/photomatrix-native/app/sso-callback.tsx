import { Redirect } from 'expo-router';

// Clerk's Expo SSO flow returns here before finishing the browser session.
// Keep the path routable so Android does not show Expo Router's not-found page.
export default function SSOCallback() {
  return <Redirect href="/sign-in" />;
}