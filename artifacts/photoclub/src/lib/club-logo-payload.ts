export function getClubLogoPayload(
  isEditing: boolean,
  originalLogoUrl: string | null,
  logoUrl: string | null,
): { logoUrl?: string } {
  if (!isEditing) {
    return logoUrl ? { logoUrl } : {};
  }

  if (logoUrl === originalLogoUrl) {
    return {};
  }

  return { logoUrl: logoUrl ?? "" };
}