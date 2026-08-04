// @vitest-environment jsdom
/**
 * Archive card component test
 *
 * Verifies that <ArchiveCard> uses useDateLocale() to format the closed-on
 * date and passes the result into the translation call, so Dutch users see
 * a Dutch-formatted date string rather than an English one.
 *
 * Regression guard: if someone replaces useDateLocale() with a hardcoded
 * locale, or drops the locale argument from format(), the Dutch date assertion
 * below will fail while the pure i18n unit tests in dutch-translation.test.ts
 * would still pass.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { Router } from "wouter";
import { ArchiveCard } from "./archive-card";
import en from "@/i18n/en.json";
import nl from "@/i18n/nl.json";
import type { ReviewSession } from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Stub out Lucide icons so they don't require a full DOM/SVG environment
// ---------------------------------------------------------------------------
vi.mock("lucide-react", () => ({
  Image: () => null,
}));

// ---------------------------------------------------------------------------
// Set up a shared i18next instance with Dutch as the active language
// ---------------------------------------------------------------------------
const i18n = i18next.createInstance();

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "nl",
    fallbackLng: false,
    resources: {
      en: { translation: en },
      nl: { translation: nl },
    },
    interpolation: { escapeValue: false },
  });
});

// Clean up the DOM after each test so renders don't accumulate
afterEach(cleanup);

// ---------------------------------------------------------------------------
// Fake session data
// ---------------------------------------------------------------------------
// Use a local-date constructor to avoid UTC-vs-local timezone ambiguity.
// new Date(2026, 7, 3) = 3 August 2026 in local time.
const AUG_3_2026 = new Date(2026, 7, 3);

const fakeSession: ReviewSession = {
  id: 1,
  clubId: 10,
  title: "Zomer sessie 2026",
  status: "closed",
  createdAt: "2026-06-01T00:00:00Z",
  closedAt: AUG_3_2026.toISOString(),
  photoCount: 7,
};

// ---------------------------------------------------------------------------
// Helper: render ArchiveCard inside the providers it needs
// ---------------------------------------------------------------------------
function renderArchiveCard(session: ReviewSession = fakeSession) {
  return render(
    <I18nextProvider i18n={i18n}>
      <Router>
        <ArchiveCard session={session} clubName="Fotoclub Utrecht" />
      </Router>
    </I18nextProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ArchiveCard — Dutch date rendering", () => {
  it("renders the session title", () => {
    renderArchiveCard();
    expect(screen.getByText("Zomer sessie 2026")).toBeInTheDocument();
  });

  it("renders the club name", () => {
    renderArchiveCard();
    expect(screen.getByText("Fotoclub Utrecht")).toBeInTheDocument();
  });

  it("renders the closed badge in Dutch", () => {
    renderArchiveCard();
    // The badge text should be the Dutch 'closedBadge' translation
    expect(screen.getByText("gesloten")).toBeInTheDocument();
  });

  it("renders the closedOn date in Dutch format (e.g. 'Gesloten 3 aug. 2026')", () => {
    renderArchiveCard();
    // The full translated+formatted string that Dutch users see
    expect(screen.getByText("Gesloten 3 aug. 2026")).toBeInTheDocument();
  });

  it("does NOT render an English-formatted date", () => {
    renderArchiveCard();
    // If the locale were accidentally hardcoded to en-US, we'd see "Aug 3, 2026"
    expect(screen.queryByText(/Aug 3, 2026/)).not.toBeInTheDocument();
  });

  it("omits the closed date span when closedAt is null", () => {
    const openSession: ReviewSession = {
      ...fakeSession,
      closedAt: null,
    };
    renderArchiveCard(openSession);
    expect(screen.queryByText(/Gesloten/)).not.toBeInTheDocument();
  });
});
