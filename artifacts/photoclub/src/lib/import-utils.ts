/**
 * Shared utilities for the photo import flow.
 * Exported so they can be unit-tested against production logic directly.
 */

/** Returns true when a string looks like a camera filename or URL slug rather than a real title. */
export function isFileSlugTitle(s: string): boolean {
  const t = s.trim();
  if (!t || /^untitled$/i.test(t)) return true;
  if (/\.(jpe?g|png|webp|gif|tiff?|bmp|heic)$/i.test(t)) return true;
  if (/^(IMG|DSC[FO]?|PXL|MVI|VID|MOV|DCIM|photo|image|screenshot)[_-]?\d/i.test(t)) return true;
  return false;
}

export interface ImportButtonState {
  /** Number of images currently selected (selectedImageIndices.size). */
  selectedCount: number;
  /** Whether the import mutation is in flight. */
  isPending: boolean;
  /** importPhotographerId — "new" | "<id>" */
  photographerId: string;
  /** importNewPhotographerName */
  newPhotographerName: string;
  /** importClubId — "none" | "new" | "<id>" */
  clubId: string;
  /** importNewClubName */
  newClubName: string;
  /** importPhotoEdits */
  photoEdits: Array<{ title: string }>;
  /** importWarningAcknowledged */
  warningAcknowledged: boolean;
}

/**
 * Returns true when the step-3 Import button should be disabled.
 * Mirrors the `disabled` prop on the Import button in manage.tsx step 3.
 */
export function isImportButtonDisabled(s: ImportButtonState): boolean {
  return (
    s.selectedCount === 0 ||
    s.isPending ||
    (s.photographerId === "new" && !s.newPhotographerName.trim()) ||
    s.clubId === "none" ||
    (s.clubId === "new" && !s.newClubName.trim()) ||
    (s.photoEdits.some((e) => !e.title.trim() || isFileSlugTitle(e.title)) &&
      !s.warningAcknowledged)
  );
}
