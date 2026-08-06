// @vitest-environment jsdom
/**
 * PhotoReviewDetail page — direct-upload photo regression guard
 *
 * Confirms that the photo detail / review page handles a direct-upload
 * session photo (gallery-less: clubId = null, themeId = null) without
 * crashing, without exposing raw translation keys, and with the star-rating
 * and comment form present for eligible reviewers.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { Router } from "wouter";
import { PhotoReviewDetail } from "./photo-review-detail";
import en from "@/i18n/en.json";
import nl from "@/i18n/nl.json";

// ---------------------------------------------------------------------------
// Stub hooks that reach outside the component under test
// ---------------------------------------------------------------------------

vi.mock("@workspace/api-client-react", () => ({
  useGetReviewSession: vi.fn(),
  useListSessionPhotos: vi.fn(),
  useListPhotoReviews: vi.fn(),
  useListSessionReviewers: vi.fn(),
  useGetAdminStatus: vi.fn(),
  useCreatePhotoReview: vi.fn(),
  useUpdatePhotoReview: vi.fn(),
  getListPhotoReviewsQueryKey: vi.fn(() => ["photoReviews"]),
  getListSessionPhotosQueryKey: vi.fn(() => ["sessionPhotos"]),
  getListSessionReviewersQueryKey: vi.fn(() => ["reviewers"]),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useParams: vi.fn(() => ({ id: "1", sessionPhotoId: "99" })),
  };
});

vi.mock("@/hooks/use-date-locale", () => ({
  useDateLocale: () => undefined,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("lucide-react", () => ({
  ArrowLeft: () => null,
  Send: () => null,
}));

// Render StarRating as a labelled element so tests can assert its presence
vi.mock("@/components/star-rating", () => ({
  StarRating: ({ readonly, rating }: { readonly?: boolean; rating?: number }) => (
    <div
      data-testid={readonly ? "star-rating-readonly" : "star-rating-interactive"}
      data-rating={rating ?? 0}
    />
  ),
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

// ---------------------------------------------------------------------------
// Shared i18next instance
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
// Import mocked modules so we can set return values per test
// ---------------------------------------------------------------------------
import {
  useGetReviewSession,
  useListSessionPhotos,
  useListPhotoReviews,
  useListSessionReviewers,
  useGetAdminStatus,
  useCreatePhotoReview,
  useUpdatePhotoReview,
  type SessionPhoto,
} from "@workspace/api-client-react";

const mockedUseGetReviewSession = vi.mocked(useGetReviewSession);
const mockedUseListSessionPhotos = vi.mocked(useListSessionPhotos);
const mockedUseListPhotoReviews = vi.mocked(useListPhotoReviews);
const mockedUseListSessionReviewers = vi.mocked(useListSessionReviewers);
const mockedUseGetAdminStatus = vi.mocked(useGetAdminStatus);
const mockedUseCreatePhotoReview = vi.mocked(useCreatePhotoReview);
const mockedUseUpdatePhotoReview = vi.mocked(useUpdatePhotoReview);

// ---------------------------------------------------------------------------
// Shared fake data helpers
// ---------------------------------------------------------------------------

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    clubId: null,       // direct-upload sessions may have no club
    title: "Open Upload Session",
    status: "reviewing",
    createdAt: "2026-01-01T00:00:00Z",
    closedAt: null,
    photoCount: 1,
    submissionDeadline: null,
    scheduledFor: null,
    description: null,
    ...overrides,
  };
}

/**
 * A direct-upload session photo: no gallery, clubId = null, themeId = null.
 * `id` must equal the mocked sessionPhotoId param (99).
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
    reviewCount: 2,
    averageRating: 4.5,
    ...overrides,
  };
}

function setupStaticMocks() {
  mockedUseGetAdminStatus.mockReturnValue({
    data: { isAdmin: false, photographerId: null },
    isLoading: false,
  } as ReturnType<typeof useGetAdminStatus>);

  mockedUseListSessionReviewers.mockReturnValue({
    data: [],
    isLoading: false,
  } as ReturnType<typeof useListSessionReviewers>);

  mockedUseListPhotoReviews.mockReturnValue({
    data: [],
    isLoading: false,
  } as ReturnType<typeof useListPhotoReviews>);

  mockedUseCreatePhotoReview.mockReturnValue({
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useCreatePhotoReview>);

  mockedUseUpdatePhotoReview.mockReturnValue({
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useUpdatePhotoReview>);
}

function renderPhotoReviewDetail() {
  return render(
    <I18nextProvider i18n={i18n}>
      <Router>
        <PhotoReviewDetail />
      </Router>
    </I18nextProvider>
  );
}

// ---------------------------------------------------------------------------
// Helper: render with a direct-upload photo loaded
// ---------------------------------------------------------------------------
function renderWithDirectUploadPhoto(
  photoOverrides: Partial<SessionPhoto> = {},
  sessionOverrides: Record<string, unknown> = {}
) {
  setupStaticMocks();

  mockedUseGetReviewSession.mockReturnValue({
    data: makeSession(sessionOverrides),
    isLoading: false,
  } as ReturnType<typeof useGetReviewSession>);

  mockedUseListSessionPhotos.mockReturnValue({
    data: [makeDirectUploadPhoto(photoOverrides)],
    isLoading: false,
  } as ReturnType<typeof useListSessionPhotos>);

  return renderPhotoReviewDetail();
}

// ---------------------------------------------------------------------------
// Helper: render as a reviewer (admin) so the form is visible
// ---------------------------------------------------------------------------
function renderWithDirectUploadPhotoAsAdmin(photoOverrides: Partial<SessionPhoto> = {}) {
  setupStaticMocks();

  mockedUseGetAdminStatus.mockReturnValue({
    data: { isAdmin: true, photographerId: 42 },
    isLoading: false,
  } as ReturnType<typeof useGetAdminStatus>);

  mockedUseGetReviewSession.mockReturnValue({
    data: makeSession({ status: "reviewing" }),
    isLoading: false,
  } as ReturnType<typeof useGetReviewSession>);

  mockedUseListSessionPhotos.mockReturnValue({
    data: [makeDirectUploadPhoto(photoOverrides)],
    isLoading: false,
  } as ReturnType<typeof useListSessionPhotos>);

  return renderPhotoReviewDetail();
}

// ---------------------------------------------------------------------------
// Tests — title and image
// ---------------------------------------------------------------------------

describe("PhotoReviewDetail — direct-upload photo title and image", () => {
  it("renders the photo title for a direct-upload photo", () => {
    renderWithDirectUploadPhoto();
    expect(screen.getByText("Sunset over the dunes")).toBeInTheDocument();
  });

  it("renders an <img> with the correct src for a direct-upload photo", () => {
    renderWithDirectUploadPhoto();
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/uploads/sunset.jpg");
  });

  it("uses the photo title as the img alt attribute", () => {
    renderWithDirectUploadPhoto();
    expect(screen.getByAltText("Sunset over the dunes")).toBeInTheDocument();
  });

  it("falls back to the untitled label when photoTitle is absent", () => {
    renderWithDirectUploadPhoto({ photoTitle: undefined });
    // en.json common.untitled = "Untitled"
    expect(screen.getAllByText(en.common.untitled).length).toBeGreaterThan(0);
  });

  it("shows a skeleton placeholder when photoImageUrl is absent", () => {
    const { container } = renderWithDirectUploadPhoto({ photoImageUrl: undefined });
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });

  it("still shows the title when photoImageUrl is absent", () => {
    renderWithDirectUploadPhoto({ photoImageUrl: undefined });
    expect(screen.getByText("Sunset over the dunes")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — photographer attribution
// ---------------------------------------------------------------------------

describe("PhotoReviewDetail — photographer attribution", () => {
  it("shows the photographer name", () => {
    renderWithDirectUploadPhoto();
    expect(screen.getByText(/Jane Doe/i)).toBeInTheDocument();
  });

  it("does not render 'null' literally when photographerName is null", () => {
    renderWithDirectUploadPhoto({ photographerName: null });
    expect(screen.queryByText(/\bnull\b/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — no raw translation keys
// ---------------------------------------------------------------------------

describe("PhotoReviewDetail — no raw translation keys exposed", () => {
  it("does not render any dot-separated i18n keys (e.g. 'review.noReviews')", () => {
    const { container } = renderWithDirectUploadPhoto();
    // Raw i18n keys look like "namespace.camelCase"; reject text nodes that match
    const text = container.textContent ?? "";
    const rawKeyPattern = /\b(?:review|common|session)\.[a-zA-Z]+\b/;
    expect(rawKeyPattern.test(text)).toBe(false);
  });

  it("renders translated reviewsTitle instead of a raw key", () => {
    renderWithDirectUploadPhoto();
    // en.json review.reviewsTitle = "Reviews"
    expect(screen.getByText(en.review.reviewsTitle)).toBeInTheDocument();
  });

  it("renders translated noReviews label instead of a raw key when there are no reviews", () => {
    renderWithDirectUploadPhoto();
    // en.json review.noReviews = "No reviews yet."
    expect(screen.getByText(en.review.noReviews)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — star rating presence
// ---------------------------------------------------------------------------

describe("PhotoReviewDetail — star rating", () => {
  it("renders the read-only star rating for the average score", () => {
    renderWithDirectUploadPhoto();
    // At minimum the readonly summary rating is always rendered
    expect(screen.getByTestId("star-rating-readonly")).toBeInTheDocument();
  });

  it("reflects the average rating from the session photo", () => {
    renderWithDirectUploadPhoto({ averageRating: 4.5 });
    const readonlyRating = screen.getByTestId("star-rating-readonly");
    expect(readonlyRating).toHaveAttribute("data-rating", "4.5");
  });
});

// ---------------------------------------------------------------------------
// Tests — comment form presence (admin / reviewer in 'reviewing' status)
// ---------------------------------------------------------------------------

describe("PhotoReviewDetail — comment form presence", () => {
  it("shows the interactive star rating widget for an admin in reviewing status", () => {
    renderWithDirectUploadPhotoAsAdmin();
    expect(screen.getByTestId("star-rating-interactive")).toBeInTheDocument();
  });

  it("shows the feedback textarea for an admin in reviewing status", () => {
    renderWithDirectUploadPhotoAsAdmin();
    expect(
      screen.getByPlaceholderText(en.review.feedbackPlaceholder)
    ).toBeInTheDocument();
  });

  it("shows the submit-review button for an admin in reviewing status", () => {
    renderWithDirectUploadPhotoAsAdmin();
    expect(
      screen.getByRole("button", { name: new RegExp(en.review.submitBtn, "i") })
    ).toBeInTheDocument();
  });

  it("hides the comment form when the session status is not 'reviewing'", () => {
    renderWithDirectUploadPhoto({}, { status: "open" });
    expect(
      screen.queryByPlaceholderText(en.review.feedbackPlaceholder)
    ).not.toBeInTheDocument();
  });

  it("hides the comment form for a non-reviewer, non-admin member", () => {
    // setupStaticMocks sets isAdmin=false and no reviewers
    renderWithDirectUploadPhoto({}, { status: "reviewing" });
    expect(
      screen.queryByPlaceholderText(en.review.feedbackPlaceholder)
    ).not.toBeInTheDocument();
  });
});
