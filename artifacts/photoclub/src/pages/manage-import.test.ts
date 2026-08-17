/**
 * Import flow — button guard tests
 *
 * Tests exercise the *exported production helpers* from src/lib/import-utils.ts
 * which are the same code used by manage.tsx's Import button `disabled` prop.
 *
 * Cases covered (per task spec):
 *   1. Disabled when photographer name is empty (new-photographer path)
 *   2. Disabled when club is set to "none"
 *   3. Enabled once both photographer name and a real club are provided
 */

import { describe, it, expect } from "vitest";
import {
  isFileSlugTitle,
  isImportButtonDisabled,
  type ImportButtonState,
} from "@/lib/import-utils";

// ---------------------------------------------------------------------------
// A valid base state that should produce an *enabled* button
// ---------------------------------------------------------------------------

const validState: ImportButtonState = {
  selectedCount: 1,
  isPending: false,
  photographerId: "new",
  newPhotographerName: "Alice",
  clubId: "42",
  newClubName: "",
  photoEdits: [{ title: "Sunset at the pier" }],
};

// ---------------------------------------------------------------------------
// isFileSlugTitle (production export)
// ---------------------------------------------------------------------------

describe("isFileSlugTitle", () => {
  it("returns true for an empty string", () => {
    expect(isFileSlugTitle("")).toBe(true);
  });

  it("returns true for 'untitled' (case-insensitive)", () => {
    expect(isFileSlugTitle("Untitled")).toBe(true);
    expect(isFileSlugTitle("UNTITLED")).toBe(true);
  });

  it("returns true for filenames with image extensions", () => {
    expect(isFileSlugTitle("DSC_0042.jpg")).toBe(true);
    expect(isFileSlugTitle("photo.png")).toBe(true);
    expect(isFileSlugTitle("raw.HEIC")).toBe(true);
  });

  it("returns true for camera-style prefixes", () => {
    expect(isFileSlugTitle("IMG_1234")).toBe(true);
    expect(isFileSlugTitle("DSC00042")).toBe(true);
    expect(isFileSlugTitle("PXL_20240101")).toBe(true);
  });

  it("returns false for real descriptive titles", () => {
    expect(isFileSlugTitle("Sunset at the pier")).toBe(false);
    expect(isFileSlugTitle("Portrait session — spring 2024")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isImportButtonDisabled (production export — mirrors manage.tsx disabled prop)
// ---------------------------------------------------------------------------

describe("Import button disabled condition", () => {
  describe("photographer name (new-photographer path)", () => {
    it("is disabled when photographerId is 'new' and newPhotographerName is empty", () => {
      const state: ImportButtonState = {
        ...validState,
        photographerId: "new",
        newPhotographerName: "",
      };
      expect(isImportButtonDisabled(state)).toBe(true);
    });

    it("is disabled when photographerId is 'new' and newPhotographerName is only whitespace", () => {
      const state: ImportButtonState = {
        ...validState,
        photographerId: "new",
        newPhotographerName: "   ",
      };
      expect(isImportButtonDisabled(state)).toBe(true);
    });

    it("is NOT disabled when photographerId is 'new' and newPhotographerName has content", () => {
      const state: ImportButtonState = {
        ...validState,
        photographerId: "new",
        newPhotographerName: "Alice",
      };
      expect(isImportButtonDisabled(state)).toBe(false);
    });

    it("is NOT disabled when photographerId is an existing id (name field irrelevant)", () => {
      const state: ImportButtonState = {
        ...validState,
        photographerId: "7",
        newPhotographerName: "", // irrelevant when an existing photographer is selected
      };
      expect(isImportButtonDisabled(state)).toBe(false);
    });
  });

  describe("club selection", () => {
    it("is NOT disabled when clubId is 'none' (club is optional)", () => {
      const state: ImportButtonState = {
        ...validState,
        clubId: "none",
      };
      expect(isImportButtonDisabled(state)).toBe(false);
    });

    it("is disabled when clubId is 'new' and newClubName is empty", () => {
      const state: ImportButtonState = {
        ...validState,
        clubId: "new",
        newClubName: "",
      };
      expect(isImportButtonDisabled(state)).toBe(true);
    });

    it("is NOT disabled when clubId is 'new' and newClubName has content", () => {
      const state: ImportButtonState = {
        ...validState,
        clubId: "new",
        newClubName: "Lens & Light",
      };
      expect(isImportButtonDisabled(state)).toBe(false);
    });

    it("is NOT disabled when an existing club id is selected", () => {
      const state: ImportButtonState = {
        ...validState,
        clubId: "42",
      };
      expect(isImportButtonDisabled(state)).toBe(false);
    });
  });

  describe("both photographer and club filled in", () => {
    it("is NOT disabled when new photographer name is set and an existing club is chosen", () => {
      const state: ImportButtonState = {
        ...validState,
        photographerId: "new",
        newPhotographerName: "Bob",
        clubId: "5",
      };
      expect(isImportButtonDisabled(state)).toBe(false);
    });

    it("is NOT disabled when an existing photographer and a new club name are both provided", () => {
      const state: ImportButtonState = {
        ...validState,
        photographerId: "3",
        clubId: "new",
        newClubName: "Focus Club",
      };
      expect(isImportButtonDisabled(state)).toBe(false);
    });

    it("is NOT disabled when an existing photographer and an existing club are both selected", () => {
      const state: ImportButtonState = {
        ...validState,
        photographerId: "3",
        clubId: "7",
      };
      expect(isImportButtonDisabled(state)).toBe(false);
    });
  });

  describe("other guard conditions (regression baseline)", () => {
    it("is disabled when no images are selected", () => {
      const state: ImportButtonState = { ...validState, selectedCount: 0 };
      expect(isImportButtonDisabled(state)).toBe(true);
    });

    it("is disabled while a mutation is pending", () => {
      const state: ImportButtonState = { ...validState, isPending: true };
      expect(isImportButtonDisabled(state)).toBe(true);
    });

    it("is NOT disabled when a photo has a file-slug title (warning is informational only)", () => {
      const state: ImportButtonState = {
        ...validState,
        photoEdits: [{ title: "IMG_1234" }],
      };
      expect(isImportButtonDisabled(state)).toBe(false);
    });
  });
});
