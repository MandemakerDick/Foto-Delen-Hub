/** Converts API media paths into URLs Expo Image can load outside the web proxy. */
export function resolveMediaUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  const path = value.startsWith('/') ? value : `/${value}`;
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}${path}` : path;
}

export function storageMediaPath(objectPath: string): string {
  return objectPath.startsWith('/api/storage') ? objectPath : `/api/storage${objectPath.startsWith('/') ? objectPath : `/${objectPath}`}`;
}