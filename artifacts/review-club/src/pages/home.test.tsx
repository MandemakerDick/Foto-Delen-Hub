// @vitest-environment jsdom
/**
 * Home page — deadline-passed cue regression guard
 *
 * Asserts that the session card on the Home page shows the
 * "session.deadlinePassed" label when submissionDeadline is in the past,
 * and does NOT show it when the deadline is in the future.
 *
 * This guards against markup refactors that silently drop the cue.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { Router } from "wouter";
import { Home } from "./home";
import en from "@/i18n/en.json";
import nl from "@/i18n/nl.json";

// ---------------------------------------------------------------------------
// Stub hooks that reach outside the component under test
// ---------------------------------------------------------------------------

vi.mock("@workspace/api-client-react", () => ({
  useListReviewSessions: vi.fn(),
  useListClubs: vi.fn(),
}));

vi.mock("@/hooks/use-page-param", () => ({
  usePageParam: () => [1, vi.fn()] as const,
}));

vi.mock("@/hooks/use-date-locale", () => ({
  useDateLocale: () => undefined,
}));

vi.mock("lucide-react", () => ({
  Calendar: () => null,
  Clock: () => null,
  Image: () => null,
  ScanEye: () => null,
}));

vi.mock("@/components/pagination-bar", () => ({
  PaginationBar: () => null,
}));

// ---------------------------------------------------------------------------
// Shared i18next instance (English is enough — we test key resolution)
// ---------------------------------------------------------------------------
const i18n = i18next.createInstance();

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "en",
    fallbackLng: false,
    resources: {
      en: { translation: en },
      nl: { translation: nl },
    },
    interpolation: { escapeValue: false },
  });
});

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Import the mocked module so we can set return values per test
// ---------------------------------------------------------------------------
import { useListReviewSessions, useListClubs } from "@workspace/api-client-react";

const mockedUseListReviewSessions = vi.mocked(useListReviewSessions);
const mockedUseListClubs = vi.mocked(useListClubs);

// ---------------------------------------------------------------------------
// Shared fake data helpers
// ---------------------------------------------------------------------------
const PAST_DEADLINE = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const FUTURE_DEADLINE = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    clubId: 10,
    title: "Test Session",
    status: "open",
    createdAt: "2026-01-01T00:00:00Z",
    closedAt: null,
    photoCount: 3,
    submissionDeadline: null,
    scheduledFor: null,
    description: null,
    ...overrides,
  };
}

function renderHome() {
  mockedUseListClubs.mockReturnValue({ data: [], isLoading: false } as ReturnType<typeof useListClubs>);

  return render(
    <I18nextProvider i18n={i18n}>
      <Router>
        <Home />
      </Router>
    </I18nextProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Home — deadline-passed cue", () => {
  it("shows the deadlinePassed label when submissionDeadline is in the past", () => {
    mockedUseListReviewSessions.mockReturnValue({
      data: [makeSession({ submissionDeadline: PAST_DEADLINE })],
      isLoading: false,
    } as ReturnType<typeof useListReviewSessions>);

    renderHome();

    // en.json session.deadlinePassed = "The submission deadline has passed."
    expect(screen.getByText("The submission deadline has passed.")).toBeInTheDocument();
  });

  it("does NOT show the deadlinePassed label when submissionDeadline is in the future", () => {
    mockedUseListReviewSessions.mockReturnValue({
      data: [makeSession({ submissionDeadline: FUTURE_DEADLINE })],
      isLoading: false,
    } as ReturnType<typeof useListReviewSessions>);

    renderHome();

    expect(
      screen.queryByText("The submission deadline has passed.")
    ).not.toBeInTheDocument();
  });

  it("does NOT show the deadlinePassed label when there is no deadline", () => {
    mockedUseListReviewSessions.mockReturnValue({
      data: [makeSession({ submissionDeadline: null })],
      isLoading: false,
    } as ReturnType<typeof useListReviewSessions>);

    renderHome();

    expect(
      screen.queryByText("The submission deadline has passed.")
    ).not.toBeInTheDocument();
  });
});

describe("Home — deadline strikethrough style", () => {
  it("applies the line-through class to the deadline row when the deadline is past", () => {
    mockedUseListReviewSessions.mockReturnValue({
      data: [makeSession({ submissionDeadline: PAST_DEADLINE })],
      isLoading: false,
    } as ReturnType<typeof useListReviewSessions>);

    renderHome();

    // The span rendered as "Deadline: <date>" lives inside the styled div.
    // en.json session.deadlinePrefix = "Deadline:"
    const deadlineSpan = screen.getByText(/Deadline:/);
    const deadlineRow = deadlineSpan.parentElement;

    expect(deadlineRow).toHaveClass("line-through");
  });

  it("does NOT apply the line-through class when the deadline is in the future", () => {
    mockedUseListReviewSessions.mockReturnValue({
      data: [makeSession({ submissionDeadline: FUTURE_DEADLINE })],
      isLoading: false,
    } as ReturnType<typeof useListReviewSessions>);

    renderHome();

    const deadlineSpan = screen.getByText(/Deadline:/);
    const deadlineRow = deadlineSpan.parentElement;

    expect(deadlineRow).not.toHaveClass("line-through");
  });
});
