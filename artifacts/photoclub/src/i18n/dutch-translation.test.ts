/**
 * Dutch translation smoke tests
 *
 * These tests guard against two classes of regression:
 * 1. A translation key that exists in en.json is missing from nl.json
 * 2. A Dutch translation still returns the raw key (i18next fallback behaviour)
 *
 * Run with: pnpm --filter @workspace/photoclub test
 */

import { describe, it, expect, beforeAll } from "vitest";
import i18next from "i18next";
import en from "./en.json";
import nl from "./nl.json";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type NestedRecord = { [key: string]: string | NestedRecord };

/**
 * Collect every leaf path from a nested translation object.
 * e.g. { nav: { gallery: "…" } }  →  ["nav.gallery"]
 */
function collectKeys(obj: NestedRecord, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object" && v !== null) {
      return collectKeys(v as NestedRecord, path);
    }
    return [path];
  });
}

// ---------------------------------------------------------------------------
// Set up a fresh i18next instance with nl as the active language
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await i18next.init({
    lng: "nl",
    fallbackLng: false, // disable fallback so missing keys surface as raw keys
    resources: {
      en: { translation: en },
      nl: { translation: nl },
    },
    interpolation: { escapeValue: false },
  });
});

// ---------------------------------------------------------------------------
// 1. Key-coverage: every English key must exist in Dutch
// ---------------------------------------------------------------------------

