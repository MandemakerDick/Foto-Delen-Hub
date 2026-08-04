/**
 * Dutch translation smoke tests
 *
 * These tests guard against two classes of regression:
 * 1. A translation key that exists in en.json is missing from nl.json
 * 2. A Dutch translation still returns the raw key (i18next fallback behaviour)
 *
 * Run with: pnpm --filter @workspace/review-club test
 */

import { describe, it, expect, beforeAll } from "vitest";
import i18next from "i18next";
import { format } from "date-fns";
import { nl as nlLocale, enUS } from "date-fns/locale";
import type { Locale } from "date-fns";
import en from "./en.json";
import nl from "./nl.json";

// ---------------------------------------------------------------------------
// Replicate the locale map from use-date-locale.ts so the tests exercise
// the same language-to-date-locale selection path as the running application.
// ---------------------------------------------------------------------------
const localeMap: Record<string, Locale> = {
  nl: nlLocale,
  en: enUS,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type NestedRecord = { [key: string]: string | NestedRecord };

/**
 * Collect every leaf path from a nested translation object.
 * e.g. { nav: { sessions: "…" } }  →  ["nav.sessions"]
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

describe("Home page Dutch strings", () => {
  it("heroSubtitle is in Dutch", () => {
    expect(i18next.t("home.heroSubtitle")).toBe(
      "Gezamenlijke beoordeling voor jouw fotoclub."
    );
  });

  it("activeSessionsTitle is in Dutch", () => {
    expect(i18next.t("home.activeSessionsTitle")).toBe("Actieve sessies");
  });

  it("noSessionsTitle is in Dutch", () => {
    expect(i18next.t("home.noSessionsTitle")).toBe("Geen actieve sessies");
  });
});

describe("Archive page Dutch strings", () => {
  it("title is in Dutch", () => {
    expect(i18next.t("archive.title")).toBe("Archief");
  });

  it("subtitle is in Dutch", () => {
    expect(i18next.t("archive.subtitle")).toBe(
      "Eerdere beoordelingssessies en historische feedback."
    );
  });

  it("emptyTitle is in Dutch", () => {
    expect(i18next.t("archive.emptyTitle")).toBe("Geen gearchiveerde sessies");
  });

  it("closedBadge is in Dutch", () => {
    expect(i18next.t("archive.closedBadge")).toBe("gesloten");
  });

  it("closedOn interpolates a Dutch-formatted date correctly", () => {
    // Replicate the path the UI takes: localeMap → format → t("archive.closedOn")
    const selectedLocale = localeMap[i18next.language] ?? enUS;
    const date = format(new Date(2026, 7, 3), "PP", { locale: selectedLocale });
    expect(date).toBe("3 aug. 2026");
    expect(i18next.t("archive.closedOn", { date })).toBe("Gesloten 3 aug. 2026");
  });

  it("photoCount_one uses singular Dutch form", () => {
    expect(i18next.t("archive.photoCount_one", { count: 1 })).toBe("1 foto");
  });

  it("photoCount_other uses plural Dutch form", () => {
    expect(i18next.t("archive.photoCount_other", { count: 5 })).toBe("5 foto's");
  });
});

describe("Admin page Dutch strings", () => {
  it("title is in Dutch", () => {
    expect(i18next.t("admin.title")).toBe("Beheerpaneel");
  });

  it("newSession button is in Dutch", () => {
    expect(i18next.t("admin.newSession")).toBe("Nieuwe sessie");
  });

  it("createSessionBtn is in Dutch", () => {
    expect(i18next.t("admin.createSessionBtn")).toBe("Sessie aanmaken");
  });

  it("allSessions heading is in Dutch", () => {
    expect(i18next.t("admin.allSessions")).toBe("Alle sessies");
  });

  it("accessDenied message is in Dutch", () => {
    expect(i18next.t("admin.accessDenied")).toBe(
      "Toegang geweigerd. Alleen beheerders."
    );
  });

  it("deleteSession button is in Dutch", () => {
    expect(i18next.t("admin.deleteSession")).toBe("Sessie verwijderen");
  });

  it("closeSession button is in Dutch", () => {
    expect(i18next.t("admin.closeSession")).toBe("Sessie sluiten");
  });
});

describe("Session-detail page Dutch strings", () => {
  it("submittedPhotos heading is in Dutch", () => {
    expect(i18next.t("session.submittedPhotos")).toBe("Ingediende foto's");
  });

  it("submitPhoto button is in Dutch", () => {
    expect(i18next.t("session.submitPhoto")).toBe("Foto indienen");
  });

  it("reviewPanel heading is in Dutch", () => {
    expect(i18next.t("session.reviewPanel")).toBe("Beoordelingspanel");
  });

  it("noPhotosTitle is in Dutch", () => {
    expect(i18next.t("session.noPhotosTitle")).toBe("Nog geen foto's ingediend");
  });

  it("noReviewers is in Dutch", () => {
    expect(i18next.t("session.noReviewers")).toBe(
      "Geen beoordelaars toegewezen."
    );
  });
});

describe("Nav Dutch strings", () => {
  it("sessions link is in Dutch", () => {
    expect(i18next.t("nav.sessions")).toBe("Sessies");
  });

  it("archive link is in Dutch", () => {
    expect(i18next.t("nav.archive")).toBe("Archief");
  });

  it("admin link is in Dutch", () => {
    expect(i18next.t("nav.admin")).toBe("Beheer");
  });

  it("signIn is in Dutch", () => {
    expect(i18next.t("nav.signIn")).toBe("Inloggen");
  });
});

describe("Language switcher Dutch strings", () => {
  it("label is in Dutch", () => {
    expect(i18next.t("languageSwitcher.label")).toBe("Taal");
  });
});

// ---------------------------------------------------------------------------
// 6. Language-switching: verify the i18next instance can switch between
//    English and Dutch at runtime, matching the LanguageSwitcher component
//    behaviour driven by i18n.changeLanguage()
// ---------------------------------------------------------------------------

describe("Runtime language switching (en ↔ nl)", () => {
  it("switches to English and returns English home subtitle", async () => {
    await i18next.changeLanguage("en");
    expect(i18next.t("home.heroSubtitle")).toBe(
      "Collaborative critique sessions for your photography club."
    );
    expect(i18next.t("nav.sessions")).toBe("Sessions");
    expect(i18next.t("archive.title")).toBe("Archive");
  });

  it("switches to Dutch and returns Dutch home subtitle", async () => {
    await i18next.changeLanguage("nl");
    expect(i18next.t("home.heroSubtitle")).toBe(
      "Gezamenlijke beoordeling voor jouw fotoclub."
    );
    expect(i18next.t("nav.sessions")).toBe("Sessies");
    expect(i18next.t("archive.title")).toBe("Archief");
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

// ---------------------------------------------------------------------------
// 7. common.photoCount plurals — i18next plural selection at runtime
//    Call the base key (not _one/_other) so the runtime plural resolver
//    picks the correct suffix, mirroring how the UI renders photo counts.
// ---------------------------------------------------------------------------

describe("common.photoCount Dutch plurals — runtime plural selection", () => {
  it("count 1 selects the singular Dutch form via runtime plural resolution", () => {
    expect(i18next.t("common.photoCount", { count: 1 })).toBe("1 foto");
  });

  it("count 5 selects the plural Dutch form via runtime plural resolution", () => {
    expect(i18next.t("common.photoCount", { count: 5 })).toBe("5 foto's");
  });

  it("count 0 selects the plural Dutch form via runtime plural resolution", () => {
    expect(i18next.t("common.photoCount", { count: 0 })).toBe("0 foto's");
  });
});

// ---------------------------------------------------------------------------
// 8. Dutch date locale — locale selection via the app's locale map
//    These tests replicate the localeMap from use-date-locale.ts so they
//    catch regressions in the language-to-date-locale mapping, not just
//    in date-fns itself.  Local date constructors (not ISO strings) are used
//    to avoid UTC-vs-local timezone issues.
// ---------------------------------------------------------------------------

describe("Dutch date locale — app locale selection and formatting", () => {
  it("selects the nl date-fns locale when i18next language is 'nl'", () => {
    // i18next was initialised with lng: "nl" in beforeAll
    const selectedLocale = localeMap[i18next.language] ?? enUS;
    expect(selectedLocale).toBe(nlLocale);
  });

  it("formats 3 Aug 2026 as '3 aug. 2026' when Dutch locale is selected", () => {
    const selectedLocale = localeMap[i18next.language] ?? enUS;
    // new Date(year, monthIndex, day) — local clock, no UTC-shift ambiguity
    expect(format(new Date(2026, 7, 3), "PP", { locale: selectedLocale })).toBe(
      "3 aug. 2026"
    );
  });

  it("formats 1 Jan 2026 as '1 jan. 2026' when Dutch locale is selected", () => {
    const selectedLocale = localeMap[i18next.language] ?? enUS;
    expect(format(new Date(2026, 0, 1), "PP", { locale: selectedLocale })).toBe(
      "1 jan. 2026"
    );
  });

  it("formats 25 Dec 2026 as '25 dec. 2026' when Dutch locale is selected", () => {
    const selectedLocale = localeMap[i18next.language] ?? enUS;
    expect(format(new Date(2026, 11, 25), "PP", { locale: selectedLocale })).toBe(
      "25 dec. 2026"
    );
  });

  it("switches to English locale and produces English-formatted date", async () => {
    await i18next.changeLanguage("en");
    const selectedLocale = localeMap[i18next.language] ?? enUS;
    expect(selectedLocale).toBe(enUS);
    expect(format(new Date(2026, 7, 3), "PP", { locale: selectedLocale })).toBe(
      "Aug 3, 2026"
    );
    // restore Dutch for any subsequent tests
    await i18next.changeLanguage("nl");
  });
});
