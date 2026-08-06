// @vitest-environment jsdom
/**
 * SessionDetail page — deadline-passed cue regression guard
 *
 * Asserts that the session detail page shows the "session.deadlinePassed"
 * label when submissionDeadline is in the past, and does NOT show it when
 * the deadline is in the future or absent.
 *
 * This guards against markup refactors that silently drop the cue.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { Router } from "wouter";
import { SessionDetail } from "./session-detail";
import en from "@/i18n/en.json";
import nl from "@/i18n/nl.json";

// ---------------------------------------------------------------------------
// Stub hooks that reach outside the component under test
// ---------------------------------------------------------------------------

vi.mock("@workspace/api-client-react", () => ({
  useGetReviewSession: vi.fn(),
  useListSessionPhotos: vi.fn(),
  useListSessionReviewers: vi.fn(),
  useGetAdminStatus: vi.fn(),
  useAddSessionReviewer: vi.fn(),
  useRemoveSessionReviewer: vi.fn(),
  useSubmitSessionPhoto: vi.fn(),
  useListPhotographers: vi.fn(),
  useListPhotos: vi.fn(),
  getListSessionReviewersQueryKey: vi.fn(() => ["reviewers"]),
  getListSessionPhotosQueryKey: vi.fn(() => ["photos"]),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useParams: vi.fn(() => ({ id: "1" })),
  };
});

vi.mock("@/hooks/use-date-locale", () => ({
  useDateLocale: () => undefined,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/hooks/use-page-param", () => ({
  usePageParam: () => [1, vi.fn()] as const,
}));

vi.mock("lucide-react", () => ({
  Camera: () => null,
  Users: () => null,
  Image: () => null,
  ImageIcon: () => null,
  MessageSquare: () => null,
  Trash2: () => null,
  Plus: () => null,
  X: () => null,
  Trophy: () => null,
  UploadCloud: () => null,
  CheckCircle2: () => null,
}));

vi.mock("@/components/pagination-bar", () => ({
  PaginationBar: () => null,
}));

vi.mock("@/components/star-rating", () => ({
  StarRating: () => null,
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
// Import the mocked modules so we can set return values per test
// ---------------------------------------------------------------------------
import {
  useGetReviewSession,
  useListSessionPhotos,
  useListSessionReviewers,
  useGetAdminStatus,
  useAddSessionReviewer,
  useRemoveSessionReviewer,
  useSubmitSessionPhoto,
  useListPhotographers,
  useListPhotos,
  type SessionPhoto,
} from "@workspace/api-client-react";

const mockedUseGetReviewSession = vi.mocked(useGetReviewSession);
const mockedUseListSessionPhotos = vi.mocked(useListSessionPhotos);
const mockedUseListSessionReviewers = vi.mocked(useListSessionReviewers);
const mockedUseGetAdminStatus = vi.mocked(useGetAdminStatus);
const mockedUseAddSessionReviewer = vi.mocked(useAddSessionReviewer);
const mockedUseRemoveSessionReviewer = vi.mocked(useRemoveSessionReviewer);
const mockedUseSubmitSessionPhoto = vi.mocked(useSubmitSessionPhoto);
const mockedUseListPhotographers = vi.mocked(useListPhotographers);
const mockedUseListPhotos = vi.mocked(useListPhotos);

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
    photoCount: 0,
    submissionDeadline: null,
    scheduledFor: null,
    description: null,
    ...overrides,
  };
}

function setupStaticMocks() {
  mockedUseGetAdminStatus.mockReturnValue({
    data: { isAdmin: false, photographerId: null },
    isLoading: false,
  } as ReturnType<typeof useGetAdminStatus>);

  mockedUseListSessionPhotos.mockReturnValue({
    data: [],
    isLoading: false,
  } as ReturnType<typeof useListSessionPhotos>);

  mockedUseListSessionReviewers.mockReturnValue({
    data: [],
    isLoading: false,
  } as ReturnType<typeof useListSessionReviewers>);

  mockedUseListPhotographers.mockReturnValue({
    data: [],
    isLoading: false,
  } as ReturnType<typeof useListPhotographers>);

  mockedUseListPhotos.mockReturnValue({
    data: [],
    isLoading: false,
  } as ReturnType<typeof useListPhotos>);

  mockedUseAddSessionReviewer.mockReturnValue({
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useAddSessionReviewer>);

  mockedUseRemoveSessionReviewer.mockReturnValue({
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useRemoveSessionReviewer>);

  mockedUseSubmitSessionPhoto.mockReturnValue({
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useSubmitSessionPhoto>);
}

function renderSessionDetail() {
  setupStaticMocks();

  return render(
    <I18nextProvider i18n={i18n}>
      <Router>
        <SessionDetail />
      </Router>
    </I18nextProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SessionDetail — deadline-passed cue", () => {
  it("shows the deadlinePassed label when submissionDeadline is in the past", () => {
    mockedUseGetReviewSession.mockReturnValue({
      data: makeSession({ submissionDeadline: PAST_DEADLINE }),
      isLoading: false,
    } as ReturnType<typeof useGetReviewSession>);

    renderSessionDetail();

    // en.json session.deadlinePassed = "The submission deadline has passed."
    expect(
      screen.getByText("The submission deadline has passed.")
    ).toBeInTheDocument();
  });

  it("does NOT show the deadlinePassed label when submissionDeadline is in the future", () => {
    mockedUseGetReviewSession.mockReturnValue({
      data: makeSession({ submissionDeadline: FUTURE_DEADLINE }),
      isLoading: false,
    } as ReturnType<typeof useGetReviewSession>);

    renderSessionDetail();

    expect(
      screen.queryByText("The submission deadline has passed.")
    ).not.toBeInTheDocument();
  });

  it("does NOT show the deadlinePassed label when there is no deadline", () => {
    mockedUseGetReviewSession.mockReturnValue({
      data: makeSession({ submissionDeadline: null }),
      isLoading: false,
    } as ReturnType<typeof useGetReviewSession>);

    renderSessionDetail();

    expect(
      screen.queryByText("The submission deadline has passed.")
    ).not.toBeInTheDocument();
  });

  it("does NOT show the deadlinePassed label when status is 'reviewing' and deadline is in the past", () => {
    mockedUseGetReviewSession.mockReturnValue({
      data: makeSession({ status: "reviewing", submissionDeadline: PAST_DEADLINE }),
      isLoading: false,
    } as ReturnType<typeof useGetReviewSession>);

    renderSessionDetail();

    expect(
      screen.queryByText("The submission deadline has passed.")
    ).not.toBeInTheDocument();
  });

  it("does NOT show the deadlinePassed label when status is 'closed' and deadline is in the past", () => {
    mockedUseGetReviewSession.mockReturnValue({
      data: makeSession({ status: "closed", submissionDeadline: PAST_DEADLINE }),
      isLoading: false,
    } as ReturnType<typeof useGetReviewSession>);

    renderSessionDetail();

    expect(
      screen.queryByText("The submission deadline has passed.")
    ).not.toBeInTheDocument();
  });
});

describe("SessionDetail — submit button visibility", () => {
  it("hides the submit-photo button when the deadline has passed", () => {
    mockedUseGetReviewSession.mockReturnValue({
      data: makeSession({ submissionDeadline: PAST_DEADLINE }),
      isLoading: false,
    } as ReturnType<typeof useGetReviewSession>);

    renderSessionDetail();

    // en.json session.submitPhoto = "Submit Photo"
    expect(
      screen.queryByRole("button", { name: /submit photo/i })
    ).not.toBeInTheDocument();
  });

  it("shows the submit-photo button when the deadline is in the future", () => {
    mockedUseGetReviewSession.mockReturnValue({
      data: makeSession({ submissionDeadline: FUTURE_DEADLINE }),
      isLoading: false,
    } as ReturnType<typeof useGetReviewSession>);

    renderSessionDetail();

    // en.json session.submitPhoto = "Submit Photo"
    expect(
      screen.getByRole("button", { name: /submit photo/i })
    ).toBeInTheDocument();
  });

  it("hides the submit-photo button for non-admin members when status is 'reviewing'", () => {
    mockedUseGetReviewSession.mockReturnValue({
      data: makeSession({ status: "reviewing", submissionDeadline: FUTURE_DEADLINE }),
      isLoading: false,
    } as ReturnType<typeof useGetReviewSession>);

    renderSessionDetail();

    expect(
      screen.queryByRole("button", { name: /submit photo/i })
    ).not.toBeInTheDocument();
  });

  it("hides the submit-photo button for non-admin members when status is 'closed'", () => {
    mockedUseGetReviewSession.mockReturnValue({
      data: makeSession({ status: "closed", submissionDeadline: FUTURE_DEADLINE }),
      isLoading: false,
    } as ReturnType<typeof useGetReviewSession>);

    renderSessionDetail();

    expect(
      screen.queryByRole("button", { name: /submit photo/i })
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Admin path — deadline cue and submit-button visibility
// ---------------------------------------------------------------------------

function renderSessionDetailAsAdmin() {
  mockedUseGetAdminStatus.mockReturnValue({
    data: { isAdmin: true, photographerId: 42 },
    isLoading: false,
  } as ReturnType<typeof useGetAdminStatus>);

  mockedUseListSessionPhotos.mockReturnValue({
    data: [],
    isLoading: false,
  } as ReturnType<typeof useListSessionPhotos>);

  mockedUseListSessionReviewers.mockReturnValue({
    data: [],
    isLoading: false,
  } as ReturnType<typeof useListSessionReviewers>);

  mockedUseListPhotographers.mockReturnValue({
    data: [],
    isLoading: false,
  } as ReturnType<typeof useListPhotographers>);

  mockedUseListPhotos.mockReturnValue({
    data: [],
    isLoading: false,
  } as ReturnType<typeof useListPhotos>);

  mockedUseAddSessionReviewer.mockReturnValue({
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useAddSessionReviewer>);

  mockedUseRemoveSessionReviewer.mockReturnValue({
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useRemoveSessionReviewer>);

  mockedUseSubmitSessionPhoto.mockReturnValue({
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useSubmitSessionPhoto>);

  return render(
    <I18nextProvider i18n={i18n}>
      <Router>
        <SessionDetail />
      </Router>
    </I18nextProvider>
  );
}

describe("SessionDetail — admin path deadline cue", () => {
  it("shows the deadlinePassed label for admins when the deadline is in the past", () => {
    mockedUseGetReviewSession.mockReturnValue({
      data: makeSession({ submissionDeadline: PAST_DEADLINE }),
      isLoading: false,
    } as ReturnType<typeof useGetReviewSession>);

    renderSessionDetailAsAdmin();

    // en.json session.deadlinePassed = "The submission deadline has passed."
    expect(
      screen.getByText("The submission deadline has passed.")
    ).toBeInTheDocument();
  });

  it("shows the submit-photo button for admins when the deadline is in the future", () => {
    mockedUseGetReviewSession.mockReturnValue({
      data: makeSession({ submissionDeadline: FUTURE_DEADLINE }),
      isLoading: false,
    } as ReturnType<typeof useGetReviewSession>);

    renderSessionDetailAsAdmin();

    // en.json session.submitPhoto = "Submit Photo"
    expect(
      screen.getByRole("button", { name: /submit photo/i })
    ).toBeInTheDocument();
  });

  it("hides the submit-photo button for admins when status is 'reviewing' and the deadline is in the past", () => {
    mockedUseGetReviewSession.mockReturnValue({
      data: makeSession({ status: "reviewing", submissionDeadline: PAST_DEADLINE }),
      isLoading: false,
    } as ReturnType<typeof useGetReviewSession>);

    renderSessionDetailAsAdmin();

    expect(
      screen.queryByRole("button", { name: /submit photo/i })
    ).not.toBeInTheDocument();
  });

  it("hides the submit-photo button for admins when status is 'closed'", () => {
    mockedUseGetReviewSession.mockReturnValue({
      data: makeSession({ status: "closed", submissionDeadline: FUTURE_DEADLINE }),
      isLoading: false,
    } as ReturnType<typeof useGetReviewSession>);

    renderSessionDetailAsAdmin();

    expect(
      screen.queryByRole("button", { name: /submit photo/i })
    ).not.toBeInTheDocument();
  });

  it("does NOT show the deadlinePassed label for admins when status is 'reviewing' and deadline is in the past", () => {
    mockedUseGetReviewSession.mockReturnValue({
      data: makeSession({ status: "reviewing", submissionDeadline: PAST_DEADLINE }),
      isLoading: false,
    } as ReturnType<typeof useGetReviewSession>);

    renderSessionDetailAsAdmin();

    expect(
      screen.queryByText("The submission deadline has passed.")
    ).not.toBeInTheDocument();
  });

  it("does NOT show the deadlinePassed label for admins when status is 'closed' and deadline is in the past", () => {
    mockedUseGetReviewSession.mockReturnValue({
      data: makeSession({ status: "closed", submissionDeadline: PAST_DEADLINE }),
      isLoading: false,
    } as ReturnType<typeof useGetReviewSession>);

    renderSessionDetailAsAdmin();

    expect(
      screen.queryByText("The submission deadline has passed.")
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Direct-upload photo appearance in the session photo grid
// ---------------------------------------------------------------------------

/**
 * A direct-upload photo has no gallery or club. The API creates a bare
 * `photos` row (clubId = null, themeId = null) and returns it via
 * GET /review-sessions/:id/photos with photoTitle and photoImageUrl
 * populated from that bare row.
 *
 * These tests guard against regressions where the grid silently hides or
 * mis-renders gallery-less photos.
 */