describe("nl.json key coverage — all en.json keys must exist", () => {
  const enKeys = collectKeys(en as NestedRecord);
  const nlKeys = new Set(collectKeys(nl as NestedRecord));

  it.each(enKeys)("key '%s' is present in nl.json", (key) => {
    expect(nlKeys.has(key)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Dutch strings are real translations, not raw key fall-throughs
// ---------------------------------------------------------------------------

describe("Dutch translations are not raw keys", () => {
  const enKeys = collectKeys(en as NestedRecord);

  it.each(enKeys)("t('%s') in Dutch returns a non-empty translated string", (key) => {
    const translated = i18next.t(key);
    // Must be a non-empty string
    expect(typeof translated).toBe("string");
    expect((translated as string).trim().length).toBeGreaterThan(0);
    // Must not be the raw key itself (i18next returns the key when missing)
    expect(translated).not.toBe(key);
  });
});

// ---------------------------------------------------------------------------
// 3. Page-specific spot-checks — hard-coded Dutch strings for each page
// ---------------------------------------------------------------------------

describe("Nav Dutch strings", () => {
  it("gallery link is in Dutch", () => {
    expect(i18next.t("nav.gallery")).toBe("Galerij");
  });

  it("clubs link is in Dutch", () => {
    expect(i18next.t("nav.clubs")).toBe("Clubs");
  });

  it("themes link is in Dutch", () => {
    expect(i18next.t("nav.themes")).toBe("Thema's");
  });

  it("photographers link is in Dutch", () => {
    expect(i18next.t("nav.photographers")).toBe("Fotografen");
  });

  it("signIn is in Dutch", () => {
    expect(i18next.t("nav.signIn")).toBe("Inloggen");
  });

  it("signOut is in Dutch", () => {
    expect(i18next.t("nav.signOut")).toBe("Uitloggen");
  });
});

describe("Home page Dutch strings", () => {
  it("heroTitle1 is in Dutch", () => {
    expect(i18next.t("home.heroTitle1")).toBe("Doordacht. Bewust.");
  });

  it("heroTitle2 is in Dutch", () => {
    expect(i18next.t("home.heroTitle2")).toBe("Trots.");
  });

  it("recent.heading is in Dutch", () => {
    expect(i18next.t("home.recent.heading")).toBe("Recent toegevoegd");
  });

  it("recent.viewAll is in Dutch", () => {
    expect(i18next.t("home.recent.viewAll")).toBe("Bekijk de hele galerij");
  });

  it("photographers.heading is in Dutch", () => {
    expect(i18next.t("home.photographers.heading")).toBe("Fotografen");
  });
});

describe("Gallery page Dutch strings", () => {
  it("title is in Dutch", () => {
    expect(i18next.t("gallery.title")).toBe("De galerij");
  });

  it("subtitle is in Dutch", () => {
    expect(i18next.t("gallery.subtitle")).toBe("Elke foto, elke fotograaf, elk thema.");
  });

  it("empty is in Dutch", () => {
    expect(i18next.t("gallery.empty")).toBe("Geen foto's voldoen aan deze filters");
  });

  it("clearFilters is in Dutch", () => {
    expect(i18next.t("gallery.clearFilters")).toBe("Filters wissen");
  });
});

describe("Clubs page Dutch strings", () => {
  it("title is in Dutch", () => {
    expect(i18next.t("clubs.title")).toBe("Fotoclubs");
  });

  it("empty is in Dutch", () => {
    expect(i18next.t("clubs.empty")).toBe("Geen fotoclubs gevonden");
  });

  it("createButton is in Dutch", () => {
    expect(i18next.t("clubs.createButton")).toBe("Maak een club");
  });
});

describe("Themes page Dutch strings", () => {
  it("title is in Dutch", () => {
    expect(i18next.t("themes.title")).toBe("Thema's");
  });

  it("empty is in Dutch", () => {
    expect(i18next.t("themes.empty")).toBe("Geen thema's gevonden");
  });

  it("photoCount_one uses singular Dutch form", () => {
    expect(i18next.t("themes.photoCount_one", { count: 1 })).toBe("1 foto");
  });

  it("photoCount_other uses plural Dutch form", () => {
    expect(i18next.t("themes.photoCount_other", { count: 5 })).toBe("5 foto's");
  });
});

describe("Photographers page Dutch strings", () => {
  it("title is in Dutch", () => {
    expect(i18next.t("photographers.title")).toBe("Fotografen");
  });

  it("empty is in Dutch", () => {
    expect(i18next.t("photographers.empty")).toBe("Geen fotografen gevonden");
  });

  it("createButton is in Dutch", () => {
    expect(i18next.t("photographers.createButton")).toBe("Fotograaf toevoegen");
  });
});

describe("Photo detail page Dutch strings", () => {
  it("back is in Dutch", () => {
    expect(i18next.t("photoDetail.back")).toBe("Terug naar galerij");
  });

  it("notFound is in Dutch", () => {
    expect(i18next.t("photoDetail.notFound")).toBe("Foto niet gevonden");
  });

  it("leaveNote is in Dutch", () => {
    expect(i18next.t("photoDetail.leaveNote")).toBe("Laat een notitie achter");
  });

  it("saveChanges is in Dutch", () => {
    expect(i18next.t("photoDetail.saveChanges")).toBe("Wijzigingen opslaan");
  });
});

describe("Upload page Dutch strings", () => {
  it("title is in Dutch", () => {
    expect(i18next.t("upload.title")).toBe("Hang een foto op");
  });

  it("submit is in Dutch", () => {
    expect(i18next.t("upload.submit")).toBe("Foto ophangen");
  });

  it("successTitle is in Dutch", () => {
    expect(i18next.t("upload.successTitle")).toBe("Foto toegevoegd");
  });

  it("signInTitle is in Dutch", () => {
    expect(i18next.t("upload.signInTitle")).toBe("Log in om te uploaden");
  });
});

describe("My Photos page Dutch strings", () => {
  it("signInTitle is in Dutch", () => {
    expect(i18next.t("myPhotos.signInTitle")).toBe("Log in om je foto's te beheren");
  });

  it("noPhotosTitle is in Dutch", () => {
    expect(i18next.t("myPhotos.noPhotosTitle")).toBe("Nog geen foto's");
  });

  it("specialtyThemes is in Dutch", () => {
    expect(i18next.t("myPhotos.specialtyThemes")).toBe("Specialiteit thema's");
  });

  it("editPhotoTitle is in Dutch", () => {
    expect(i18next.t("myPhotos.editPhotoTitle")).toBe("Foto bewerken");
  });
});

describe("Language switcher Dutch strings", () => {
  it("label is in Dutch", () => {
    expect(i18next.t("languageSwitcher.label")).toBe("Taal");
  });

  it("nl option is correct", () => {
    expect(i18next.t("languageSwitcher.nl")).toBe("Nederlands");
  });
});

describe("Join page Dutch strings", () => {
  it("heading is in Dutch", () => {
    expect(i18next.t("join.heading")).toBe("Je bent uitgenodigd om foto\u2019s te uploaden");
  });

  it("joinBtn is in Dutch", () => {
    expect(i18next.t("join.joinBtn")).toBe("Deelnemen");
  });

  it("successHeading is in Dutch", () => {
    expect(i18next.t("join.successHeading")).toBe("Toegang verleend!");
  });
});

// ---------------------------------------------------------------------------
// 4. Runtime language switching: verify the i18next instance can switch
//    between English and Dutch at runtime
// ---------------------------------------------------------------------------

describe("Runtime language switching (en ↔ nl)", () => {
  it("switches to English and returns English nav gallery label", async () => {
    await i18next.changeLanguage("en");
    expect(i18next.t("nav.gallery")).toBe("Gallery");
    expect(i18next.t("gallery.title")).toBe("The Gallery");
    expect(i18next.t("clubs.title")).toBe("Communities");
  });

  it("switches to Dutch and returns Dutch nav gallery label", async () => {
    await i18next.changeLanguage("nl");
    expect(i18next.t("nav.gallery")).toBe("Galerij");
    expect(i18next.t("gallery.title")).toBe("De galerij");
    expect(i18next.t("clubs.title")).toBe("Fotoclubs");
  });

  it("Dutch resolvedLanguage is 'nl' after switching", async () => {
    await i18next.changeLanguage("nl");
    expect(i18next.resolvedLanguage).toBe("nl");
  });

  it("English resolvedLanguage is 'en' after switching back", async () => {
    await i18next.changeLanguage("en");
    expect(i18next.resolvedLanguage).toBe("en");
    // restore Dutch so subsequent tests are not affected
    await i18next.changeLanguage("nl");
  });
});