function makeDirectUploadPhoto(overrides: Partial<SessionPhoto> = {}): SessionPhoto {
  return {
    id: 99,
    sessionId: 1,
    photoId: 200,
    photographerId: 42,
    sortOrder: 1,
    submittedAt: "2026-01-02T00:00:00Z",
    photoTitle: "Sunset over the dunes",
    photoImageUrl: "https://example.com/uploads/sunset.jpg",
    photographerName: "Jane Doe",
    reviewCount: 0,
    averageRating: null,
    ...overrides,
  };
}

function renderSessionDetailWithPhotos(photos: SessionPhoto[]) {
  // Set up all other mocks via the shared helper, then override the photos.
  setupStaticMocks();
  mockedUseListSessionPhotos.mockReturnValue({
    data: photos,
    isLoading: false,
  } as ReturnType<typeof useListSessionPhotos>);

  mockedUseGetReviewSession.mockReturnValue({
    data: makeSession({ status: "reviewing" }),
    isLoading: false,
  } as ReturnType<typeof useGetReviewSession>);

  return render(
    <I18nextProvider i18n={i18n}>
      <Router>
        <SessionDetail />
      </Router>
    </I18nextProvider>
  );
}

describe("SessionDetail — direct-upload photo in the photo grid", () => {
  it("shows the photo title for a direct-upload photo (no club, no theme)", () => {
    renderSessionDetailWithPhotos([makeDirectUploadPhoto()]);

    expect(screen.getByText("Sunset over the dunes")).toBeInTheDocument();
  });

  it("renders an <img> with the correct src for a direct-upload photo", () => {
    renderSessionDetailWithPhotos([makeDirectUploadPhoto()]);

    const img = screen.getByRole("img", { name: "Sunset over the dunes" });
    expect(img).toHaveAttribute("src", "https://example.com/uploads/sunset.jpg");
  });

  it("shows the photographer name for a direct-upload photo", () => {
    renderSessionDetailWithPhotos([makeDirectUploadPhoto()]);

    // "by Jane Doe" — the component renders t("common.by") + photographerName
    expect(screen.getByText(/Jane Doe/i)).toBeInTheDocument();
  });

  it("falls back to the untitled label when the direct-upload photo has no title", () => {
    renderSessionDetailWithPhotos([makeDirectUploadPhoto({ photoTitle: undefined })]);

    // en.json session.untitled is used when photoTitle is absent
    expect(screen.getByText(en.session.untitled)).toBeInTheDocument();
  });

  it("renders the no-image placeholder when photoImageUrl is absent", () => {
    const { container } = renderSessionDetailWithPhotos([
      makeDirectUploadPhoto({ photoImageUrl: undefined }),
    ]);

    // No <img> element should be present when the URL is missing
    expect(container.querySelector("img")).toBeNull();
    // But the title must still appear
    expect(screen.getByText("Sunset over the dunes")).toBeInTheDocument();
  });

  it("shows multiple direct-upload photos when the session contains more than one", () => {
    renderSessionDetailWithPhotos([
      makeDirectUploadPhoto({ id: 1, photoId: 101, photoTitle: "Photo Alpha" }),
      makeDirectUploadPhoto({ id: 2, photoId: 102, photoTitle: "Photo Beta", sortOrder: 2 }),
    ]);

    expect(screen.getByText("Photo Alpha")).toBeInTheDocument();
    expect(screen.getByText("Photo Beta")).toBeInTheDocument();
  });

  it("shows the photo title and image without crashing when photographerName is null", () => {
    renderSessionDetailWithPhotos([
      makeDirectUploadPhoto({ photographerName: null }),
    ]);

    // Photo title and image must still appear
    expect(screen.getByText("Sunset over the dunes")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Sunset over the dunes" })
    ).toBeInTheDocument();
  });

  it("shows a graceful fallback in place of the photographer name when it is null", () => {
    renderSessionDetailWithPhotos([
      makeDirectUploadPhoto({ photographerName: null }),
    ]);

    // Must not render "by null" literally
    expect(screen.queryByText(/null/i)).not.toBeInTheDocument();
    // Must render the fallback label from common.unknownPhotographer
    // (rendered as "by Unknown Photographer" inside the same <p>)
    expect(
      screen.getByText(new RegExp(en.common.unknownPhotographer, "i"))
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Dutch locale — Unknown Photographer fallback
// ---------------------------------------------------------------------------

describe("SessionDetail — Dutch 'Unknown Photographer' fallback", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("nl");
  });

  afterAll(async () => {
    // Restore English so other describe blocks are unaffected
    await i18n.changeLanguage("en");
  });

  it("shows the Dutch fallback text when photographerName is null", () => {
    renderSessionDetailWithPhotos([
      makeDirectUploadPhoto({ photographerName: null }),
    ]);

    // nl.json common.unknownPhotographer = "Onbekende fotograaf"
    expect(
      screen.getByText(new RegExp(nl.common.unknownPhotographer, "i"))
    ).toBeInTheDocument();
  });

  it("does NOT show the raw translation key when photographerName is null", () => {
    renderSessionDetailWithPhotos([
      makeDirectUploadPhoto({ photographerName: null }),
    ]);

    expect(
      screen.queryByText(/common\.unknownPhotographer/i)
    ).not.toBeInTheDocument();
  });

  it("still shows the photo title in Dutch locale when photographerName is null", () => {
    renderSessionDetailWithPhotos([
      makeDirectUploadPhoto({ photographerName: null }),
    ]);

    expect(screen.getByText("Sunset over the dunes")).toBeInTheDocument();
  });
});
